import { Inject, Injectable } from '@nestjs/common'
import type { GlobalRole } from '@lvn/contracts/domain'
import { ACCESS_TOKEN_TTL_SECONDS, AccessTokenSigner } from '@lvn-backend/auth-guard'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { SessionRevocations } from '@lvn-backend/redis'
import { refusalError } from '../domain/account-status'
import { SESSION_TTL_DAYS } from '../domain/rules'
import { isStudyPublisher } from '../domain/study-publisher'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AccessGate } from './access-gate'
import { randomToken, sha256 } from './secrets'

export interface DeviceInfo {
  client: 'web' | 'mobile'
  userAgent?: string
}

export interface IssuedSession {
  userId: string
  accessToken: string
  accessTokenExpiresAt: Date
  refreshToken: string
  refreshTokenExpiresAt: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Sessions (§7.1): a 15-minute RS256 access token plus a 256-bit refresh token that is rotated on every use and
 * stored only as its SHA-256. Each sign-in starts a family; presenting an already-rotated refresh token revokes the
 * whole family (a stolen token and its legitimate owner cannot both keep using it).
 */
@Injectable()
export class SessionService {
  private readonly signer: AccessTokenSigner
  private readonly supportEmail: string

  constructor(
    private readonly db: PrismaService,
    private readonly revocations: SessionRevocations,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) config: UsersConfig,
    private readonly access: AccessGate,
  ) {
    this.signer = new AccessTokenSigner(config.jwtPrivateKey, config.jwtIssuer, config.tokenAudience)
    this.supportEmail = config.supportEmail
  }

  /** A new session family for a user who just proved who they are. */
  async start(userId: string, device: DeviceInfo): Promise<IssuedSession> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { globalRole: true, email: true, accountStatus: true } })
    if (isStudyPublisher(user)) throw Errors.forbidden('This account cannot sign in.')
    const refused = refusalError(user.accountStatus, this.supportEmail)
    if (refused) throw refused
    const familyId = newId()
    const refreshToken = randomToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS)
    await this.db.session.create({
      data: { id: newId(), userId, familyId, refreshTokenHash: sha256(refreshToken), device: { ...device }, expiresAt },
    })
    return this.issue(userId, familyId, user.globalRole as GlobalRole, refreshToken, expiresAt)
  }

  /** Rotates a refresh token. Unknown, expired or revoked tokens are UNAUTHENTICATED; a reused one revokes the family. */
  async refresh(refreshToken: string): Promise<IssuedSession> {
    const session = await this.db.session.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { user: { select: { globalRole: true, deletedAt: true, email: true, accountStatus: true } } },
    })
    if (!session) throw Errors.unauthenticated('Your session has ended. Sign in again.')
    if (isStudyPublisher({ id: session.userId, email: session.user.email })) throw Errors.forbidden('This account cannot sign in.')
    if (session.revokedAt) {
      if (session.replacedById) await this.revokeFamily(session.familyId, session.userId)
      throw Errors.unauthenticated('Your session has ended. Sign in again.')
    }
    if (session.expiresAt <= new Date() || session.user.deletedAt || session.user.accountStatus !== 'ACTIVE') {
      if (session.user.accountStatus !== 'ACTIVE') await this.revokeFamily(session.familyId, session.userId)
      throw Errors.unauthenticated('Your session has ended. Sign in again.')
    }
    if (!(await this.access.allows(session.user.email))) {
      await this.revokeFamily(session.familyId, session.userId)
      throw Errors.unauthenticated('Your session has ended. Sign in again.')
    }

    const next = randomToken()
    const nextId = newId()
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS)
    const rotated = await this.db.$transaction(async (tx) => {
      // Only one concurrent refresh with the same token can win; the loser is treated as reuse.
      const { count } = await tx.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date(), replacedById: nextId } })
      if (count !== 1) return false
      await tx.session.create({
        data: { id: nextId, userId: session.userId, familyId: session.familyId, refreshTokenHash: sha256(next), device: session.device ?? undefined, expiresAt },
      })
      return true
    })
    if (!rotated) {
      await this.revokeFamily(session.familyId, session.userId)
      throw Errors.unauthenticated('Your session has ended. Sign in again.')
    }
    return this.issue(session.userId, session.familyId, session.user.globalRole as GlobalRole, next, expiresAt)
  }

  /** Signs one device out: its whole session family. */
  async revokeFamily(familyId: string, userId: string): Promise<void> {
    await this.db.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } })
    await this.revocations.revoke(familyId, ACCESS_TOKEN_TTL_SECONDS)
    await this.events.publish('SessionRevoked', { userId, sessionId: familyId, family: true })
  }

  /** Signs out everywhere (password reset, account deletion). */
  async revokeAll(userId: string): Promise<void> {
    const families = await this.db.session.findMany({ where: { userId, revokedAt: null }, select: { familyId: true }, distinct: ['familyId'] })
    for (const { familyId } of families) await this.revokeFamily(familyId, userId)
  }

  /** The family a refresh token belongs to, if it is live (sign-out by cookie alone). */
  async familyOf(refreshToken: string): Promise<{ familyId: string; userId: string } | null> {
    const s = await this.db.session.findUnique({ where: { refreshTokenHash: sha256(refreshToken) }, select: { familyId: true, userId: true, revokedAt: true } })
    return s && !s.revokedAt ? { familyId: s.familyId, userId: s.userId } : null
  }

  private issue(userId: string, familyId: string, role: GlobalRole, refreshToken: string, refreshTokenExpiresAt: Date): IssuedSession {
    const { token, expiresAt } = this.signer.sign({ userId, sessionId: familyId, roles: [role] })
    return { userId, accessToken: token, accessTokenExpiresAt: expiresAt, refreshToken, refreshTokenExpiresAt }
  }
}

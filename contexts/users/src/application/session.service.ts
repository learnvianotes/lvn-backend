import { Inject, Injectable } from '@nestjs/common'
import type { GlobalRole } from '@lvn/contracts/domain'
import { ACCESS_TOKEN_TTL_SECONDS, AccessTokenSigner, MFA_MAX_AGE_SECONDS } from '@lvn-backend/auth-guard'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { SessionRevocations } from '@lvn-backend/redis'
import { refusalError } from '../domain/account-status'
import { allowedFactors, mfaFresh, mfaRequiredFor, type MfaFactorType, type MfaSubject } from '../domain/mfa'
import { SESSION_TTL_DAYS } from '../domain/rules'
import { isStudyPublisher } from '../domain/study-publisher'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AccessGate } from './access-gate'
import { SupportContact } from './support-contact'
import { randomToken, sha256 } from './secrets'

export interface DeviceInfo {
  client: 'web' | 'mobile'
  userAgent?: string
}

/** The first factor recorded on the session. `otp` is added when a code is accepted. */
export type FirstFactor = 'pwd' | 'google' | 'github' | 'linkedin'

export interface IssuedSession {
  userId: string
  accessToken: string
  accessTokenExpiresAt: Date
  refreshToken: string
  refreshTokenExpiresAt: Date
  /** True when this session still has to finish a second factor. */
  mfaRequired: boolean
  /** Factors the client may start. Empty when nothing is required. */
  mfaFactors: MfaFactorType[]
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

  constructor(
    private readonly db: PrismaService,
    private readonly revocations: SessionRevocations,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
    private readonly access: AccessGate,
    private readonly support: SupportContact,
  ) {
    this.signer = new AccessTokenSigner(config.jwtPrivateKey, config.jwtIssuer, config.tokenAudience)
  }

  /** A new session family for a user who just proved who they are. The second factor, when required, is still pending. */
  async start(userId: string, device: DeviceInfo, method: FirstFactor = 'pwd'): Promise<IssuedSession> {
    const user = await this.account(userId)
    if (isStudyPublisher(user)) throw Errors.forbidden('This account cannot sign in.')
    const refused = refusalError(user.accountStatus, await this.support.email())
    if (refused) throw refused
    const familyId = newId()
    const refreshToken = randomToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS)
    await this.db.session.create({
      data: { id: newId(), userId, familyId, refreshTokenHash: sha256(refreshToken), device: { ...device }, expiresAt, amr: [method] },
    })
    return this.issue(userId, familyId, user.globalRole as GlobalRole, refreshToken, expiresAt, { amr: [method], mfaVerifiedAt: null, user })
  }

  /** Rotates a refresh token. Unknown, expired or revoked tokens are UNAUTHENTICATED; a reused one revokes the family. */
  async refresh(refreshToken: string): Promise<IssuedSession> {
    const session = await this.db.session.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { user: { select: { globalRole: true, deletedAt: true, email: true, accountStatus: true, mfaOptIn: true, mfaExemptUntil: true } } },
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
        data: {
          id: nextId,
          userId: session.userId,
          familyId: session.familyId,
          refreshTokenHash: sha256(next),
          device: session.device ?? undefined,
          expiresAt,
          mfaVerifiedAt: session.mfaVerifiedAt,
          amr: session.amr,
        },
      })
      return true
    })
    if (!rotated) {
      await this.revokeFamily(session.familyId, session.userId)
      throw Errors.unauthenticated('Your session has ended. Sign in again.')
    }
    return this.issue(session.userId, session.familyId, session.user.globalRole as GlobalRole, next, expiresAt, {
      amr: session.amr,
      mfaVerifiedAt: session.mfaVerifiedAt,
      user: session.user,
    })
  }

  /**
   * Records a successful second factor on this refresh-session family and rotates the refresh token,
   * so the new access token carries `amr` including `otp`. Sign-out drops the family, and the code is required again.
   */
  async confirmMfa(familyId: string, userId: string): Promise<IssuedSession> {
    const session = await this.db.session.findFirst({
      where: { familyId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { globalRole: true, deletedAt: true, email: true, accountStatus: true, mfaOptIn: true, mfaExemptUntil: true } } },
      orderBy: { createdAt: 'desc' },
    })
    if (!session || session.user.deletedAt || session.user.accountStatus !== 'ACTIVE') throw Errors.unauthenticated('Your session has ended. Sign in again.')
    const amr = [...new Set([...session.amr, 'otp'])]
    const now = new Date()
    const next = randomToken()
    const nextId = newId()
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS)
    await this.db.$transaction(async (tx) => {
      await tx.session.updateMany({ where: { familyId, userId, revokedAt: null }, data: { revokedAt: now, replacedById: nextId } })
      await tx.session.create({
        data: {
          id: nextId,
          userId,
          familyId,
          refreshTokenHash: sha256(next),
          device: session.device ?? undefined,
          expiresAt,
          mfaVerifiedAt: now,
          amr,
        },
      })
    })
    return this.issue(userId, familyId, session.user.globalRole as GlobalRole, next, expiresAt, { amr, mfaVerifiedAt: now, user: session.user })
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

  private async account(userId: string) {
    return this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { globalRole: true, email: true, accountStatus: true, mfaOptIn: true, mfaExemptUntil: true },
    })
  }

  private issue(
    userId: string,
    familyId: string,
    role: GlobalRole,
    refreshToken: string,
    refreshTokenExpiresAt: Date,
    session: { amr: string[]; mfaVerifiedAt: Date | null; user: MfaSubject },
  ): IssuedSession {
    const required = mfaRequiredFor(session.user, this.config.mfa ?? { enforced: false, roles: [] })
    const fresh = mfaFresh(session.mfaVerifiedAt, MFA_MAX_AGE_SECONDS)
    const exempt = !required && !!session.user.mfaExemptUntil && session.user.mfaExemptUntil.getTime() > Date.now()
    const amr = fresh ? session.amr : session.amr.filter((method) => method !== 'otp')
    const { token, expiresAt } = this.signer.sign({
      userId,
      sessionId: familyId,
      roles: [role],
      amr,
      mfa: fresh,
      mfaAt: fresh && session.mfaVerifiedAt ? Math.floor(session.mfaVerifiedAt.getTime() / 1000) : undefined,
      mfaReq: required,
      mfaExempt: exempt,
    })
    const stillNeeded = required && !fresh
    return {
      userId,
      accessToken: token,
      accessTokenExpiresAt: expiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      mfaRequired: stillNeeded,
      mfaFactors: allowedFactors(stillNeeded),
    }
  }
}

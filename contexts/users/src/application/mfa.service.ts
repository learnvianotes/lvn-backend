import { Inject, Injectable } from '@nestjs/common'
import { MAILER, type Mailer } from '@lvn-backend/facades'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { clientNetwork } from '../domain/network'
import { allowedFactors, isImplementedFactor, MFA_CODE_TTL_MINUTES, MFA_MAX_AGE_SECONDS, MFA_MAX_ATTEMPTS, MFA_PURPOSE_SIGN_IN, mfaFresh, mfaRequiredFor, type MfaFactorType } from '../domain/mfa'
import { LIMITS } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AuditService } from './audit.service'
import { hmac, sameBytes, sixDigitCode } from './secrets'
import { SessionService, type IssuedSession } from './session.service'

const RECOVERY_HOURS = 2

export interface RequestMeta {
  ip?: string | null
  userAgent?: string | null
}

/**
 * Second factors for any account the policy names, and for an account that opts in.
 * Email OTP is the only factor that sends a code. TOTP and WebAuthn stop here with a validation error,
 * so the guard and the session claims do not know which factor was used.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly db: PrismaService,
    private readonly sessions: SessionService,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  async status(userId: string, familyId: string) {
    const user = await this.account(userId)
    const required = mfaRequiredFor(user, this.config.mfa)
    const session = await this.db.session.findFirst({
      where: { familyId, userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { mfaVerifiedAt: true },
    })
    const fresh = mfaFresh(session?.mfaVerifiedAt, MFA_MAX_AGE_SECONDS)
    const factors = await this.db.userMfaFactor.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
    return {
      required,
      satisfied: !required || fresh,
      verifiedAt: fresh ? (session?.mfaVerifiedAt ?? null) : null,
      factors,
      allowedFactors: allowedFactors(required),
    }
  }

  /** Emails a 6-digit code. Previous unused codes for this account stop working. */
  async start(userId: string, familyId: string, factor: string, meta: RequestMeta): Promise<{ challengeId: string; factor: MfaFactorType; expiresAt: Date }> {
    if (!isImplementedFactor(factor)) throw Errors.validation('This sign-in factor is not available yet.', ['factor'])
    const user = await this.account(userId)
    if (!mfaRequiredFor(user, this.config.mfa)) throw Errors.validation('A second factor is not required for this account.')
    const send = await this.limiter.hit(`mfa-send:${userId}`, LIMITS.mfaSend)
    if (!send.allowed) throw Errors.rateLimited(send.retryAfter, 'Too many codes. Try again later.')
    const network = clientNetwork(meta.ip)
    if (network) {
      const fromNetwork = await this.limiter.hit(`mfa-send-net:${network}`, LIMITS.mfaSendPerNetwork)
      if (!fromNetwork.allowed) throw Errors.rateLimited(fromNetwork.retryAfter, 'Too many codes from your network. Try again later.')
    }

    const code = sixDigitCode()
    const id = newId()
    const expiresAt = new Date(Date.now() + MFA_CODE_TTL_MINUTES * 60_000)
    const now = new Date()
    await this.db.$transaction(async (tx) => {
      await tx.userMfaFactor.upsert({
        where: { userId_type: { userId, type: 'EMAIL_OTP' } },
        create: { id: newId(), userId, type: 'EMAIL_OTP', status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      })
      await tx.mfaChallenge.updateMany({ where: { userId, purpose: MFA_PURPOSE_SIGN_IN, usedAt: null }, data: { usedAt: now } })
      await tx.mfaChallenge.create({
        data: {
          id,
          userId,
          factorType: 'EMAIL_OTP',
          purpose: MFA_PURPOSE_SIGN_IN,
          codeHash: hmac(this.config.codeHmacSecret, `${id}:${code}`),
          expiresAt,
          sessionFamilyId: familyId,
        },
      })
    })
    const admin = this.config.mfa.roles.includes(user.globalRole)
    const requestedAt = `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`
    await this.mailer.send(user.email, 'mfaCode', {
      displayName: user.displayName,
      code,
      expiresInMinutes: MFA_CODE_TTL_MINUTES,
      ip: meta.ip?.trim() || 'unknown',
      requestedAt,
      admin,
    })
    await this.audit.record({
      actorId: userId,
      action: 'mfa.challenge.started',
      targetType: 'MfaChallenge',
      targetId: id,
      metadata: { factor, purpose: MFA_PURPOSE_SIGN_IN },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    return { challengeId: id, factor: 'EMAIL_OTP', expiresAt }
  }

  /** Checks the code. Five wrong attempts burn it. A correct code is single use and marks the session. */
  async verify(userId: string, familyId: string, challengeId: string, code: string, meta: RequestMeta): Promise<IssuedSession> {
    const limit = await this.limiter.hit(`mfa-verify:${userId}`, LIMITS.mfaVerify)
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many attempts. Try again later.')
    const row = await this.db.mfaChallenge.findFirst({ where: { id: challengeId, userId } })
    if (!row || row.sessionFamilyId !== familyId) throw Errors.validation('This code is not valid.', ['code'])
    if (row.usedAt && row.attempts >= MFA_MAX_ATTEMPTS) throw Errors.validation('Too many attempts. Ask for a new code.', ['code'])
    if (row.usedAt) throw Errors.validation('This code has already been used.', ['code'])
    if (row.expiresAt.getTime() <= Date.now()) throw Errors.validation('This code has expired. Ask for a new one.', ['code'])

    const matches = /^\d{6}$/.test(code) && sameBytes(hmac(this.config.codeHmacSecret, `${row.id}:${code}`), row.codeHash)
    if (!matches) {
      const attempts = row.attempts + 1
      const locked = attempts >= MFA_MAX_ATTEMPTS
      await this.db.mfaChallenge.update({ where: { id: row.id }, data: { attempts, ...(locked ? { usedAt: new Date() } : {}) } })
      await this.audit.record({
        actorId: userId,
        action: locked ? 'mfa.locked' : 'mfa.failed',
        targetType: 'MfaChallenge',
        targetId: row.id,
        metadata: { attempts },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })
      throw Errors.validation(locked ? 'Too many attempts. Ask for a new code.' : 'That code is incorrect.', ['code'])
    }

    const consumed = await this.db.mfaChallenge.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } })
    if (consumed.count !== 1) throw Errors.validation('This code has already been used.', ['code'])
    await this.db.userMfaFactor.updateMany({ where: { userId, type: row.factorType }, data: { lastUsedAt: new Date(), status: 'ACTIVE' } })
    await this.audit.record({
      actorId: userId,
      action: 'mfa.verified',
      targetType: 'MfaChallenge',
      targetId: row.id,
      metadata: { factor: row.factorType },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    return this.sessions.confirmMfa(familyId, userId)
  }

  /** Stores an opt-in. The next sign-in or refresh applies it. There is no screen for this yet. */
  async setOptIn(userId: string, optIn: boolean, meta: RequestMeta): Promise<void> {
    const user = await this.account(userId)
    await this.db.user.update({ where: { id: user.id }, data: { mfaOptIn: optIn } })
    await this.audit.record({
      actorId: userId,
      action: optIn ? 'mfa.opt_in' : 'mfa.opt_out',
      targetType: 'User',
      targetId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  /**
   * Another platform admin clears a lockout and opens a short window where sign-in does not ask for a code.
   * The actor's own MFA is checked by `@RequireMfa()` before this runs.
   */
  async recover(actorId: string, userId: string, reason: string, meta: RequestMeta): Promise<void> {
    const actor = await this.account(actorId)
    if (actor.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden('Only a platform admin can recover a sign-in code.')
    if (actorId === userId) throw Errors.validation('Ask another platform admin to recover your sign-in.', ['input', 'userId'])
    const why = reason.trim()
    if (why.length < 3 || why.length > 500) throw Errors.validation('Say why, in a few words.', ['input', 'reason'])
    const target = await this.db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } })
    if (!target) throw Errors.notFound('User not found.')
    const until = new Date(Date.now() + RECOVERY_HOURS * 60 * 60 * 1000)
    const now = new Date()
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { mfaExemptUntil: until } }),
      this.db.mfaChallenge.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
    ])
    await this.limiter.reset(`mfa-send:${userId}`)
    await this.limiter.reset(`mfa-verify:${userId}`)
    await this.audit.record({
      actorId,
      action: 'mfa.recovered',
      targetType: 'User',
      targetId: userId,
      metadata: { reason: why, exemptUntil: until.toISOString() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  private async account(userId: string) {
    const user = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, displayName: true, globalRole: true, mfaOptIn: true, mfaExemptUntil: true },
    })
    if (!user) throw Errors.unauthenticated()
    return user
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { MAILER, type Mailer } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { clientNetwork } from '../domain/network'
import { emailSchema, LIMITS, SIGN_IN_CODE_MAX_ATTEMPTS, SIGN_IN_CODE_TTL_MINUTES } from '../domain/rules'
import { isStudyPublisher } from '../domain/study-publisher'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AccessGate } from './access-gate'
import { parseField } from './input'
import { LegacyService } from './legacy.service'
import { hmac, sameBytes, sixDigitCode } from './secrets'
import { SessionService, type DeviceInfo, type IssuedSession } from './session.service'

const WRONG = 'That code is incorrect or has expired. Ask for a new one.'

/**
 * Sign in with a 6-digit code emailed to the account address, no password needed (ADR-0115). Asking for a code always
 * succeeds, whether or not an account has the address, so the answer never tells anyone who has an account. A code is
 * stored only as an HMAC, lasts SIGN_IN_CODE_TTL_MINUTES, works once, and burns after SIGN_IN_CODE_MAX_ATTEMPTS wrong
 * tries. Asking again makes every earlier code stop working. A correct code also proves the address, so an unverified
 * login email becomes verified.
 */
@Injectable()
export class SignInCodeService {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly sessions: SessionService,
    private readonly access: AccessGate,
    private readonly legacy: LegacyService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  async request(rawEmail: string, ip?: string): Promise<void> {
    const email = parseField(emailSchema, rawEmail, 'email')
    const network = clientNetwork(ip)
    if (network) {
      const fromNetwork = await this.limiter.hit(`signin-code-net:${network}`, LIMITS.signInCodeSendPerNetwork)
      if (!fromNetwork.allowed) throw Errors.rateLimited(fromNetwork.retryAfter, 'Too many codes from your network. Try again later.')
    }
    const perAddress = await this.limiter.hit(`signin-code:${email}`, LIMITS.signInCodeSend)
    if (!perAddress.allowed) throw Errors.rateLimited(perAddress.retryAfter, 'Too many codes for this address. Try again later.')
    await this.access.assertAllowed(email)

    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, email: true, displayName: true, deletedAt: true, passwordHash: true } })
    // No account, a deleted one, or the study publisher: say nothing different and send nothing.
    if (!user || user.deletedAt || isStudyPublisher(user)) return

    const code = sixDigitCode()
    const id = newId()
    const now = new Date()
    await this.db.$transaction([
      this.db.signInCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
      this.db.signInCode.create({
        data: { id, userId: user.id, codeHash: hmac(this.config.codeHmacSecret, `${id}:${code}`), expiresAt: new Date(now.getTime() + SIGN_IN_CODE_TTL_MINUTES * 60_000) },
      }),
    ])
    await this.mailer.send(user.email, 'mfaCode', {
      displayName: user.displayName,
      code,
      expiresInMinutes: SIGN_IN_CODE_TTL_MINUTES,
      ip: ip?.trim() || 'unknown',
      requestedAt: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      admin: false,
    })
  }

  async signIn(rawEmail: string, rawCode: string, device: DeviceInfo, ip?: string): Promise<IssuedSession> {
    const email = parseField(emailSchema, rawEmail, 'email')
    const code = rawCode.replace(/\s+/g, '')
    const network = clientNetwork(ip)
    if (network) {
      const fromNetwork = await this.limiter.peek(`signin-fail:${network}`, LIMITS.signInFailuresPerNetwork)
      if (!fromNetwork.allowed) throw Errors.rateLimited(fromNetwork.retryAfter, 'Too many failed sign-ins from your network. Try again in a few minutes.')
    }
    const limit = await this.limiter.hit(`signin-code-check:${email}`, LIMITS.signInCodeVerify)
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many attempts. Try again in a few minutes.')
    await this.access.assertAllowed(email)

    const fail = async (): Promise<never> => {
      if (network) await this.limiter.hit(`signin-fail:${network}`, LIMITS.signInFailuresPerNetwork)
      throw Errors.validation(WRONG, ['input', 'code'])
    }
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, email: true, deletedAt: true, emailVerifiedAt: true, passwordHash: true } })
    if (!user || user.deletedAt || isStudyPublisher(user)) return fail()
    const row = await this.db.signInCode.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: 'desc' } })
    if (!row || row.expiresAt.getTime() <= Date.now() || row.attempts >= SIGN_IN_CODE_MAX_ATTEMPTS) return fail()

    const matches = /^\d{6}$/.test(code) && sameBytes(hmac(this.config.codeHmacSecret, `${row.id}:${code}`), row.codeHash)
    if (!matches) {
      const attempts = row.attempts + 1
      await this.db.signInCode.update({ where: { id: row.id }, data: { attempts, ...(attempts >= SIGN_IN_CODE_MAX_ATTEMPTS ? { usedAt: new Date() } : {}) } })
      return fail()
    }
    const consumed = await this.db.signInCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } })
    if (consumed.count !== 1) return fail()

    await this.limiter.reset(`signin-code-check:${email}`)
    // Owning the inbox ends the pause wrong passwords put on this address (ADR-0116).
    await this.limiter.reset(`signin-fail-addr:${email}`)
    if (!user.emailVerifiedAt) await this.db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } })
    await this.legacy.match(user.id, { verifiedEmail: email })
    return this.sessions.start(user.id, device)
  }
}

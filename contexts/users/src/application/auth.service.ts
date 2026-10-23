import { Inject, Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { MAILER, type Mailer } from '@lvn-backend/facades'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import {
  dateOfBirthSchema,
  displayNameSchema,
  emailSchema,
  isBelowMinimumAge,
  LIMITS,
  RESET_PASSWORD_TTL_MINUTES,
  TERMS_VERSION,
  UNDER_MINIMUM_AGE_MESSAGE,
  VERIFY_EMAIL_TTL_HOURS,
} from '../domain/rules'
import { clientNetwork } from '../domain/network'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { freeHandle } from './handles'
import { parseField } from './input'
import { InstitutionalEmailService } from './institutional-email.service'
import { LegacyService } from './legacy.service'
import { PasswordService } from './password.service'
import { randomToken, sha256 } from './secrets'
import { SessionService, type DeviceInfo, type IssuedSession } from './session.service'

export interface SignUpInput {
  email: string
  password: string
  displayName: string
  dateOfBirth: string
  institutionalEmail?: string | null
  acceptedTermsVersion: string
}

const INVALID_LINK = 'This link is invalid or has expired. Ask for a new one.'

/** A new account, signed in — or a password waiting on an emailed link for an account that already exists (ADR-0100). */
export type SignUpResult = { status: 'created'; session: IssuedSession } | { status: 'emailLinkPending' }

const ACCOUNT_EXISTS = 'An account with this email already exists. Sign in instead.'

/**
 * Email + password accounts (§7, ADR-0017): sign-up with the registration details, sign-in, the login-email check
 * and password reset. Google, GitHub and LinkedIn are in OAuthService; sessions in SessionService. Signing up with
 * an email that already belongs to a provider account attaches a password only after the link in the email is used.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly limiter: RateLimiter,
    private readonly institutional: InstitutionalEmailService,
    private readonly legacy: LegacyService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  async signUp(input: SignUpInput, device: DeviceInfo, correlationId?: string): Promise<SignUpResult> {
    const email = parseField(emailSchema, input.email, 'email')
    const displayName = parseField(displayNameSchema, input.displayName, 'displayName')
    const dateOfBirth = parseField(dateOfBirthSchema, input.dateOfBirth, 'dateOfBirth')
    // ADR-0091: too young for an account — nothing is created or kept, and an existing account is not touched.
    if (isBelowMinimumAge(dateOfBirth, this.config.accountMinimumAge)) throw Errors.underMinimumAge(UNDER_MINIMUM_AGE_MESSAGE, ['input', 'dateOfBirth'])
    if (input.acceptedTermsVersion !== TERMS_VERSION) {
      throw Errors.validation('Accept the current Terms and Privacy Policy to continue.', ['input', 'acceptedTermsVersion'])
    }
    await this.passwords.assertAcceptable(input.password)
    if (input.institutionalEmail) await this.institutional.check(input.institutionalEmail, ['input', 'institutionalEmail'])
    const existing = await this.db.user.findUnique({
      where: { email },
      select: { id: true, deletedAt: true, emailVerifiedAt: true, passwordHash: true, displayName: true },
    })
    if (existing) {
      // A password is attached only when the account's email is already verified and it has no password yet
      // (a Google, GitHub or LinkedIn account). The link proves this caller owns the inbox. Anything else is the
      // same "sign in instead" answer: no second account, and no password written over one that is already set.
      if (existing.deletedAt || existing.passwordHash !== null || !existing.emailVerifiedAt) {
        throw Errors.conflict(ACCOUNT_EXISTS, ['input', 'email'])
      }
      await this.startEmailLink(existing.id, email, existing.displayName, input.password)
      return { status: 'emailLinkPending' }
    }

    const id = newId()
    const passwordHash = await this.passwords.hash(input.password)
    try {
      await this.db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id,
            email,
            handle: await freeHandle(tx, displayName),
            displayName,
            passwordHash,
            dateOfBirth,
            registrationCompletedAt: new Date(),
          },
        })
        await tx.consentRecord.createMany({
          data: (['TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE'] as const).map((kind) => ({ id: newId(), userId: id, kind, version: TERMS_VERSION })),
        })
      })
    } catch (e) {
      // Two sign-ups with the same email at once: the unique index decides.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const raced = await this.db.user.findUnique({ where: { email }, select: { id: true, deletedAt: true, emailVerifiedAt: true, passwordHash: true, displayName: true } })
        if (raced && !raced.deletedAt && raced.passwordHash === null && raced.emailVerifiedAt) {
          await this.startEmailLink(raced.id, email, raced.displayName, input.password)
          return { status: 'emailLinkPending' }
        }
        throw Errors.conflict(ACCOUNT_EXISTS, ['input', 'email'])
      }
      throw e
    }

    await this.sendEmailVerification(id, email, displayName)
    if (input.institutionalEmail) await this.institutional.start(id, input.institutionalEmail)
    await this.events.publish('UserRegistered', { userId: id }, { correlationId })
    return { status: 'created', session: await this.sessions.start(id, device) }
  }

  /** `ip` is the client address (behind trusted proxies); it is used for the credential-stuffing limit, never stored. */
  async signIn(rawEmail: string, password: string, device: DeviceInfo, ip?: string): Promise<IssuedSession> {
    const email = parseField(emailSchema, rawEmail, 'email')
    const network = clientNetwork(ip)
    if (network) {
      const fromNetwork = await this.limiter.peek(`signin-fail:${network}`, LIMITS.signInFailuresPerNetwork)
      if (!fromNetwork.allowed) throw Errors.rateLimited(fromNetwork.retryAfter, 'Too many failed sign-ins from your network. Try again in a few minutes.')
    }
    const limit = await this.limiter.hit(`signin:${email}`, LIMITS.signIn)
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many sign-in attempts. Try again in a few minutes.')

    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, deletedAt: true, emailVerifiedAt: true } })
    const ok = await this.passwords.verify(user && !user.deletedAt ? user.passwordHash : null, password)
    if (!user || !ok) {
      if (network) await this.limiter.hit(`signin-fail:${network}`, LIMITS.signInFailuresPerNetwork)
      throw Errors.validation('Email or password is incorrect.')
    }

    await this.limiter.reset(`signin:${email}`)
    if (user.emailVerifiedAt) await this.legacy.match(user.id, { verifiedEmail: email })
    if (this.passwords.needsRehash(user.passwordHash!)) {
      await this.db.user.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(password) } })
    }
    return this.sessions.start(user.id, device)
  }

  /**
   * Confirms the sign-in email from the link in the verification email. A LINK_EMAIL link instead attaches the
   * password chosen at sign-up to the account that already had this address, and does not sign anyone in.
   */
  async verifyEmail(token: string): Promise<void> {
    const row = await this.consumeToken(token, ['VERIFY_EMAIL', 'LINK_EMAIL'])
    if (row.purpose === 'LINK_EMAIL') {
      if (!row.passwordHash) throw Errors.validation(INVALID_LINK, ['input', 'token'])
      const { count } = await this.db.user.updateMany({
        where: { id: row.userId, deletedAt: null, passwordHash: null },
        data: { passwordHash: row.passwordHash },
      })
      if (count !== 1) throw Errors.validation(INVALID_LINK, ['input', 'token'])
      const user = await this.db.user.findUniqueOrThrow({ where: { id: row.userId }, select: { id: true, email: true } })
      await this.legacy.match(user.id, { verifiedEmail: user.email })
      return
    }
    const user = await this.db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() }, select: { id: true, email: true } })
    // A verified email may find the learner's data from the old site (ADR-0023).
    await this.legacy.match(user.id, { verifiedEmail: user.email })
  }

  /** Always succeeds for the caller (no account enumeration); emails a link only if an account exists. */
  async requestPasswordReset(rawEmail: string): Promise<void> {
    const email = parseField(emailSchema, rawEmail, 'email')
    const limit = await this.limiter.hit(`reset:${email}`, LIMITS.passwordReset)
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many reset requests. Try again later.')
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, displayName: true, deletedAt: true } })
    if (!user || user.deletedAt) return
    const token = randomToken()
    await this.db.emailToken.create({
      data: { id: newId(), userId: user.id, purpose: 'RESET_PASSWORD', tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_PASSWORD_TTL_MINUTES * 60_000) },
    })
    await this.mailer.send(email, 'resetPassword', {
      displayName: user.displayName,
      link: this.link('/reset', token),
      expiresInMinutes: RESET_PASSWORD_TTL_MINUTES,
    })
  }

  /** Sets a new password from a reset link and signs the account out everywhere. */
  async resetPassword(token: string, password: string): Promise<void> {
    await this.passwords.assertAcceptable(password)
    const row = await this.consumeToken(token, 'RESET_PASSWORD')
    const user = await this.db.user.update({
      where: { id: row.userId },
      // Following the link proves the inbox is theirs.
      data: { passwordHash: await this.passwords.hash(password), emailVerifiedAt: new Date() },
      select: { id: true, email: true, displayName: true },
    })
    await this.db.emailToken.updateMany({ where: { userId: user.id, purpose: 'RESET_PASSWORD', usedAt: null }, data: { usedAt: new Date() } })
    await this.sessions.revokeAll(user.id)
    await this.mailer.send(user.email, 'passwordChanged', { displayName: user.displayName })
  }

  /**
   * Emails a one-time link that will set `password` on an account which already verified this address and has no
   * password. Nothing on the account changes until the link is used. The name in the email is the account's own.
   */
  private async startEmailLink(userId: string, email: string, displayName: string, password: string): Promise<void> {
    const limit = await this.limiter.hit(`link-email:${email}`, LIMITS.linkEmail)
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many requests to add a password. Try again later.')
    const passwordHash = await this.passwords.hash(password)
    const token = randomToken()
    const now = new Date()
    await this.db.$transaction([
      this.db.emailToken.updateMany({ where: { userId, purpose: 'LINK_EMAIL', usedAt: null }, data: { usedAt: now, passwordHash: null } }),
      this.db.emailToken.create({
        data: { id: newId(), userId, purpose: 'LINK_EMAIL', tokenHash: sha256(token), passwordHash, expiresAt: new Date(Date.now() + VERIFY_EMAIL_TTL_HOURS * 3_600_000) },
      }),
    ])
    await this.mailer.send(email, 'linkEmail', { displayName, link: this.link('/verify', token) })
  }

  private async sendEmailVerification(userId: string, email: string, displayName: string): Promise<void> {
    const token = randomToken()
    await this.db.emailToken.create({
      data: { id: newId(), userId, purpose: 'VERIFY_EMAIL', tokenHash: sha256(token), expiresAt: new Date(Date.now() + VERIFY_EMAIL_TTL_HOURS * 3_600_000) },
    })
    await this.mailer.send(email, 'verifyEmail', { displayName, link: this.link('/verify', token) })
  }

  /** Marks a single-use email token used, or throws VALIDATION if it is unknown, used or expired. */
  private async consumeToken(token: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'LINK_EMAIL' | Array<'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'LINK_EMAIL'>) {
    const allowed = Array.isArray(purpose) ? purpose : [purpose]
    const now = new Date()
    const row = await this.db.emailToken.findUnique({ where: { tokenHash: sha256(token) } })
    if (!row || !allowed.includes(row.purpose) || row.usedAt || row.expiresAt <= now) throw Errors.validation(INVALID_LINK, ['input', 'token'])
    // Drop a pending password hash as the token is spent, so it is not kept after the link is used or rejected.
    const { count } = await this.db.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now, passwordHash: null } })
    if (count !== 1) throw Errors.validation(INVALID_LINK, ['input', 'token'])
    return row
  }

  private link(path: string, token: string): string {
    const url = new URL(path, this.config.webUrl)
    url.searchParams.set('token', token)
    return url.toString()
  }
}

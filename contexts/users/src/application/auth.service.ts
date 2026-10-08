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
  LIMITS,
  RESET_PASSWORD_TTL_MINUTES,
  TERMS_VERSION,
  VERIFY_EMAIL_TTL_HOURS,
} from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { freeHandle } from './handles'
import { parseField } from './input'
import { InstitutionalEmailService } from './institutional-email.service'
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

/**
 * Email + password accounts (§7, ADR-0017): sign-up with the registration details, sign-in, the login-email check
 * and password reset. Google, GitHub and LinkedIn are in OAuthService; sessions in SessionService.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly limiter: RateLimiter,
    private readonly institutional: InstitutionalEmailService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  async signUp(input: SignUpInput, device: DeviceInfo, correlationId?: string): Promise<IssuedSession> {
    const email = parseField(emailSchema, input.email, 'email')
    const displayName = parseField(displayNameSchema, input.displayName, 'displayName')
    const dateOfBirth = parseField(dateOfBirthSchema, input.dateOfBirth, 'dateOfBirth')
    if (input.acceptedTermsVersion !== TERMS_VERSION) {
      throw Errors.validation('Accept the current Terms and Privacy Policy to continue.', ['input', 'acceptedTermsVersion'])
    }
    await this.passwords.assertAcceptable(input.password)
    if (input.institutionalEmail) await this.institutional.check(input.institutionalEmail, ['input', 'institutionalEmail'])
    if (await this.db.user.findUnique({ where: { email }, select: { id: true } })) {
      throw Errors.conflict('An account with this email already exists. Sign in instead.', ['input', 'email'])
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
        throw Errors.conflict('An account with this email already exists. Sign in instead.', ['input', 'email'])
      }
      throw e
    }

    await this.sendEmailVerification(id, email, displayName)
    if (input.institutionalEmail) await this.institutional.start(id, input.institutionalEmail)
    await this.events.publish('UserRegistered', { userId: id }, { correlationId })
    return this.sessions.start(id, device)
  }

  async signIn(rawEmail: string, password: string, device: DeviceInfo): Promise<IssuedSession> {
    const email = parseField(emailSchema, rawEmail, 'email')
    const limit = await this.limiter.hit(`signin:${email}`, LIMITS.signIn)
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many sign-in attempts. Try again in a few minutes.')

    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, deletedAt: true } })
    const ok = await this.passwords.verify(user && !user.deletedAt ? user.passwordHash : null, password)
    if (!user || !ok) throw Errors.validation('Email or password is incorrect.')

    await this.limiter.reset(`signin:${email}`)
    if (this.passwords.needsRehash(user.passwordHash!)) {
      await this.db.user.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(password) } })
    }
    return this.sessions.start(user.id, device)
  }

  /** Confirms the sign-in email from the link in the verification email. */
  async verifyEmail(token: string): Promise<void> {
    const row = await this.consumeToken(token, 'VERIFY_EMAIL')
    await this.db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } })
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
      link: this.link('/reset-password', token),
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

  private async sendEmailVerification(userId: string, email: string, displayName: string): Promise<void> {
    const token = randomToken()
    await this.db.emailToken.create({
      data: { id: newId(), userId, purpose: 'VERIFY_EMAIL', tokenHash: sha256(token), expiresAt: new Date(Date.now() + VERIFY_EMAIL_TTL_HOURS * 3_600_000) },
    })
    await this.mailer.send(email, 'verifyEmail', { displayName, link: this.link('/verify-email', token) })
  }

  /** Marks a single-use email token used, or throws VALIDATION if it is unknown, used or expired. */
  private async consumeToken(token: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
    const now = new Date()
    const row = await this.db.emailToken.findUnique({ where: { tokenHash: sha256(token) } })
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= now) throw Errors.validation(INVALID_LINK, ['input', 'token'])
    const { count } = await this.db.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } })
    if (count !== 1) throw Errors.validation(INVALID_LINK, ['input', 'token'])
    return row
  }

  private link(path: string, token: string): string {
    const url = new URL(path, this.config.webUrl)
    url.searchParams.set('token', token)
    return url.toString()
  }
}

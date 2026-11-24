import { Inject, Injectable, Logger } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { MAILER, type Mailer } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { GUARDIAN_CONSENT_EMAIL_PLUS } from '../domain/guardian-consent'
import { readGuardianToken, signGuardianToken, type GuardianLinkPurpose } from '../domain/guardian-links'
import { GUARDIAN_CONSENT_WITHDRAWN_REASON, GUARDIAN_NOTICE_COLLECTS, GUARDIAN_NOTICE_PROCESSORS, GUARDIAN_NOTICE_WHY } from '../domain/guardian-verification'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { PolicyService } from './policy.service'
import { randomToken, sha256 } from './secrets'
import { PlatformSettingsStore } from './platform-settings.store'

const INVALID_LINK = 'This link is invalid or has expired. Ask for a new one.'

/**
 * Direct notice to a parent, the confirm link, and the manage link (ADR-0110). Mail goes through the shared
 * mailer, which sends with Resend when that transport is configured. Nothing here is marketing, and nothing is
 * logged that could be an address. Sending the notice does not change the consent method.
 */
@Injectable()
export class GuardianNoticeService {
  private readonly log = new Logger('GuardianNotice')

  constructor(
    private readonly db: PrismaService,
    private readonly settings: PlatformSettingsStore,
    private readonly policy: PolicyService,
    private readonly limiter: RateLimiter,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** Best-effort, after the account is stored. A mail failure does not undo sign-up. */
  async notify(userId: string): Promise<void> {
    try {
      await this.sendNotice(userId)
    } catch (e) {
      this.log.warn(`guardian notice for ${userId} was not sent: ${(e as Error).name}`)
    }
  }

  /** Another copy of the notice, with a new confirm link. Rate limited. Does not verify anything. */
  async resendConfirm(userId: string): Promise<void> {
    await this.limit(userId, 'confirm')
    if (!this.settings.emailPlusEnabled()) throw Errors.validation('Parent confirmation by email is turned off.')
    await this.sendNotice(userId)
  }

  /** A new single-use manage link to the parent address. Rate limited. */
  async resendManage(userId: string): Promise<void> {
    await this.limit(userId, 'manage')
    const parent = await this.parentOf(userId)
    if (!parent) throw Errors.validation('This account has no parent email.')
    const token = await this.issue(userId, 'MANAGE', this.linkTtlMs())
    await this.mailer.send(parent.email, 'guardianManageLink', {
      childName: parent.childName,
      manageLink: this.url('/guardian/manage', token),
      expiresInHours: this.settings.guardianLinkTtlHours(),
      supportEmail: this.config.supportEmail,
    })
  }

  /**
   * The parent clicked the confirm link. Receiving the email does not call this. Sets method `email_plus` and
   * `verifiedAt`, then sends the follow-up confirmation the email-plus method requires.
   */
  async confirm(token: string): Promise<void> {
    if (!this.settings.emailPlusEnabled()) throw Errors.validation('Parent confirmation by email is turned off.')
    const { userId } = await this.consume(token, 'CONFIRM')
    const consent = await this.db.guardianConsent.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } })
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { displayName: true, accountStatus: true, statusReason: true } })
    if (!consent?.parentEmail || !user) throw Errors.validation(INVALID_LINK)
    const verifiedAt = new Date()
    await this.db.guardianConsent.update({ where: { id: consent.id }, data: { method: GUARDIAN_CONSENT_EMAIL_PLUS, verifiedAt } })
    if (user.accountStatus === 'SUSPENDED' && user.statusReason === GUARDIAN_CONSENT_WITHDRAWN_REASON) await this.policy.lift(userId)
    try {
      const manage = await this.issue(userId, 'MANAGE', this.linkTtlMs())
      await this.mailer.send(consent.parentEmail, 'guardianConsentConfirmed', {
        childName: user.displayName,
        manageLink: this.url('/guardian/manage', manage),
        expiresInHours: this.settings.guardianLinkTtlHours(),
        supportEmail: this.config.supportEmail,
      })
    } catch (e) {
      // Consent is already recorded. The parent can ask for another manage link. The confirm link stays spent.
      this.log.warn(`guardian follow-up for ${userId} was not sent: ${(e as Error).name}`)
    }
  }

  /** Spends a manage link. The caller then opens one session. */
  async consumeManage(token: string): Promise<{ userId: string }> {
    return this.consume(token, 'MANAGE')
  }

  /** A manage session. It can be presented until it expires; it is not single-use. */
  async openSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const ttl = this.settings.guardianManageSessionMinutes() * 60_000
    const token = await this.issue(userId, 'SESSION', ttl)
    return { token, expiresAt: new Date(Date.now() + ttl) }
  }

  /** The account a live manage session names, or a validation error. */
  async sessionUserId(token: string): Promise<string> {
    const claims = readGuardianToken(this.config.codeHmacSecret, token)
    if (!claims || claims.purpose !== 'SESSION' || claims.exp <= Date.now()) throw Errors.validation(INVALID_LINK)
    const row = await this.db.guardianLink.findUnique({ where: { tokenHash: sha256(token) } })
    if (!row || row.purpose !== 'SESSION' || row.usedAt || row.expiresAt <= new Date() || row.userId !== claims.userId) throw Errors.validation(INVALID_LINK)
    return row.userId
  }

  private async sendNotice(userId: string): Promise<void> {
    const parent = await this.parentOf(userId)
    if (!parent) return
    const ttl = this.linkTtlMs()
    const hours = this.settings.guardianLinkTtlHours()
    const manage = await this.issue(userId, 'MANAGE', ttl)
    const confirm = this.settings.emailPlusEnabled() ? await this.issue(userId, 'CONFIRM', ttl) : null
    await this.mailer.send(parent.email, 'guardianNotice', {
      childName: parent.childName,
      noticeVersion: parent.noticeVersion,
      confirmLink: confirm ? this.url('/guardian/confirm', confirm) : null,
      manageLink: this.url('/guardian/manage', manage),
      collects: [...GUARDIAN_NOTICE_COLLECTS],
      why: GUARDIAN_NOTICE_WHY,
      processors: [...GUARDIAN_NOTICE_PROCESSORS],
      expiresInHours: hours,
      supportEmail: this.config.supportEmail,
    })
  }

  private async parentOf(userId: string): Promise<{ email: string; childName: string; noticeVersion: string } | null> {
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { displayName: true } })
    const consent = await this.db.guardianConsent.findFirst({ where: { userId, parentEmail: { not: null } }, orderBy: { recordedAt: 'desc' } })
    if (!user || !consent?.parentEmail) return null
    return { email: consent.parentEmail, childName: user.displayName, noticeVersion: consent.noticeVersion }
  }

  /** Re-sending replaces any unused link of the same purpose, so only the latest one works. */
  private async issue(userId: string, purpose: GuardianLinkPurpose, ttlMs: number): Promise<string> {
    const exp = Date.now() + ttlMs
    const token = signGuardianToken(this.config.codeHmacSecret, { userId, purpose, exp, jti: randomToken() })
    const now = new Date()
    await this.db.$transaction([
      this.db.guardianLink.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } }),
      this.db.guardianLink.create({ data: { id: newId(), userId, purpose, tokenHash: sha256(token), expiresAt: new Date(exp) } }),
    ])
    return token
  }

  private async consume(token: string, purpose: 'CONFIRM' | 'MANAGE'): Promise<{ userId: string }> {
    const claims = readGuardianToken(this.config.codeHmacSecret, token)
    if (!claims || claims.purpose !== purpose || claims.exp <= Date.now()) throw Errors.validation(INVALID_LINK)
    const now = new Date()
    const row = await this.db.guardianLink.findUnique({ where: { tokenHash: sha256(token) } })
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= now || row.userId !== claims.userId) throw Errors.validation(INVALID_LINK)
    const { count } = await this.db.guardianLink.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    if (count !== 1) throw Errors.validation(INVALID_LINK)
    return { userId: row.userId }
  }

  private async limit(userId: string, kind: 'confirm' | 'manage'): Promise<void> {
    const hit = await this.limiter.hit(`guardian-${kind}:${userId}`, { max: this.settings.guardianLinkResendPerHour(), windowSeconds: 60 * 60 })
    if (!hit.allowed) throw Errors.rateLimited(hit.retryAfter, 'Too many parent emails. Try again later.')
  }

  private linkTtlMs(): number {
    return this.settings.guardianLinkTtlHours() * 3_600_000
  }

  private url(path: string, token: string): string {
    const url = new URL(path, this.config.webUrl)
    url.searchParams.set('token', token)
    return url.toString()
  }
}

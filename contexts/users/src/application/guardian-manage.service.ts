import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { GUARDIAN_CONSENT_AUTO_UNVERIFIED, hasVerifiedGuardianConsent } from '../domain/guardian-consent'
import { GUARDIAN_CONSENT_WITHDRAWN_REASON } from '../domain/guardian-verification'
import { ageOf } from '../domain/rules'
import { AGE_FIELDS } from './age'
import { AccountDeletionService } from './account-deletion.service'
import { DataExportService } from './data-export.service'
import { GuardianNoticeService } from './guardian-notice.service'
import { PolicyService } from './policy.service'
import { SessionService } from './session.service'
import { PlatformSettingsStore } from './platform-settings.store'

export interface GuardianChildSummary {
  displayName: string
  ageYears: number | null
  ageBand: string
  noticeVersion: string
  consentMethod: string
  consentVerified: boolean
  /** The stored parent choice. It takes effect only while consentVerified is true and the band is under_13. */
  socialEnabled: boolean
  accountStatus: string
  notes: number
  files: number
  deletionScheduledFor: Date | null
}

/**
 * What a parent can do with a manage session (ADR-0110): see a count summary, ask for the existing data export,
 * withdraw consent, or delete the account. The web page that calls these comes later. No note text is returned.
 */
@Injectable()
export class GuardianManageService {
  constructor(
    private readonly db: PrismaService,
    private readonly notice: GuardianNoticeService,
    private readonly deletion: AccountDeletionService,
    private readonly exports: DataExportService,
    private readonly policy: PolicyService,
    private readonly sessions: SessionService,
    private readonly settings: PlatformSettingsStore,
  ) {}

  /** One use of the manage link. Later calls in this session use the returned token. */
  async redeem(token: string): Promise<{ sessionToken: string; expiresAt: Date; summary: GuardianChildSummary }> {
    const { userId } = await this.notice.consumeManage(token)
    const session = await this.notice.openSession(userId)
    return { sessionToken: session.token, expiresAt: session.expiresAt, summary: await this.summaryOf(userId) }
  }

  async summary(sessionToken: string): Promise<GuardianChildSummary> {
    return this.summaryOf(await this.notice.sessionUserId(sessionToken))
  }

  /** The same export the account holder can ask for. One a day, ready within the usual job. */
  async requestExport(sessionToken: string) {
    const userId = await this.notice.sessionUserId(sessionToken)
    return this.exports.request(userId)
  }

  async listExports(sessionToken: string) {
    return this.exports.list(await this.notice.sessionUserId(sessionToken))
  }

  /**
   * Puts the consent row back to `auto_unverified` and clears `verifiedAt`, so restricted-minor limits apply again.
   * Outstanding confirm links are spent. Access is suspended only when an admin requires consent for access.
   */
  async withdraw(sessionToken: string): Promise<GuardianChildSummary> {
    const userId = await this.notice.sessionUserId(sessionToken)
    const now = new Date()
    await this.db.$transaction([
      this.db.guardianConsent.updateMany({ where: { userId }, data: { method: GUARDIAN_CONSENT_AUTO_UNVERIFIED, verifiedAt: null, socialEnabled: false } }),
      this.db.guardianLink.updateMany({ where: { userId, purpose: 'CONFIRM', usedAt: null }, data: { usedAt: now } }),
    ])
    if (this.settings.consentRequiredForAccess()) {
      await this.policy.suspend(userId, new Date('9999-12-31T00:00:00.000Z'), GUARDIAN_CONSENT_WITHDRAWN_REASON)
      await this.sessions.revokeAll(userId)
    }
    return this.summaryOf(userId)
  }

  /**
   * Turns groups, classes, doubts, messages and public posts on or off for this child.
   * Only an under-13 account, and only after consent is verified. Withdrawing consent clears the choice.
   */
  async setSocialEnabled(sessionToken: string, enabled: boolean): Promise<GuardianChildSummary> {
    const userId = await this.notice.sessionUserId(sessionToken)
    const consent = await this.db.guardianConsent.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } })
    if (!consent) throw Errors.validation('This link is invalid or has expired. Ask for a new one.')
    const verified = hasVerifiedGuardianConsent([consent.method], this.settings.verificationSettings()) && (consent.method !== 'email_plus' || consent.verifiedAt !== null)
    if (!verified) throw Errors.validation('Confirm this account before changing social features.')
    if (consent.ageBand !== 'under_13') throw Errors.validation('This choice is for an under-13 account.')
    await this.db.guardianConsent.update({ where: { id: consent.id }, data: { socialEnabled: enabled } })
    return this.summaryOf(userId)
  }

  /** Schedules the minor purge. The word DELETE is required. The parent has no password to give. */
  async deleteAccount(sessionToken: string, confirm: string): Promise<Date> {
    const userId = await this.notice.sessionUserId(sessionToken)
    return this.deletion.requestByGuardian(userId, confirm)
  }

  private async summaryOf(userId: string): Promise<GuardianChildSummary> {
    const user = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { displayName: true, accountStatus: true, deletionRequestedAt: true, ...AGE_FIELDS },
    })
    const consent = await this.db.guardianConsent.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } })
    if (!user || !consent) throw Errors.validation('This link is invalid or has expired. Ask for a new one.')
    const [notes, files] = await Promise.all([
      this.db.note.count({ where: { ownerId: userId, deletedAt: null } }),
      this.db.fileObject.count({ where: { ownerId: userId, deletedAt: null } }),
    ])
    const verified = hasVerifiedGuardianConsent([consent.method], this.settings.verificationSettings())
    return {
      displayName: user.displayName,
      ageYears: ageOf(user),
      ageBand: consent.ageBand,
      noticeVersion: consent.noticeVersion,
      consentMethod: consent.method,
      // email_plus counts only after the click (verifiedAt) and only while the setting allows it.
      consentVerified: verified && (consent.method !== 'email_plus' || consent.verifiedAt !== null),
      socialEnabled: consent.socialEnabled === true,
      accountStatus: user.accountStatus,
      notes,
      files,
      deletionScheduledFor: user.deletionRequestedAt ? await this.deletion.scheduledFor(userId, user.deletionRequestedAt) : null,
    }
  }
}

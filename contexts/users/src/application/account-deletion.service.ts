import { Inject, Injectable, Logger } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { FILES, MAILER, type Files, type Mailer } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { GUARDIAN_CONSENT_UNDER } from '../domain/guardian-consent'
import { ageOf, type AgeFacts } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AuditService } from './audit.service'
import { MinorPurgeService } from './minor-purge.service'
import { PasswordService } from './password.service'
import { PlatformSettingsStore } from './platform-settings.store'
import { SessionService } from './session.service'
import { DEFAULT_MINOR_PURGE_WINDOW_DAYS } from '../domain/guardian-verification'

/** §8.4: how long a person may change their mind, and for how many nights after a deletion it is announced again. */
export const DELETION_GRACE_DAYS = 14
const ANNOUNCED_FOR_DAYS = 7
const DAY_MS = 86_400_000

/** When an account asked for deletion goes, or null when it has not asked. `graceDays` is 14 for an adult. */
export const deletionDate = (requestedAt: Date | null, graceDays = DELETION_GRACE_DAYS): Date | null =>
  requestedAt ? new Date(requestedAt.getTime() + graceDays * DAY_MS) : null

/**
 * Minors use the admin purge window (default 14 days). Adults keep the fixed 14-day grace, even when the minor
 * window is set to something else. An unknown age keeps the adult grace.
 */
export function graceDaysForAge(age: number | null, minorWindowDays: number): number {
  if (age !== null && age < GUARDIAN_CONSENT_UNDER) return minorWindowDays
  return DELETION_GRACE_DAYS
}

/**
 * Account deletion (ADR-0088). A person asks (their password, if the account has one, and the word DELETE); 14 days
 * later the nightly job deletes the account: the users context's own rows go and the user row becomes "Deleted user",
 * so public contributions keep an author; then `UserDeleted` tells every context to erase or anonymise its part. The
 * deletion is announced again for a week, and every eraser is idempotent, so a context that failed catches up.
 */
@Injectable()
export class AccountDeletionService {
  private readonly log = new Logger('AccountDeletion')

  constructor(
    private readonly db: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(FILES) private readonly files: Files,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
    private readonly settings?: PlatformSettingsStore,
    private readonly minorPurge?: MinorPurgeService,
  ) {}

  /** The date a request already stored will be purged, using the minor window when the account is still under 18. */
  async scheduledFor(userId: string, requestedAt: Date): Promise<Date> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true, declaredAge: true, ageDeclaredAt: true } })
    return deletionDate(requestedAt, graceDaysForAge(user ? ageOf(user) : null, this.minorWindowDays()))!
  }

  /** Asks for the account's deletion; every other session ends. Returns when it will go. */
  async request(userId: string, input: { password?: string | null; confirm: string }, sessionId: string): Promise<Date> {
    const user = await this.db.user.findUnique({ where: { id: userId } })
    if (!user || user.deletedAt) throw Errors.notFound('Account not found.')
    if (input.confirm.trim().toUpperCase() !== 'DELETE') throw Errors.validation('Type DELETE to confirm.', ['input', 'confirm'])
    if (user.passwordHash && !(await this.passwords.verify(user.passwordHash, input.password ?? ''))) throw Errors.validation('That password is not right.', ['input', 'password'])
    const requestedAt = user.deletionRequestedAt ?? new Date()
    if (!user.deletionRequestedAt) await this.db.user.update({ where: { id: userId }, data: { deletionRequestedAt: requestedAt } })
    // Whoever asked is the person, here: everywhere else is signed out.
    const others = await this.db.session.findMany({ where: { userId, revokedAt: null, familyId: { not: sessionId } }, select: { familyId: true }, distinct: ['familyId'] })
    for (const { familyId } of others) await this.sessions.revokeFamily(familyId, userId)
    await this.audit.record({ actorId: userId, action: 'account.deletion.request', targetType: 'USER', targetId: userId })
    const due = deletionDate(requestedAt, graceDaysForAge(ageOf(user), this.minorWindowDays()))!
    await this.mailer.send(user.email, 'accountDeletion', { displayName: user.displayName, deleteOn: due.toUTCString().slice(0, 16), link: `${this.config.webUrl}/profile` }).catch((e: Error) => this.log.warn(`deletion notice for ${userId} not sent: ${e.message}`))
    return due
  }

  /**
   * A parent deleting the child's account. There is no password to check; the manage session already proved the
   * link. The minor purge window applies when the account is under 18.
   */
  async requestByGuardian(userId: string, confirm: string): Promise<Date> {
    if (confirm.trim().toUpperCase() !== 'DELETE') throw Errors.validation('Type DELETE to confirm.', ['input', 'confirm'])
    const user = await this.db.user.findUnique({ where: { id: userId } })
    if (!user || user.deletedAt) throw Errors.notFound('Account not found.')
    const requestedAt = user.deletionRequestedAt ?? new Date()
    if (!user.deletionRequestedAt) await this.db.user.update({ where: { id: userId }, data: { deletionRequestedAt: requestedAt } })
    await this.sessions.revokeAll(userId)
    await this.audit.record({ actorId: null, action: 'account.deletion.guardian', targetType: 'USER', targetId: userId })
    // The manage session's answer is the date. The child's own request still emails the child.
    return deletionDate(requestedAt, graceDaysForAge(ageOf(user), this.minorWindowDays()))!
  }

  async cancel(userId: string): Promise<void> {
    const { count } = await this.db.user.updateMany({ where: { id: userId, deletedAt: null, deletionRequestedAt: { not: null } }, data: { deletionRequestedAt: null } })
    if (count) await this.audit.record({ actorId: userId, action: 'account.deletion.cancel', targetType: 'USER', targetId: userId })
  }

  /** The nightly `delete-accounts` job: accounts past their grace are deleted, and recent deletions announced again. */
  async deleteDue(now = new Date()): Promise<{ deleted: number; announced: number }> {
    const pending = await this.db.user.findMany({
      where: { deletedAt: null, deletionRequestedAt: { not: null } },
      select: { id: true, deletionRequestedAt: true, dateOfBirth: true, declaredAge: true, ageDeclaredAt: true },
    })
    const window = this.minorWindowDays()
    const due = pending.filter((user) => user.deletionRequestedAt! <= new Date(now.getTime() - graceDaysForAge(ageOf(user), window) * DAY_MS))
    for (const { id } of due) {
      await this.erase(id, now)
      await this.events.publish('UserDeleted', { userId: id })
    }
    const recent = await this.db.user.findMany({ where: { deletedAt: { gte: new Date(now.getTime() - ANNOUNCED_FOR_DAYS * DAY_MS), lt: now }, id: { notIn: due.map((u) => u.id) } }, select: { id: true } })
    for (const { id } of recent) await this.events.publish('UserDeleted', { userId: id })
    return { deleted: due.length, announced: recent.length }
  }

  /**
   * ADR-0091: an account a sign-in provider created whose own registration answer was below the minimum age. It never
   * finished registering, so it holds nothing; it goes now, without the grace, and every context is told as usual. A
   * finished account is never erased this way.
   */
  async eraseRefused(userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { registrationCompletedAt: true, deletedAt: true } })
    if (!user || user.deletedAt || user.registrationCompletedAt) return
    await this.audit.record({ actorId: userId, action: 'account.refused.under_minimum_age', targetType: 'USER', targetId: userId })
    await this.erase(userId, new Date())
    await this.events.publish('UserDeleted', { userId })
  }

  /** The users context's part: every row about the person goes; the user row stays as "Deleted user". */
  private async erase(userId: string, now: Date): Promise<void> {
    await this.sessions.revokeAll(userId)
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarFileId: true, dateOfBirth: true, declaredAge: true, ageDeclaredAt: true } })
    // Before the provider rows go: the purge needs the Firebase uid. Adults keep the previous erase.
    if (this.minorPurge && isMinor(user)) await this.minorPurge.purge(userId)
    const [exports, verifications] = await Promise.all([
      this.db.dataExport.findMany({ where: { userId, fileId: { not: null } }, select: { fileId: true } }),
      this.db.verificationRequest.findMany({ where: { userId }, select: { documentIds: true } }),
    ])
    const fileIds = [...exports.map((e) => e.fileId!), ...verifications.flatMap((v) => v.documentIds), ...(user.avatarFileId ? [user.avatarFileId] : [])]
    if (fileIds.length) await this.files.delete(fileIds)
    await this.db.$transaction([
      this.db.session.deleteMany({ where: { userId } }),
      this.db.oAuthAccount.deleteMany({ where: { userId } }),
      this.db.emailToken.deleteMany({ where: { userId } }),
      this.db.institutionalEmail.deleteMany({ where: { userId } }),
      this.db.membership.deleteMany({ where: { userId } }),
      this.db.consentRecord.deleteMany({ where: { userId } }),
      // GuardianConsent stays. Clear the parent email so the kept row has no address (ADR-0109, ADR-0110).
      this.db.guardianConsent.updateMany({ where: { userId }, data: { parentEmail: null } }),
      this.db.guardianLink.deleteMany({ where: { userId } }),
      this.db.firebaseInstallation.deleteMany({ where: { userId } }),

      this.db.dataExport.deleteMany({ where: { userId } }),
      this.db.verificationRequest.deleteMany({ where: { userId } }),
      this.db.studentProfile.deleteMany({ where: { userId } }),
      this.db.teacherSkill.deleteMany({ where: { userId } }),
      this.db.externalIdentity.deleteMany({ where: { userId } }),
      this.db.teacherProfile.deleteMany({ where: { userId } }),
      this.db.userPlan.deleteMany({ where: { userId } }),
      this.db.legacyImport.deleteMany({ where: { userId } }),
      this.db.usageEvent.deleteMany({ where: { userId } }),
      this.db.errorEvent.updateMany({ where: { userId }, data: { userId: null } }),
      this.db.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followeeId: userId }] } }),
      this.db.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
      this.db.restriction.deleteMany({ where: { OR: [{ restricterId: userId }, { restrictedId: userId }] } }),
      this.db.connection.deleteMany({ where: { OR: [{ userLowId: userId }, { userHighId: userId }] } }),
      this.db.connectionRequest.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
      this.db.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@deleted.learnvianotes.invalid`,
          handle: `deleted-${userId.replace(/-/g, '').slice(0, 20)}`,
          displayName: 'Deleted user',
          passwordHash: null,
          emailVerifiedAt: null,
          dateOfBirth: null,
          declaredAge: null,
          ageDeclaredAt: null,
          verifiedAt: null,
          verificationMethod: null,
          globalRole: 'STUDENT',
          analyticsOptOut: true,
          avatarFileId: null,
          suspendedUntil: null,
          suspensionReason: null,
          accountStatus: 'ACTIVE',
          statusReason: null,
          deletedAt: now,
        },
      }),
    ])
    await this.audit.record({ actorId: null, action: 'account.deleted', targetType: 'USER', targetId: userId })
  }

  /**
   * A platform admin's permanent delete. PII is anonymised the same way as a person's own deletion, files in object
   * storage go with it, sessions end, and the only leftover of the address is a hashed tombstone.
   */
  async adminErase(userId: string, adminId: string, reason: string, emailHash: string): Promise<void> {
    const now = new Date()
    await this.db.accountTombstone.create({ data: { id: newId(), userId, emailHash, adminId, reason, deletedAt: now } })
    await this.audit.record({ actorId: adminId, action: 'account.admin.deleted', targetType: 'USER', targetId: userId, metadata: { reason, emailHash } })
    await this.erase(userId, now)
    await this.events.publish('UserDeleted', { userId })
  }

  private minorWindowDays(): number {
    return this.settings?.minorPurgeWindowDays() ?? DEFAULT_MINOR_PURGE_WINDOW_DAYS
  }
}

function isMinor(facts: AgeFacts): boolean {
  const age = ageOf(facts)
  return age !== null && age < GUARDIAN_CONSENT_UNDER
}

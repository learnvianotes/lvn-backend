import { Inject, Injectable, Logger } from '@nestjs/common'
import { AUDIENCE, type Audience } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { isStudyPublisher } from '../domain/study-publisher'

/** One audience upsert per account. The API enqueues; apps/worker talks to Resend. */
export const USERS_AUDIENCE_QUEUE = 'users.audience-sync'

/** First word is the given name; the rest is the family name. A single word leaves the family name empty. */
export function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
}

/**
 * Adds every registered, active account to the product-email audience, and takes the contact off when the account
 * is deleted or its email changes. `audienceSyncedAt` is set only after a successful upsert, so a retry is safe and
 * a second run does not call Resend again. The study publisher is never added. A missing audience configuration
 * skips the call and leaves the marker unset.
 */
@Injectable()
export class AudienceSyncService {
  private readonly log = new Logger('AudienceSync')

  constructor(
    private readonly db: PrismaService,
    private readonly queues: Queues,
    @Inject(AUDIENCE) private readonly audience: Audience,
  ) {}

  /** Best-effort, at the same moment as the welcome email. A failed enqueue does not fail registration. */
  async schedule(userId: string): Promise<void> {
    await this.enqueue('sync', { userId }, `audience-sync-${userId}`)
  }

  /** The address captured before the account row is anonymised. */
  async scheduleRemoval(email: string): Promise<void> {
    const trimmed = email.trim()
    if (!trimmed || trimmed.endsWith('@deleted.learnvianotes.invalid')) return
    await this.enqueue('remove', { email: trimmed }, `audience-remove-${trimmed.toLowerCase()}`)
  }

  /** Removes the old address and upserts the new one. */
  async scheduleEmailChange(userId: string, previousEmail: string): Promise<void> {
    await this.enqueue('email-changed', { userId, previousEmail }, `audience-email-${userId}-${previousEmail.trim().toLowerCase()}`)
  }

  /** The worker's sync job. */
  async sync(userId: string): Promise<'synced' | 'skipped'> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, deletedAt: true, accountStatus: true, registrationCompletedAt: true, audienceSyncedAt: true },
    })
    if (!user || !this.eligible(user) || user.audienceSyncedAt) return 'skipped'
    if (!this.audience.enabled) return 'skipped'
    await this.audience.upsert(await this.contact(user.id, user.email, user.displayName))
    await this.db.user.updateMany({
      where: { id: userId, audienceSyncedAt: null, deletedAt: null, accountStatus: 'ACTIVE', registrationCompletedAt: { not: null } },
      data: { audienceSyncedAt: new Date() },
    })
    return 'synced'
  }

  async removeContact(email: string): Promise<'removed' | 'skipped'> {
    if (!this.audience.enabled) return 'skipped'
    await this.audience.remove(email)
    return 'removed'
  }

  async emailChanged(userId: string, previousEmail: string): Promise<'updated' | 'skipped'> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, deletedAt: true, accountStatus: true, registrationCompletedAt: true },
    })
    if (!this.audience.enabled) return 'skipped'
    const previous = previousEmail.trim()
    if (previous && previous.toLowerCase() !== user?.email.toLowerCase()) await this.audience.remove(previous)
    if (!user || !this.eligible(user)) return 'updated'
    await this.audience.upsert(await this.contact(user.id, user.email, user.displayName))
    await this.db.user.update({ where: { id: userId }, data: { audienceSyncedAt: new Date() } })
    return 'updated'
  }

  private eligible(user: { id: string; email: string; deletedAt: Date | null; accountStatus: string; registrationCompletedAt: Date | null }): boolean {
    if (user.deletedAt || !user.registrationCompletedAt) return false
    if (user.accountStatus !== 'ACTIVE') return false
    return !isStudyPublisher(user)
  }

  private async contact(userId: string, email: string, displayName: string) {
    const row = await this.db.notificationSettings.findUnique({ where: { userId }, select: { productEmails: true } })
    const names = splitDisplayName(displayName)
    return { email, ...names, unsubscribed: row?.productEmails === false }
  }

  private async enqueue(name: string, data: object, jobId: string): Promise<void> {
    try {
      await this.queues.queue(USERS_AUDIENCE_QUEUE).add(name, data, { jobId })
    } catch (e) {
      const message = (e as Error).message ?? ''
      if (/already exists|JobId/i.test(message)) return
      this.log.warn(`audience job ${name} was not queued: ${(e as Error).name}`)
    }
  }
}

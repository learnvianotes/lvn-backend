import { Inject, Injectable, Logger } from '@nestjs/common'
import { MAILER, type Mailer } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { methodsFromConsentRows } from '../domain/guardian-consent'
import { isRestrictedMinor } from '../domain/rules'
import { isStudyPublisher } from '../domain/study-publisher'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AGE_FIELDS } from './age'
import { PlatformSettingsStore } from './platform-settings.store'

/** One welcome email per account. The API enqueues; apps/worker sends. */
export const USERS_WELCOME_QUEUE = 'users.welcome'

/** What an adult account can do. A restricted minor is not told they can share notes publicly (§15.2). */
const WELCOME_LINES = ['Read and find notes', 'Write your own notes and share them', 'Join groups and classrooms']
const RESTRICTED_LINES = ['Read and find notes', 'Write your own notes', 'Join groups and classrooms']

/**
 * The welcome email, sent when a person first gives their name and age (`signUp`, or `completeRegistration` for an
 * account a provider created). The request only enqueues. The worker sends, and the queue retries with its usual
 * backoff. A mail or Redis failure never fails the registration that already committed.
 *
 * Sent once. `welcomeEmailSentAt` is claimed before the send and released if the send fails, so a retry can try
 * again and a second job cannot send another. Profile edits and later sign-ins do not enqueue.
 *
 * This is account mail, not a notification category (ADR-0050). Class announcements and the weekly digest keep
 * their own switches and are not consulted. There is no suppression list. The send still requires the Terms and
 * Privacy consent written at registration, and an ACTIVE account. An age-blocked account is skipped. Nothing here
 * logs an email address.
 */
@Injectable()
export class WelcomeEmailService {
  private readonly log = new Logger('WelcomeEmail')

  constructor(
    private readonly db: PrismaService,
    private readonly queues: Queues,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly settings: PlatformSettingsStore,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** Best-effort. A failed enqueue leaves the account as it is; the marker stays unset. */
  async schedule(userId: string): Promise<void> {
    try {
      await this.queues.queue(USERS_WELCOME_QUEUE).add('welcome', { userId }, { jobId: `welcome-${userId}` })
    } catch (e) {
      const message = (e as Error).message ?? ''
      // A job with this id is already waiting, running or kept after it finished. That one send is enough.
      if (/already exists|JobId/i.test(message)) return
      this.log.warn(`welcome email was not queued for ${userId}: ${(e as Error).name}`)
    }
  }

  /** The worker's job. Throws only when a send was attempted and failed, so the queue retries it. */
  async deliver(userId: string): Promise<'sent' | 'skipped'> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        deletedAt: true,
        accountStatus: true,
        registrationCompletedAt: true,
        welcomeEmailSentAt: true,
        ...AGE_FIELDS,
        consents: { select: { kind: true } },
        guardianConsents: { select: { method: true } },
      },
    })
    if (!user || !this.eligible(user)) return 'skipped'

    const claimedAt = new Date()
    const claimed = await this.db.user.updateMany({
      where: { id: userId, welcomeEmailSentAt: null, deletedAt: null, registrationCompletedAt: { not: null }, accountStatus: 'ACTIVE' },
      data: { welcomeEmailSentAt: claimedAt },
    })
    if (claimed.count !== 1) return 'skipped'

    const origin = this.config.webUrl.replace(/\/$/, '')
    const minor = isRestrictedMinor(user, this.settings.consentAge(), methodsFromConsentRows(user))
    try {
      await this.mailer.send(user.email, 'welcome', {
        displayName: user.displayName,
        appLink: origin,
        guideLink: `${origin}/guide`,
        lines: minor ? RESTRICTED_LINES : WELCOME_LINES,
      })
      return 'sent'
    } catch (e) {
      await this.release(userId, claimedAt)
      throw e
    }
  }

  /** Terms and Privacy were accepted, the account can be used, and no welcome has been claimed. */
  private eligible(user: {
    id: string
    email: string
    deletedAt: Date | null
    accountStatus: string
    registrationCompletedAt: Date | null
    welcomeEmailSentAt: Date | null
    consents: { kind: string }[]
  }): boolean {
    if (user.welcomeEmailSentAt || user.deletedAt || !user.registrationCompletedAt) return false
    if (user.accountStatus !== 'ACTIVE') return false
    if (isStudyPublisher(user)) return false
    const kinds = new Set(user.consents.map((c) => c.kind))
    return kinds.has('TERMS') && kinds.has('PRIVACY')
  }

  /** Lets a failed send be tried again. A claim we no longer hold is left alone. */
  private async release(userId: string, claimedAt: Date): Promise<void> {
    try {
      await this.db.user.updateMany({ where: { id: userId, welcomeEmailSentAt: claimedAt }, data: { welcomeEmailSentAt: null } })
    } catch (e) {
      this.log.warn(`welcome claim for ${userId} was not released: ${(e as Error).name}`)
    }
  }
}

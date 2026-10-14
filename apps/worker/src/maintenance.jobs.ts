import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { COMMS_EMAIL_QUEUE, COMMS_PUSH_QUEUE, DevicesService, EmailNotificationsService, NotificationService, PushService } from '@lvn-backend/communication'
import { ExamsService, FocusService, LEARNING_ANALYTICS_QUEUE, LearningEventsService, RecommendationsService, RhythmService, WorkspacesService, CORE_GITHUB_QUEUE, GitHubAppService, CORE_ENGAGEMENT_QUEUE, AchievementsService, DailyLineService } from '@lvn-backend/core'
import { NotesMaintenance } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'
import { UsersMaintenance } from '@lvn-backend/users'

export const USERS_MAINTENANCE_QUEUE = 'users.maintenance'
export const NOTES_MAINTENANCE_QUEUE = 'notes.maintenance'
export const COMMS_MAINTENANCE_QUEUE = 'comms.maintenance'
export const CORE_MAINTENANCE_QUEUE = 'core.maintenance'

/** Scheduled housekeeping (§9.1). Every schedule is UTC and idempotent, so restarts and several workers are safe. */
@Injectable()
export class MaintenanceJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Maintenance')

  constructor(
    private readonly queues: Queues,
    private readonly users: UsersMaintenance,
    private readonly notes: NotesMaintenance,
    private readonly notifications: NotificationService,
    private readonly workspaces: WorkspacesService,
    private readonly githubApp: GitHubAppService,
    private readonly achievements: AchievementsService,
    private readonly dailyLines: DailyLineService,
    private readonly learning: LearningEventsService,
    private readonly rhythm: RhythmService,
    private readonly exams: ExamsService,
    private readonly recommendations: RecommendationsService,
    private readonly focus: FocusService,
    private readonly push: PushService,
    private readonly devices: DevicesService,
    private readonly emails: EmailNotificationsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.queues.process(USERS_MAINTENANCE_QUEUE, {
      // ADR-0019: identity documents are deleted 30 days after the decision.
      'purge-verification-documents': async () => {
        const purged = await this.users.purgeVerificationDocuments()
        this.log.log(`purged documents of ${purged} decided verification requests`)
        return { purged }
      },
    })
    await this.queues.repeat(USERS_MAINTENANCE_QUEUE, 'purge-verification-documents', '15 3 * * *')

    this.queues.process(NOTES_MAINTENANCE_QUEUE, {
      // §4.3: public notes keep every published version, others their newest 50.
      'prune-versions': async () => {
        const pruned = await this.notes.pruneVersions()
        this.log.log(`pruned ${pruned} note versions`)
        return { pruned }
      },
      // §4.5: the trash keeps notes for 30 days.
      // §13.2: sync answers are kept 30 days.
      'prune-sync-log': async () => ({ pruned: await this.notes.pruneSyncLog() }),
      'empty-trash': async () => {
        const deleted = await this.notes.emptyTrash()
        this.log.log(`deleted ${deleted} notes from the trash`)
        return { deleted }
      },
    })
    await this.queues.repeat(NOTES_MAINTENANCE_QUEUE, 'prune-versions', '30 3 * * *')
    await this.queues.repeat(NOTES_MAINTENANCE_QUEUE, 'empty-trash', '45 3 * * *')
    await this.queues.repeat(NOTES_MAINTENANCE_QUEUE, 'prune-sync-log', '50 3 * * *')

    this.queues.process(COMMS_MAINTENANCE_QUEUE, {
      // ADR-0042: read notifications are kept 90 days, unread ones a year.
      'prune-notifications': async () => {
        const pruned = await this.notifications.prune()
        this.log.log(`pruned ${pruned} notifications`)
        return { pruned }
      },
      // ADR-0050: phones not seen for 60 days.
      'prune-devices': async () => ({ pruned: await this.devices.pruneStale() }),
      // ADR-0050: Mondays, 09:00 in India.
      'weekly-digest': async () => ({ sent: await this.emails.sendDigests() }),
    })
    await this.queues.repeat(COMMS_MAINTENANCE_QUEUE, 'prune-notifications', '55 3 * * *')
    await this.queues.repeat(COMMS_MAINTENANCE_QUEUE, 'prune-devices', '0 4 * * *')
    await this.queues.repeat(COMMS_MAINTENANCE_QUEUE, 'weekly-digest', '30 3 * * 1')

    // ADR-0050: one job per notification and per announcement email; retried by the queue.
    this.queues.process(COMMS_PUSH_QUEUE, { send: async (data) => ({ sent: await this.push.deliver((data as { notificationId: string }).notificationId) }) }, 4)
    this.queues.process(COMMS_EMAIL_QUEUE, { 'classroom-post': async (data) => ({ sent: await this.emails.sendClassroomPost((data as { postId: string }).postId, (data as { userId: string }).userId) }) }, 4)

    this.queues.process(CORE_MAINTENANCE_QUEUE, {
      // ADR-0048: project workspaces' repository details from the providers' public APIs, at most a day old.
      'refresh-repositories': async () => {
        const refreshed = await this.workspaces.refreshStale()
        this.log.log(`refreshed ${refreshed} repositories`)
        return { refreshed }
      },
      // ADR-0067: learning events' partitions three months ahead; ids seen over 30 days ago; partitions past 24 months.
      // ADR-0069: last week, closed with the target it had, for everyone who learned in it (hourly, as weeks end at
      // 04:00 on Monday in each person's own zone; a week closed already is skipped).
      'close-rhythm-weeks': async () => ({ closed: await this.rhythm.closeLastWeeks() }),
      // ADR-0070: from 18:00 in each person's zone, one reminder of an exam's revision task left today.
      'remind-exam-tasks': async () => ({ sent: await this.exams.remind() }),
      // ADR-0071: everyone active in the last 7 days gets fresh recommendations.
      'compute-recommendations': async () => ({ people: await this.recommendations.computeActive() }),
      // ADR-0072: focus sessions left open past their work and rest end at their planned length.
      'close-focus-sessions': async () => ({ closed: await this.focus.closeAbandoned() }),
      'learning-partitions': async () => {
        const done = await this.learning.maintain()
        this.log.log(`learning events: ${done.made} partitions made, ${done.forgotten} ids forgotten, ${done.dropped.length} partitions dropped`)
        return done
      },
    })
    // ADR-0078: GitHub App deliveries into repository activity, one at a time; old deliveries dropped daily.
    this.queues.process(CORE_GITHUB_QUEUE, {
      handle: async (data) => ({ events: await this.githubApp.handle((data as { deliveryId: string }).deliveryId) }),
      'purge-deliveries': async () => ({ purged: await this.githubApp.purgeDeliveries() }),
    })
    // Achievements (ADR-0080): checked again for one person a little after their learning or their points changed.
    // Home's line for the day (ADR-0087): written by AI the first time a person opens Home on a learning day.
    this.queues.process(
      CORE_ENGAGEMENT_QUEUE,
      {
        evaluate: async (data) => ({ awarded: (await this.achievements.evaluate((data as { userId: string }).userId)).length }),
        'daily-line': async (data) => ({ written: await this.dailyLines.write((data as { userId: string }).userId, (data as { day: string }).day) }),
      },
      2,
    )
    await this.queues.repeat(CORE_GITHUB_QUEUE, 'purge-deliveries', '50 4 * * *')
    await this.queues.repeat(CORE_MAINTENANCE_QUEUE, 'refresh-repositories', '5 4 * * *')
    await this.queues.repeat(CORE_MAINTENANCE_QUEUE, 'learning-partitions', '10 4 * * *')
    await this.queues.repeat(CORE_MAINTENANCE_QUEUE, 'close-rhythm-weeks', '25 * * * *')
    await this.queues.repeat(CORE_MAINTENANCE_QUEUE, 'remind-exam-tasks', '5 * * * *')
    await this.queues.repeat(CORE_MAINTENANCE_QUEUE, 'compute-recommendations', '35 * * * *')
    await this.queues.repeat(CORE_MAINTENANCE_QUEUE, 'close-focus-sessions', '*/15 * * * *')
    // ADR-0067: the pseudonymous copy for PostHog, queued only when it is configured; retried by the queue.
    this.queues.process(LEARNING_ANALYTICS_QUEUE, { copy: async (data) => ({ sent: await this.learning.copyToAnalytics((data as { userId: string }).userId, (data as { eventIds: string[] }).eventIds) }) }, 2)
  }
}

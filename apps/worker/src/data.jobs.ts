import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { NOTES_IMPORT_QUEUE, NoteImportService } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'
import { AudienceSyncService, DataExportService, SkillsImportService, USERS_AUDIENCE_QUEUE, USERS_EXPORT_QUEUE, USERS_SKILLS_QUEUE, USERS_WELCOME_QUEUE, WelcomeEmailService } from '@lvn-backend/users'

/**
 * Settings → Data (ADR-0018): exports built when asked for and deleted after 7 days; imports of notes. Teachers' skills
 * imported from proven identifiers, and checked and read again monthly (ADR-0077).
 */
@Injectable()
export class DataJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Data')

  constructor(
    private readonly queues: Queues,
    private readonly exports: DataExportService,
    private readonly imports: NoteImportService,
    private readonly skills: SkillsImportService,
    private readonly welcome: WelcomeEmailService,
    private readonly audience: AudienceSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.queues.process(USERS_EXPORT_QUEUE, {
      'build-export': async (data) => {
        await this.exports.build((data as { exportId: string }).exportId)
        return { exportId: (data as { exportId: string }).exportId }
      },
      'expire-exports': async () => {
        const expired = await this.exports.expire()
        this.log.log(`deleted ${expired} expired exports`)
        return { expired }
      },
    })
    await this.queues.repeat(USERS_EXPORT_QUEUE, 'expire-exports', '30 4 * * *')
    // GitHub's unauthenticated allowance is shared, so one import at a time.
    this.queues.process(
      USERS_SKILLS_QUEUE,
      {
        import: async (data) => {
          await this.skills.import((data as { identityId: string }).identityId)
          return { identityId: (data as { identityId: string }).identityId }
        },
        'refresh-due': async () => {
          const checked = await this.skills.refreshDue()
          this.log.log(`checked and read again ${checked} identifiers`)
          return { checked }
        },
      },
      1,
    )
    await this.queues.repeat(USERS_SKILLS_QUEUE, 'refresh-due', '40 4 * * *')
    // One welcome email, after a person first gives their name and age. Retried by the queue; the marker stops a second send.
    this.queues.process(USERS_WELCOME_QUEUE, {
      welcome: async (data) => ({ result: await this.welcome.deliver((data as { userId: string }).userId) }),
    })
    // Upsert, remove or move a product-email contact. Retried by the queue; audienceSyncedAt stops a second upsert.
    this.queues.process(USERS_AUDIENCE_QUEUE, {
      sync: async (data) => ({ result: await this.audience.sync((data as { userId: string }).userId) }),
      remove: async (data) => ({ result: await this.audience.removeContact((data as { email: string }).email) }),
      'email-changed': async (data) => {
        const job = data as { userId: string; previousEmail: string }
        return { result: await this.audience.emailChanged(job.userId, job.previousEmail) }
      },
    })
    this.queues.process(NOTES_IMPORT_QUEUE, {
      'run-import': async (data, job) => {
        const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
        await this.imports.run((data as { importId: string }).importId, lastAttempt)
        return { importId: (data as { importId: string }).importId }
      },
    })
  }
}

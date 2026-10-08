import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { NotesMaintenance } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'
import { UsersMaintenance } from '@lvn-backend/users'

export const USERS_MAINTENANCE_QUEUE = 'users.maintenance'
export const NOTES_MAINTENANCE_QUEUE = 'notes.maintenance'

/** Scheduled housekeeping (§9.1). Every schedule is UTC and idempotent, so restarts and several workers are safe. */
@Injectable()
export class MaintenanceJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Maintenance')

  constructor(
    private readonly queues: Queues,
    private readonly users: UsersMaintenance,
    private readonly notes: NotesMaintenance,
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
      'empty-trash': async () => {
        const deleted = await this.notes.emptyTrash()
        this.log.log(`deleted ${deleted} notes from the trash`)
        return { deleted }
      },
    })
    await this.queues.repeat(NOTES_MAINTENANCE_QUEUE, 'prune-versions', '30 3 * * *')
    await this.queues.repeat(NOTES_MAINTENANCE_QUEUE, 'empty-trash', '45 3 * * *')
  }
}

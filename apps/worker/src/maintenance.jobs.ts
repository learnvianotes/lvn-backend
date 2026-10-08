import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { Queues } from '@lvn-backend/queue'
import { UsersMaintenance } from '@lvn-backend/users'

export const USERS_MAINTENANCE_QUEUE = 'users.maintenance'

/** Scheduled housekeeping (§9.1). Every schedule is UTC and idempotent, so restarts and several workers are safe. */
@Injectable()
export class MaintenanceJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Maintenance')

  constructor(
    private readonly queues: Queues,
    private readonly users: UsersMaintenance,
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
  }
}

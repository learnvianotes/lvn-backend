import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { Queues } from '@lvn-backend/queue'
import { DataExportService, USERS_EXPORT_QUEUE } from '@lvn-backend/users'

/** Data exports (ADR-0018): built when asked for, deleted after 7 days. */
@Injectable()
export class ExportJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Export')

  constructor(
    private readonly queues: Queues,
    private readonly exports: DataExportService,
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
  }
}

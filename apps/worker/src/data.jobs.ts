import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { NOTES_IMPORT_QUEUE, NoteImportService } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'
import { DataExportService, USERS_EXPORT_QUEUE } from '@lvn-backend/users'

/** Settings → Data (ADR-0018): exports built when asked for and deleted after 7 days; imports of notes. */
@Injectable()
export class DataJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Data')

  constructor(
    private readonly queues: Queues,
    private readonly exports: DataExportService,
    private readonly imports: NoteImportService,
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
    this.queues.process(NOTES_IMPORT_QUEUE, {
      'run-import': async (data) => {
        await this.imports.run((data as { importId: string }).importId)
        return { importId: (data as { importId: string }).importId }
      },
    })
  }
}

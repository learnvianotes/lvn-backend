import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { FILE_SCAN_QUEUE, MediaProcessingService, NOTES_MEDIA_QUEUE } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'

/**
 * The media queue (§9.1, ADR-0041): each upload is scanned and processed (sizes, transcodes, facts), one at a time —
 * transcoding is the heaviest work the worker does. Nightly, storage is reconciled with the rows (§8.2).
 */
@Injectable()
export class MediaJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Media')

  constructor(
    private readonly queues: Queues,
    private readonly media: MediaProcessingService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.queues.process(
      NOTES_MEDIA_QUEUE,
      {
        'process-file': async (data, job) => this.media.process((data as { fileId: string }).fileId, job.attemptsMade + 1 >= (job.opts.attempts ?? 1)),
        'retry-pending-scans': async () => {
          const requeued = await this.media.requeuePending()
          if (requeued) this.log.log(`requeued ${requeued} files waiting for a scan`)
          return { requeued }
        },
        reconcile: async () => {
          const r = await this.media.reconcile()
          this.log.log(`reconciled ${r.objects} objects: ${r.orphanObjects.length} without a row, ${r.missingObjects.length} rows without their object`)
          return r
        },
      },
      1,
    )
    this.queues.process(
      FILE_SCAN_QUEUE,
      {
        scan: async (data, job) => {
          const body = data as { fileId?: string; userId?: string }
          const waitMs = job.processedOn && job.timestamp ? job.processedOn - job.timestamp : 0
          await this.media.handleScanJob(body, job.attemptsMade + 1 >= (job.opts.attempts ?? 1), waitMs)
        },
      },
      this.media.scanConcurrency(),
    )
    await this.queues.repeat(NOTES_MEDIA_QUEUE, 'reconcile', '40 3 * * *')
    // Files left pending while the scan service was down (ADR-0102).
    await this.queues.repeat(NOTES_MEDIA_QUEUE, 'retry-pending-scans', '*/2 * * * *')
  }
}

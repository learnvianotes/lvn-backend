import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common'
import { NOTES_SEARCH_QUEUE, SearchIndex } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'

/** Pause between turns when the outbox is empty, and after a failed turn. */
const IDLE_MS = 1_000
const RETRY_MS = 5_000

/**
 * Search (§9.1, §11, ADR-0055): the drainer that keeps both indexes in step with Postgres, runs here in a loop; when
 * the worker starts, Typesense gets any collection version it lacks; everything is marked again nightly as a safety net.
 */
@Injectable()
export class SearchJobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Search')
  private running = false
  private loop: Promise<void> | null = null

  constructor(
    private readonly queues: Queues,
    private readonly index: SearchIndex,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.queues.process(
      NOTES_SEARCH_QUEUE,
      {
        // Jobs queued by an older API: the outbox does this now.
        'index-note': async (data) => this.index.touch('NOTE', [(data as { noteId: string }).noteId]),
        'reindex-all': async () => {
          await this.index.reindexAll()
          this.log.log('marked every note, person and topic for re-indexing')
          return { ok: true }
        },
      },
      1,
    )
    await this.queues.repeat(NOTES_SEARCH_QUEUE, 'reindex-all', '15 4 * * *')
    this.running = true
    this.loop = this.run()
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false
    await this.loop
  }

  private async run(): Promise<void> {
    let ready = false
    while (this.running) {
      try {
        // Typesense may start after the worker: keep trying, while the Postgres index is kept meanwhile.
        if (!ready) {
          await this.index.ensureCollections().then(
            () => (ready = true),
            (e: Error) => this.log.warn(`Typesense is not ready (${e.message}); retrying`),
          )
        }
        const done = await this.index.drain()
        if (done < 500) await this.sleep(ready ? IDLE_MS : RETRY_MS)
      } catch (e) {
        this.log.error(`search indexing failed; retrying: ${(e as Error).message}`)
        await this.sleep(RETRY_MS)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

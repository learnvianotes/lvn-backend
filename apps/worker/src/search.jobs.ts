import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { NOTES_SEARCH_QUEUE, SearchIndex } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'

/** The search queue (§9.1, §10.4): notes are indexed when published, and everything again nightly as a safety net. */
@Injectable()
export class SearchJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('Search')

  constructor(
    private readonly queues: Queues,
    private readonly index: SearchIndex,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.queues.process(
      NOTES_SEARCH_QUEUE,
      {
        'index-note': async (data) => ({ result: await this.index.indexNote((data as { noteId: string }).noteId) }),
        'reindex-all': async () => {
          const indexed = await this.index.reindexAll()
          this.log.log(`reindexed ${indexed} notes`)
          return { indexed }
        },
      },
      5,
    )
    await this.queues.repeat(NOTES_SEARCH_QUEUE, 'reindex-all', '15 4 * * *')
  }
}

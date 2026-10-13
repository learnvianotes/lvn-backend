import { Injectable, type OnApplicationBootstrap } from '@nestjs/common'
import { AI_TASKS_QUEUE, AiTasksService, AskService } from '@lvn-backend/ai'
import { NOTES_CHUNKS_QUEUE, NoteChunks } from '@lvn-backend/notes'
import { Queues } from '@lvn-backend/queue'

/**
 * AI on the GPU (§9.1 `ai`): tasks (ADR-0059) and Ask AI questions (ADR-0060) share one lane, in arrival order, since
 * one GPU serves one local model (ADR-0058); chunks are embedded on their own lane, also one at a time, with a nightly
 * sweep for what was missed.
 */
@Injectable()
export class AiJobs implements OnApplicationBootstrap {
  constructor(
    private readonly queues: Queues,
    private readonly tasks: AiTasksService,
    private readonly ask: AskService,
    private readonly chunks: NoteChunks,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.queues.process(
      AI_TASKS_QUEUE,
      {
        run: async (data) => this.tasks.process((data as { artifactId: string }).artifactId),
        ask: async (data) => this.ask.process((data as { answerId: string }).answerId),
      },
      1,
    )
    this.queues.process(
      NOTES_CHUNKS_QUEUE,
      {
        'embed-note': async (data) => void (await this.chunks.embedNote((data as { noteId: string }).noteId)),
        'embed-missing': async () => void (await this.chunks.queueMissing()),
      },
      1,
    )
    await this.queues.repeat(NOTES_CHUNKS_QUEUE, 'embed-missing', '45 3 * * *')
  }
}

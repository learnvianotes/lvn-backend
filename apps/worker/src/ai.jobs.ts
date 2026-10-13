import { Injectable, type OnApplicationBootstrap } from '@nestjs/common'
import { AI_TASKS_QUEUE, AiTasksService } from '@lvn-backend/ai'
import { Queues } from '@lvn-backend/queue'

/** AI tasks (§9.1 `ai`, ADR-0059): one at a time, since one GPU serves one local model (ADR-0058). */
@Injectable()
export class AiJobs implements OnApplicationBootstrap {
  constructor(
    private readonly queues: Queues,
    private readonly tasks: AiTasksService,
  ) {}

  onApplicationBootstrap(): void {
    this.queues.process(AI_TASKS_QUEUE, { run: async (data) => this.tasks.process((data as { artifactId: string }).artifactId) }, 1)
  }
}

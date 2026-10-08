import { Global, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq'

export type JobHandler = (data: unknown, job: Job) => Promise<unknown>

/**
 * BullMQ queues on Redis (§2, §9.1). The API only enqueues; apps/worker runs the processors. Each queue belongs to the
 * context that registers it (`<context>.<purpose>`), so a context's jobs move with it when it is extracted.
 */
export class Queues implements OnApplicationShutdown {
  private readonly log = new Logger('Queues')
  private readonly queues = new Map<string, Queue>()
  private readonly workers: Worker[] = []
  private readonly connection: ConnectionOptions

  constructor(redisUrl: string) {
    const url = new URL(redisUrl)
    // BullMQ needs blocking connections without a per-request retry limit.
    this.connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
      tls: url.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    }
  }

  queue(name: string): Queue {
    let q = this.queues.get(name)
    if (!q) {
      q = new Queue(name, { connection: this.connection, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 } })
      this.queues.set(name, q)
    }
    return q
  }

  /** A job that repeats on a cron pattern (UTC); scheduling it again with the same name replaces the schedule. */
  async repeat(queueName: string, jobName: string, pattern: string, data: object = {}): Promise<void> {
    await this.queue(queueName).upsertJobScheduler(jobName, { pattern, tz: 'UTC' }, { name: jobName, data })
  }

  /** Runs the queue's jobs in this process (apps/worker only). */
  process(queueName: string, handlers: Record<string, JobHandler>, concurrency = 2): Worker {
    const worker = new Worker(
      queueName,
      async (job) => {
        const handler = handlers[job.name]
        if (!handler) throw new Error(`No handler for ${queueName}/${job.name}`)
        return handler(job.data, job)
      },
      { connection: this.connection, concurrency },
    )
    worker.on('failed', (job, err) => this.log.error(`${queueName}/${job?.name ?? '?'} failed: ${err.message}`))
    this.workers.push(worker)
    return worker
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()))
    await Promise.all([...this.queues.values()].map((q) => q.close()))
  }
}

@Global()
@Module({})
export class QueueModule {
  static forRoot(redisUrl: string): DynamicModule {
    return { module: QueueModule, providers: [{ provide: Queues, useValue: new Queues(redisUrl) }], exports: [Queues] }
  }
}

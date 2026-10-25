import { Global, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import { metrics } from '@opentelemetry/api'
import { reportError, withJobContext } from '@lvn-backend/observability'
import { DelayedError, Queue, Worker, type ConnectionOptions, type Job } from 'bullmq'

const meter = metrics.getMeter('lvn-queue')

/**
 * The handler wants this job to wait until `until` without using an attempt. The worker moves it and tells BullMQ
 * the job was delayed (a scan circuit that is open, or a user who already has a scan in flight).
 */
export class DelayJobError extends Error {
  override name = 'DelayJobError'
  constructor(readonly until: number) {
    super('delay')
  }
}
/** The job SLO's numerator and denominator (§16.4, ADR-0089): jobs finished, by queue and outcome. */
const finished = meter.createCounter('lvn.queue.jobs', { description: 'Jobs finished, by queue and outcome: completed, or failed after their last attempt' })

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
  private observing = false

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
      async (job, token) => {
        const handler = handlers[job.name]
        if (!handler) throw new Error(`No handler for ${queueName}/${job.name}`)
        try {
          // Every line the handler logs carries the queue and job id.
          return await withJobContext(queueName, job.id, () => handler(job.data, job))
        } catch (e) {
          if (e instanceof DelayJobError) {
            await job.moveToDelayed(e.until, token)
            throw new DelayedError()
          }
          throw e
        }
      },
      { connection: this.connection, concurrency },
    )
    worker.on('completed', () => finished.add(1, { queue: queueName, outcome: 'completed' }))
    worker.on('failed', (job, err) => {
      this.log.error(`${queueName}/${job?.name ?? '?'} failed: ${err.message}`)
      // Retries are expected; only a job that has used up its attempts is an error to report.
      if (!job || job.attemptsMade >= (job.opts.attempts ?? 1)) {
        reportError(err, reportedFailureTags(err, { queue: queueName, jobId: job?.id, job: job?.name }))
        finished.add(1, { queue: queueName, outcome: 'failed' })
      }
    })
    this.workers.push(worker)
    this.observeBacklog()
    return worker
  }

  /**
   * What waits in the queues this process runs, read when metrics are collected: `lvn.queue.backlog` by queue and state
   * (waiting, delayed, active, failed), for the backlog alert and the queues dashboard (ADR-0089).
   */
  private observeBacklog(): void {
    if (this.observing) return
    this.observing = true
    meter.createObservableGauge('lvn.queue.backlog', { description: 'Jobs in a queue, by state' }).addCallback(async (result) => {
      for (const name of new Set(this.workers.map((w) => w.name))) {
        const counts = await this.queue(name).getJobCounts('waiting', 'delayed', 'active', 'failed').catch(() => null)
        if (counts) for (const [state, n] of Object.entries(counts)) result.observe(n, { queue: name, state })
      }
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()))
    await Promise.all([...this.queues.values()].map((q) => q.close()))
  }
}

/** Tags for a job that has used up its attempts. A `userId` on the error is the file owner (ADR-0102). */
export function reportedFailureTags(err: unknown, tags: { queue: string; jobId?: string; job?: string }): Record<string, string | undefined> {
  return { ...tags, userId: errorUserId(err) }
}

function errorUserId(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || !('userId' in err)) return undefined
  const id = (err as { userId?: unknown }).userId
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

@Global()
@Module({})
export class QueueModule {
  static forRoot(redisUrl: string): DynamicModule {
    return { module: QueueModule, providers: [{ provide: Queues, useValue: new Queues(redisUrl) }], exports: [Queues] }
  }
}

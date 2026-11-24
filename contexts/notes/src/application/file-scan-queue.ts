import { Inject, Injectable } from '@nestjs/common'
import { REDIS } from '@lvn-backend/redis'
import { Queues } from '@lvn-backend/queue'
import type Redis from 'ioredis'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { fairPriority, FILE_SCAN_DLQ, FILE_SCAN_QUEUE, SCAN_BACKOFF_BASE_MS, SCAN_BACKOFF_JITTER } from './scan-policy'

const ONCE_TTL_SECONDS = 7 * 24 * 3600
const RELEASE = `
local n = redis.call('DECR', KEYS[1])
if n <= 0 then redis.call('DEL', KEYS[1]) end
return n
`
const UNLOCK = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`

export interface ScanQueueCounts {
  waiting: number
  delayed: number
  active: number
  failed: number
}

/**
 * One durable scan job per file on the existing Redis (ADR-0102). The job id is the file id, so a second enqueue
 * while the first is still queued does nothing. A user's later files get a worse priority than their first.
 */
@Injectable()
export class FileScanQueue {
  constructor(
    private readonly queues: Queues,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
  ) {}

  async enqueue(fileId: string, userId: string): Promise<'added' | 'exists'> {
    const claimed = await this.redis.set(this.onceKey(fileId), userId, 'EX', ONCE_TTL_SECONDS, 'NX')
    if (claimed !== 'OK') return 'exists'
    const queued = await this.redis.incr(this.fairKey(userId))
    await this.redis.expire(this.fairKey(userId), ONCE_TTL_SECONDS)
    try {
      await this.queues.queue(FILE_SCAN_QUEUE).add(
        'scan',
        { fileId, userId },
        {
          jobId: fileId,
          priority: fairPriority(queued),
          attempts: this.config.scanQueue.attempts,
          backoff: { type: 'exponential', delay: SCAN_BACKOFF_BASE_MS, jitter: SCAN_BACKOFF_JITTER },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      )
      return 'added'
    } catch (e) {
      await this.release(userId)
      await this.redis.del(this.onceKey(fileId))
      throw e
    }
  }

  /** Copies a finished failure onto the dead-letter queue. A second copy of the same file is ignored. */
  async deadLetter(fileId: string, userId: string, reason: string): Promise<void> {
    const claimed = await this.redis.set(this.deadKey(fileId), '1', 'EX', ONCE_TTL_SECONDS, 'NX')
    if (claimed !== 'OK') return
    await this.queues.queue(FILE_SCAN_DLQ).add('dead', { fileId, userId, reason: reason.slice(0, 300) }, { jobId: fileId, removeOnComplete: false, removeOnFail: false })
  }

  /** Drops the "already queued" mark so a lost job can be enqueued again. */
  async forget(fileId: string): Promise<void> {
    await this.redis.del(this.onceKey(fileId))
  }

  async release(userId: string): Promise<void> {
    await this.redis.eval(RELEASE, 1, this.fairKey(userId))
  }

  /** One scan at a time per user. The lock expires if the worker dies mid-scan. */
  async tryLock(userId: string, fileId: string, ttlMs: number): Promise<boolean> {
    const ok = await this.redis.set(this.lockKey(userId), fileId, 'PX', ttlMs, 'NX')
    return ok === 'OK'
  }

  async unlock(userId: string, fileId: string): Promise<void> {
    await this.redis.eval(UNLOCK, 1, this.lockKey(userId), fileId)
  }

  async counts(): Promise<ScanQueueCounts> {
    const counts = await this.queues.queue(FILE_SCAN_QUEUE).getJobCounts('waiting', 'prioritized', 'delayed', 'active', 'failed')
    return {
      waiting: (counts.waiting ?? 0) + (counts.prioritized ?? 0),
      delayed: counts.delayed ?? 0,
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
    }
  }

  async paused(): Promise<boolean> {
    return this.queues.queue(FILE_SCAN_QUEUE).isPaused()
  }

  async pause(): Promise<void> {
    await this.queues.queue(FILE_SCAN_QUEUE).pause()
  }

  async resume(): Promise<void> {
    await this.queues.queue(FILE_SCAN_QUEUE).resume()
  }

  private onceKey(fileId: string): string {
    return `scan:once:${fileId}`
  }

  private deadKey(fileId: string): string {
    return `scan:dead:${fileId}`
  }

  private fairKey(userId: string): string {
    return `scan:fair:${userId}`
  }

  private lockKey(userId: string): string {
    return `scan:user:${userId}`
  }
}

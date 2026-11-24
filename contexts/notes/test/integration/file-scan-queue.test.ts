import { execFileSync } from 'node:child_process'
import { startRedis } from '@lvn-backend/testing'
import Redis from 'ioredis'
import { DelayJobError, Queues } from '@lvn-backend/queue'
import { FileScanQueue } from '../../src/application/file-scan-queue'
import { FILE_SCAN_DLQ, FILE_SCAN_QUEUE, ScanCircuitGate } from '../../src/application/scan-policy'
import type { NotesConfig } from '../../src/notes.config'

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

const suite = dockerAvailable() ? describe : describe.skip

async function until(check: () => Promise<boolean>, label: string): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < 8_000) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  throw new Error(`timed out waiting for ${label}`)
}

suite('file-scan queue on Redis', () => {
  jest.setTimeout(60_000)
  let queues: Queues
  let redis: Redis
  let scans: FileScanQueue
  let stop: () => Promise<unknown>

  beforeAll(async () => {
    const started = await startRedis()
    redis = new Redis(started.url)
    queues = new Queues(started.url)
    scans = new FileScanQueue(queues, redis, { scanQueue: { concurrency: 2, attempts: 5 } } as NotesConfig)
    stop = () => started.container.stop()
  })

  afterAll(async () => {
    await queues.onApplicationShutdown()
    await redis.quit()
    await stop()
  })

  it('enqueues one job per file and gives a bulk upload a worse priority than another user', async () => {
    expect(await scans.enqueue('file-a1', 'user-a')).toBe('added')
    expect(await scans.enqueue('file-a1', 'user-a')).toBe('exists')
    expect(await scans.enqueue('file-a2', 'user-a')).toBe('added')
    expect(await scans.enqueue('file-b1', 'user-b')).toBe('added')

    const queue = queues.queue(FILE_SCAN_QUEUE)
    expect((await queue.getJob('file-a1'))?.opts.priority).toBe(1)
    expect((await queue.getJob('file-a2'))?.opts.priority).toBe(2)
    expect((await queue.getJob('file-b1'))?.opts.priority).toBe(1)
    expect(await scans.counts()).toMatchObject({ waiting: 3, active: 0, failed: 0 })
  })

  it('lets one user hold one scan lock', async () => {
    expect(await scans.tryLock('user-a', 'file-a1', 5_000)).toBe(true)
    expect(await scans.tryLock('user-a', 'file-a2', 5_000)).toBe(false)
    expect(await scans.tryLock('user-b', 'file-b1', 5_000)).toBe(true)
    await scans.unlock('user-a', 'file-a1')
    expect(await scans.tryLock('user-a', 'file-a2', 5_000)).toBe(true)
  })

  it('copies a dead letter once', async () => {
    await scans.deadLetter('file-dead', 'user-a', 'scan service did not return a verdict')
    await scans.deadLetter('file-dead', 'user-a', 'again')
    const job = await queues.queue(FILE_SCAN_DLQ).getJob('file-dead')
    expect(job?.data).toMatchObject({ fileId: 'file-dead', userId: 'user-a' })
    expect(await queues.queue(FILE_SCAN_DLQ).getJobCounts('waiting')).toMatchObject({ waiting: 1 })
  })

  it('pauses the queue while the circuit is open and resumes when it closes', async () => {
    const queue = queues.queue(FILE_SCAN_QUEUE)
    let clock = 1_000_000
    const gate = new ScanCircuitGate(queue, () => clock)
    await gate.sync(clock + 60_000)
    expect(await queue.isPaused()).toBe(true)
    clock += 60_000
    await gate.sync(clock)
    expect(await queue.isPaused()).toBe(false)
  })

  it('puts a job back without using an attempt when the handler asks to wait', async () => {
    const untilAt = Date.now() + 120_000
    queues.process('scan.delay', { wait: async () => { throw new DelayJobError(untilAt) } }, 1)
    const job = await queues.queue('scan.delay').add('wait', { n: 1 }, { jobId: 'delay-1', attempts: 3 })
    await until(async () => (await job.getState()) === 'delayed', 'a delayed job')
    expect((await queues.queue('scan.delay').getJob('delay-1'))?.attemptsMade).toBe(0)
  })

  it('stops after the attempt limit and leaves the job failed', async () => {
    let runs = 0
    const done = new Promise<void>((resolve) => {
      const worker = queues.process('scan.retry', {
        work: async () => {
          runs += 1
          throw new Error('scanner down')
        },
      }, 1)
      worker.on('failed', (job) => {
        if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) resolve()
      })
    })
    await queues.queue('scan.retry').add('work', {}, { jobId: 'retry-1', attempts: 3, backoff: { type: 'exponential', delay: 30, jitter: 0.2 } })
    await done
    expect(runs).toBe(3)
    expect(await (await queues.queue('scan.retry').getJob('retry-1'))?.getState()).toBe('failed')
  })
})

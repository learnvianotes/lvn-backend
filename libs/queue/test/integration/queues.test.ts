import { startRedis } from '@lvn-backend/testing'
import { Queues } from '../../src/queues'

describe('Queues on Redis (BullMQ)', () => {
  let queues: Queues
  let stop: () => Promise<unknown>

  beforeAll(async () => {
    const r = await startRedis()
    queues = new Queues(r.url)
    stop = () => r.container.stop()
  })

  afterAll(async () => {
    await queues.onApplicationShutdown()
    await stop()
  })

  it('runs an enqueued job with its handler', async () => {
    const seen: unknown[] = []
    const done = new Promise<void>((resolve) => {
      queues.process('test.jobs', { greet: async (data) => { seen.push(data); resolve() } })
    })
    await queues.queue('test.jobs').add('greet', { name: 'Asha' })
    await done
    expect(seen).toEqual([{ name: 'Asha' }])
  })

  it('keeps one schedule per repeating job, however often it is registered', async () => {
    await queues.repeat('test.maintenance', 'purge', '0 3 * * *')
    await queues.repeat('test.maintenance', 'purge', '0 3 * * *')
    const schedulers = await queues.queue('test.maintenance').getJobSchedulers()
    expect(schedulers.map((s) => [s.key, s.pattern])).toEqual([['purge', '0 3 * * *']])
  })
})

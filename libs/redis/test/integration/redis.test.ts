import { startRedis } from '@lvn-backend/testing'
import Redis from 'ioredis'
import { RateLimiter } from '../../src/rate-limiter'
import { SessionRevocations } from '../../src/session-revocations'

let redis: Redis
let stop: () => Promise<unknown>

beforeAll(async () => {
  const r = await startRedis()
  redis = new Redis(r.url)
  stop = () => r.container.stop()
})

afterAll(async () => {
  await redis.quit()
  await stop()
})

describe('RateLimiter', () => {
  it('allows up to the limit, then refuses with the time until a slot frees up', async () => {
    const limiter = new RateLimiter(redis)
    const limit = { max: 3, windowSeconds: 60 }
    const t0 = 1_000_000
    expect(await limiter.hit('a', limit, t0)).toEqual({ allowed: true, retryAfter: 0, remaining: 2 })
    await limiter.hit('a', limit, t0 + 1000)
    expect((await limiter.hit('a', limit, t0 + 2000)).remaining).toBe(0)
    expect(await limiter.hit('a', limit, t0 + 10_000)).toEqual({ allowed: false, retryAfter: 50, remaining: 0 })
  })

  it('slides: attempts older than the window stop counting', async () => {
    const limiter = new RateLimiter(redis)
    const limit = { max: 2, windowSeconds: 10 }
    await limiter.hit('b', limit, 0)
    await limiter.hit('b', limit, 5000)
    expect((await limiter.hit('b', limit, 9000)).allowed).toBe(false)
    expect((await limiter.hit('b', limit, 10_001)).allowed).toBe(true)
  })

  it('does not count refused attempts, and resets', async () => {
    const limiter = new RateLimiter(redis)
    const limit = { max: 1, windowSeconds: 60 }
    await limiter.hit('c', limit, 0)
    for (let i = 1; i < 5; i++) await limiter.hit('c', limit, i)
    expect(await redis.zcard('rl:c')).toBe(1)
    await limiter.reset('c')
    expect((await limiter.hit('c', limit, 10)).allowed).toBe(true)
  })

  it('peeks without recording an attempt', async () => {
    const limiter = new RateLimiter(redis)
    const limit = { max: 2, windowSeconds: 60 }
    expect(await limiter.peek('d', limit, 0)).toEqual({ allowed: true, retryAfter: 0, remaining: 2 })
    await limiter.hit('d', limit, 0)
    await limiter.hit('d', limit, 1000)
    for (let i = 0; i < 3; i++) expect(await limiter.peek('d', limit, 2000)).toEqual({ allowed: false, retryAfter: 58, remaining: 0 })
    expect(await redis.zcard('rl:d')).toBe(2)
    expect((await limiter.peek('d', limit, 60_001)).allowed).toBe(true)
  })

  it('holds under concurrency', async () => {
    const limiter = new RateLimiter(redis)
    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.hit('d', { max: 5, windowSeconds: 60 })))
    expect(results.filter((r) => r.allowed)).toHaveLength(5)
  })
})

describe('SessionRevocations', () => {
  it('marks a session family revoked for a while', async () => {
    const revocations = new SessionRevocations(redis)
    expect(await revocations.isRevoked('fam-1')).toBe(false)
    await revocations.revoke('fam-1', 900)
    expect(await revocations.isRevoked('fam-1')).toBe(true)
    expect(await redis.ttl('revoked:sid:fam-1')).toBeGreaterThan(890)
  })
})

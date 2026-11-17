import type { RequestContext } from '@lvn-backend/auth-guard'
import { ANONYMOUS_OPERATIONS_PER_MINUTE, OPERATIONS_PER_MINUTE } from '@lvn-backend/graphql'
import { graphqlOperationRetryAfter } from '../../src/graphql/operation-rate'

function countingLimiter() {
  const hits = new Map<string, number[]>()
  return {
    async hit(key: string, limit: { max: number; windowSeconds: number }, now = Date.now()) {
      const windowMs = limit.windowSeconds * 1000
      const prev = (hits.get(key) ?? []).filter((at) => now - at < windowMs)
      if (prev.length >= limit.max) {
        const oldest = Math.min(...prev)
        hits.set(key, prev)
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)), remaining: 0 }
      }
      prev.push(now)
      hits.set(key, prev)
      return { allowed: true, retryAfter: 0, remaining: limit.max - prev.length }
    },
  }
}

const ctx = (over: Partial<RequestContext> = {}): RequestContext => ({
  req: { headers: {}, ip: '203.0.113.5' },
  res: { cookie: () => undefined, clearCookie: () => undefined },
  requestId: 'r',
  viewer: null,
  ...over,
})

describe('GraphQL operation caps', () => {
  it('caps anonymous operations per network at 120 a minute and leaves another network alone', async () => {
    const limiter = countingLimiter()
    for (let i = 0; i < ANONYMOUS_OPERATIONS_PER_MINUTE; i++) {
      expect(await graphqlOperationRetryAfter(limiter, ctx())).toBeNull()
    }
    const retryAfter = await graphqlOperationRetryAfter(limiter, ctx())
    expect(retryAfter).toBeGreaterThan(0)
    expect(await graphqlOperationRetryAfter(limiter, ctx({ req: { headers: {}, ip: '198.51.100.5' } }))).toBeNull()
    // An IPv6 /64 is one network, so rotating the host half does not help.
    const v6 = countingLimiter()
    for (let i = 0; i < ANONYMOUS_OPERATIONS_PER_MINUTE; i++) {
      await graphqlOperationRetryAfter(v6, ctx({ req: { headers: {}, ip: `2001:db8:9:9::${i.toString(16)}` } }))
    }
    expect(await graphqlOperationRetryAfter(v6, ctx({ req: { headers: {}, ip: '2001:db8:9:9:ffff::1' } }))).toBeGreaterThan(0)
  })

  it('keeps signed-in operations at 600 a minute per person, not per address', async () => {
    const limiter = countingLimiter()
    const viewer = { userId: 'user-1', sessionId: 's', roles: [] as never, amr: [], mfa: false, mfaAt: null, mfaReq: false, mfaExempt: false }
    for (let i = 0; i < OPERATIONS_PER_MINUTE; i++) {
      expect(await graphqlOperationRetryAfter(limiter, ctx({ viewer, req: { headers: {}, ip: `203.0.113.${i % 200}` } }))).toBeNull()
    }
    expect(await graphqlOperationRetryAfter(limiter, ctx({ viewer }))).toBeGreaterThan(0)
    expect(await graphqlOperationRetryAfter(limiter, ctx({ viewer: { ...viewer, userId: 'user-2' } }))).toBeNull()
  })

  it('fails open when Redis is down', async () => {
    const limiter = { hit: async () => { throw new Error('redis down') } }
    expect(await graphqlOperationRetryAfter(limiter, ctx())).toBeNull()
    expect(await graphqlOperationRetryAfter(limiter, ctx({ viewer: { userId: 'user-1', sessionId: 's', roles: [], amr: [], mfa: false, mfaAt: null, mfaReq: false, mfaExempt: false } }))).toBeNull()
    expect(await graphqlOperationRetryAfter(countingLimiter(), ctx({ req: { headers: {} } }))).toBeNull()
  })
})

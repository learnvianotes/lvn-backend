import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AuthService } from '../../src/application/auth.service'
import { DEFAULT_TERMS_VERSION, LIMITS } from '../../src/domain/rules'

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (e: AppError) => e,
  )
}

/** A limiter that refuses one key prefix and allows everything else. */
function limiter(refusedPrefix: string) {
  const hit = jest.fn(async (key: string) => (key.startsWith(refusedPrefix) ? { allowed: false, retryAfter: 40, remaining: 0 } : { allowed: true, retryAfter: 0, remaining: 1 }))
  return { hit, peek: async () => ({ allowed: true, retryAfter: 0, remaining: 1 }), reset: async () => undefined }
}

function service(limit: object, db: object = { user: { findUnique: async () => null } }) {
  return new AuthService(
    db as never,
    { assertAcceptable: async () => undefined, hash: async () => 'hashed', verify: async () => false, needsRehash: () => false } as never,
    { start: jest.fn(), revokeAll: jest.fn() } as never,
    limit as never,
    { check: async () => undefined } as never,
    { match: async () => undefined } as never,
    { send: jest.fn() } as never,
    {} as never,
    { webUrl: 'http://localhost:3000' } as never,
    { minimumAge: () => 0 } as never,
    { assertAllowed: async () => undefined, allows: async () => true, roleFor: async () => null } as never,
    { holdSignUp: jest.fn() } as never,
    { email: async () => 'support@learnvianotes.in' } as never,
    { current: () => DEFAULT_TERMS_VERSION } as never,
    { schedule: async () => undefined } as never,
  )
}

const signUp = {
  email: 'new-person@example.com',
  password: 'correct horse battery staple',
  displayName: 'New Person',
  age: 24,
  acceptedTermsVersion: DEFAULT_TERMS_VERSION,
}

describe('auth network ceilings', () => {
  it('stops sign-up from one network before an account is created', async () => {
    const limit = limiter('signup-net:')
    const auth = service(limit)
    const err = await rejection(() => auth.signUp(signUp, { client: 'web' }, undefined, '203.0.113.8'))
    expect(err).toMatchObject({ code: ErrorCode.RATE_LIMITED, retryAfter: 40 })
    expect(err.message).toMatch(/sign-ups from your network/)
    expect(limit.hit).toHaveBeenCalledWith('signup-net:203.0.113.8', expect.objectContaining({ max: 300 }))
  })

  it('stops password-reset mail from one network before the per-address cap', async () => {
    const limit = limiter('reset-net:')
    const send = jest.fn()
    const auth = new AuthService(
      { user: { findUnique: jest.fn() } } as never,
      { assertAcceptable: async () => undefined } as never,
      {} as never,
      limit as never,
      {} as never,
      {} as never,
      { send } as never,
      {} as never,
      { webUrl: 'http://localhost:3000' } as never,
      { minimumAge: () => 0 } as never,
      { allows: async () => true } as never,
      {} as never,
      { email: async () => 'support@learnvianotes.in' } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      { schedule: async () => undefined } as never,
    )
    const err = await rejection(() => auth.requestPasswordReset('person@example.com', '2001:db8:1:2::5'))
    expect(err).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(err.message).toMatch(/reset requests from your network/)
    expect(limit.hit).toHaveBeenCalledWith('reset-net:2001:0db8:0001:0002::/64', expect.objectContaining({ max: 40 }))
    expect(send).not.toHaveBeenCalled()
  })

  it('allows signUpPerNetwork from one address, then refuses, and a different network still gets past the cap', async () => {
    const limit = countingLimiter()
    const auth = service(limit, { user: { findUnique: async () => null }, $transaction: async () => { throw Object.assign(new Error('past the cap'), { code: 'PAST_LIMIT' }) } })
    for (let i = 0; i < LIMITS.signUpPerNetwork.max; i++) {
      const err = await rejection(() => auth.signUp({ ...signUp, email: `person-${i}@example.com` }, { client: 'web' }, undefined, '203.0.113.20'))
      expect(err.code).toBe('PAST_LIMIT')
    }
    const blocked = await rejection(() => auth.signUp({ ...signUp, email: 'blocked@example.com' }, { client: 'web' }, undefined, '203.0.113.20'))
    expect(blocked).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(blocked.message).toMatch(/sign-ups from your network/)
    const other = await rejection(() => auth.signUp({ ...signUp, email: 'other@example.com' }, { client: 'web' }, undefined, '198.51.100.20'))
    expect(other.code).toBe('PAST_LIMIT')
  })

  it('allows passwordResetPerNetwork across addresses, then refuses that network only', async () => {
    const limit = countingLimiter()
    const auth = service(limit, { user: { findUnique: async () => null } })
    for (let i = 0; i < LIMITS.passwordResetPerNetwork.max; i++) {
      await auth.requestPasswordReset(`reset-${i}@example.com`, '203.0.113.40')
    }
    const blocked = await rejection(() => auth.requestPasswordReset('one-more@example.com', '203.0.113.40'))
    expect(blocked).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(blocked.message).toMatch(/reset requests from your network/)
    await expect(auth.requestPasswordReset('elsewhere@example.com', '198.51.100.40')).resolves.toBeUndefined()
  })
})

/** A sliding window with the same shape as RateLimiter.hit, so a test can walk up to the real max. */
function countingLimiter() {
  const hits = new Map<string, number[]>()
  return {
    hit: async (key: string, limit: { max: number; windowSeconds: number }, now = Date.now()) => {
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
    peek: async () => ({ allowed: true, retryAfter: 0, remaining: 1 }),
    reset: async () => undefined,
  }
}

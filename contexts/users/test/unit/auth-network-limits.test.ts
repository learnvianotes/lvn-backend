import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AuthService } from '../../src/application/auth.service'
import { DEFAULT_TERMS_VERSION } from '../../src/domain/rules'

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

function service(limit: ReturnType<typeof limiter>, db: object = { user: { findUnique: async () => null } }) {
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
    const limit = limiter('signup:')
    const auth = service(limit)
    const err = await rejection(() => auth.signUp(signUp, { client: 'web' }, undefined, '203.0.113.8'))
    expect(err).toMatchObject({ code: ErrorCode.RATE_LIMITED, retryAfter: 40 })
    expect(err.message).toMatch(/sign-ups from your network/)
    expect(limit.hit).toHaveBeenCalledWith('signup:203.0.113.8', expect.objectContaining({ max: 300 }))
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
    )
    const err = await rejection(() => auth.requestPasswordReset('person@example.com', '2001:db8:1:2::5'))
    expect(err).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(err.message).toMatch(/reset requests from your network/)
    expect(limit.hit).toHaveBeenCalledWith('reset-net:2001:0db8:0001:0002::/64', expect.objectContaining({ max: 40 }))
    expect(send).not.toHaveBeenCalled()
  })
})

import { AbuseStrikes, HOLD_REASON, STRIKES_BEFORE_HOLD } from '../../src/graphql/abuse-strikes'

function setup(refuseAfter: number, alreadySuspended = false) {
  let n = 0
  const limiter = { hit: jest.fn(async () => ({ allowed: ++n < refuseAfter, retryAfter: 60, remaining: 0 })) }
  const revocations = { revoke: jest.fn(async () => undefined) }
  const policy = { suspension: jest.fn(async () => (alreadySuspended ? { until: new Date(), reason: null } : null)), suspend: jest.fn(async () => undefined) }
  const audit = { record: jest.fn(async () => undefined) }
  const strikes = new AbuseStrikes(limiter as never, revocations as never, policy as never, audit as never)
  return { strikes, limiter, revocations, policy, audit }
}

const student = { userId: 'u1', sessionId: 's1', roles: ['STUDENT'], amr: [], mfa: false, mfaAt: null, mfaReq: false, mfaExempt: false } as never

describe('automatic hold after a burst of refused requests (ADR-0116)', () => {
  it('only counts while under the limit', async () => {
    const t = setup(STRIKES_BEFORE_HOLD + 1)
    for (let i = 0; i < 5; i++) await t.strikes.strike(student, 'rate-limited')
    expect(t.limiter.hit).toHaveBeenCalledWith('strike:u1', expect.objectContaining({ max: STRIKES_BEFORE_HOLD }))
    expect(t.policy.suspend).not.toHaveBeenCalled()
  })

  it('holds the account, ends the session and audits it once the limit is passed', async () => {
    const t = setup(1)
    await t.strikes.strike(student, 'operation-rate', '203.0.113.8')
    expect(t.policy.suspend).toHaveBeenCalledWith('u1', expect.any(Date), HOLD_REASON)
    expect(t.revocations.revoke).toHaveBeenCalledWith('s1', expect.any(Number))
    expect(t.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'abuse.auto_hold', targetId: 'u1', ip: '203.0.113.8' }))
  })

  it('does not extend a hold that is already running', async () => {
    const t = setup(1, true)
    await t.strikes.strike(student, 'rate-limited')
    expect(t.policy.suspend).not.toHaveBeenCalled()
  })

  it('never holds staff', async () => {
    const t = setup(1)
    await t.strikes.strike({ ...(student as object), roles: ['PLATFORM_ADMIN'] } as never, 'rate-limited')
    expect(t.limiter.hit).not.toHaveBeenCalled()
  })

  it('fails open when Redis is down', async () => {
    const t = setup(1)
    t.limiter.hit.mockRejectedValueOnce(new Error('redis down'))
    await expect(t.strikes.strike(student, 'rate-limited')).resolves.toBeUndefined()
    expect(t.policy.suspend).not.toHaveBeenCalled()
  })
})

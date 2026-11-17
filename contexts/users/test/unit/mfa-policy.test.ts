import { mfaFresh, mfaRequiredFor, allowedFactors } from '../../src/domain/mfa'
import { redactAudit } from '../../src/domain/audit-redact'

const policy = { enforced: true, roles: ['PLATFORM_ADMIN', 'MANAGER'] }
const person = { globalRole: 'STUDENT', mfaOptIn: false, mfaExemptUntil: null }

describe('mfa policy', () => {
  it('requires admin and staff when enforcement is on, and leaves everyone else', () => {
    expect(mfaRequiredFor({ ...person, globalRole: 'PLATFORM_ADMIN' }, policy)).toBe(true)
    expect(mfaRequiredFor({ ...person, globalRole: 'MANAGER' }, policy)).toBe(true)
    expect(mfaRequiredFor(person, policy)).toBe(false)
    expect(mfaRequiredFor({ ...person, globalRole: 'TEACHER' }, policy)).toBe(false)
    expect(allowedFactors(true)).toEqual(['EMAIL_OTP'])
    expect(allowedFactors(false)).toEqual([])
  })

  it('stays off when the flag is off, except an account that opted in', () => {
    expect(mfaRequiredFor({ ...person, globalRole: 'PLATFORM_ADMIN' }, { ...policy, enforced: false })).toBe(false)
    expect(mfaRequiredFor({ ...person, mfaOptIn: true }, { ...policy, enforced: false })).toBe(true)
  })

  it('skips a recovery window, and treats a 12-hour-old verification as finished only inside the window', () => {
    const until = new Date(Date.now() + 60_000)
    expect(mfaRequiredFor({ ...person, globalRole: 'PLATFORM_ADMIN', mfaExemptUntil: until }, policy)).toBe(false)
    const recent = new Date(Date.now() - 60_000)
    const old = new Date(Date.now() - 13 * 60 * 60 * 1000)
    expect(mfaFresh(recent, 12 * 60 * 60)).toBe(true)
    expect(mfaFresh(old, 12 * 60 * 60)).toBe(false)
    expect(mfaFresh(null, 12 * 60 * 60)).toBe(false)
  })
})

describe('audit redaction', () => {
  it('removes secrets and one-time codes, and keeps ordinary detail', () => {
    expect(redactAudit({ code: 'PRO', apiKey: 'sk-live', nested: { password: 'hunter2', code: '123456' }, attempts: 1 })).toEqual({
      code: 'PRO',
      apiKey: '[redacted]',
      nested: { password: '[redacted]', code: '[redacted]' },
      attempts: 1,
    })
  })
})

import { LimitKey, limitPeriod, planLimitMessage } from '@lvn/contracts/domain'
import { assertWithinPlan, Errors, planLimitError, withUserErrors, type UserError } from '../../src'

type Ok = { ok: boolean; userErrors: UserError[] }

describe('plan limit errors', () => {
  const now = new Date('2026-10-23T12:00:00.000Z')

  it.each(Object.values(LimitKey))('refuses %s with the contract message and lets a null limit through', (key) => {
    expect(() => assertWithinPlan(key, null, 999n, 1n, now)).not.toThrow()
    expect(() => assertWithinPlan(key, 3n, 2n, 1n, now)).not.toThrow()
    try {
      assertWithinPlan(key, 3n, 3n, 1n, now)
      throw new Error('expected a refusal')
    } catch (error) {
      expect(error).toMatchObject({
        message: planLimitMessage(key),
        code: limitPeriod(key) ? 'RATE_LIMITED' : 'FORBIDDEN',
      })
      if (limitPeriod(key)) expect((error as { retryAfter: number }).retryAfter).toBeGreaterThan(0)
    }
  })

  it('returns a standing cap as a userError and still throws other forbidden errors', async () => {
    const hit = planLimitError(LimitKey.NOTES_OWNED, now)
    const out = await withUserErrors<Ok>(async () => { throw hit }, { ok: false })
    expect(out.userErrors).toEqual([{ code: 'FORBIDDEN', message: "You've reached your plan's limit for notes.", field: null }])
    const daily = planLimitError(LimitKey.AI_REQUESTS_DAILY, now)
    const limited = await withUserErrors<Ok>(async () => { throw daily }, { ok: false })
    expect(limited.userErrors[0]).toMatchObject({ code: 'RATE_LIMITED', message: "You've reached your plan's limit for AI asks a day." })
    await expect(withUserErrors<Ok>(async () => { throw Errors.forbidden('Classes are run by teachers.') }, { ok: false })).rejects.toMatchObject({ message: 'Classes are run by teachers.' })
  })
})

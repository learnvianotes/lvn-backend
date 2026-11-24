import { LimitKey } from '../../../src/domain/enums'
import { exceedsPlanLimit, LIMIT_KEYS, LIMIT_LABELS, LIMIT_PERIOD, planLimitMessage } from '../../../src/domain/limits'

describe('plan limit catalogue', () => {
  it('names every limit, including notes and AI asks', () => {
    expect(LIMIT_KEYS).toEqual(Object.values(LimitKey))
    expect(LIMIT_KEYS).toEqual(expect.arrayContaining(['NOTES_OWNED', 'AI_REQUESTS_DAILY']))
    for (const key of LIMIT_KEYS) {
      expect(LIMIT_LABELS[key].length).toBeGreaterThan(0)
      expect(key in LIMIT_PERIOD).toBe(true)
    }
    expect(LIMIT_LABELS.AI_REQUESTS_DAILY).toBe('AI asks a day')
  })

  it('uses the contract message', () => {
    expect(planLimitMessage(LimitKey.AI_REQUESTS_DAILY)).toBe("You've reached your plan's limit for AI asks a day.")
    expect(planLimitMessage(LimitKey.NOTES_OWNED)).toBe("You've reached your plan's limit for notes.")
  })

  it('treats a null limit as unlimited and a count at the cap as full', () => {
    expect(exceedsPlanLimit(null, 10_000n)).toBe(false)
    expect(exceedsPlanLimit(5n, 4n)).toBe(false)
    expect(exceedsPlanLimit(5n, 5n)).toBe(true)
    expect(exceedsPlanLimit(100n, 90n, 10n)).toBe(false)
    expect(exceedsPlanLimit(100n, 91n, 10n)).toBe(true)
  })
})

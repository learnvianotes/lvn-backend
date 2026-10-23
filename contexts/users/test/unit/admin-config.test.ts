import { LimitKey } from '@lvn/contracts/domain'
import { decodeSettingValue, parseSettingInput, SETTING_CATALOG, settingDef } from '../../src/domain/setting-catalog'
import { parsePlanDraft, parsePlanPatch } from '../../src/domain/plan-pricing'

describe('admin setting catalog', () => {
  it('parses booleans, bounded integers and an empty cap', () => {
    const age = settingDef('account_minimum_age')!
    expect(parseSettingInput(age, '18')).toEqual({ ok: true, value: 18 })
    expect(parseSettingInput(age, '17').ok).toBe(false)
    expect(parseSettingInput(age, 'true').ok).toBe(false)
    const budget = settingDef('ai_monthly_budget_micro_usd')!
    expect(parseSettingInput(budget, '')).toEqual({ ok: true, value: null })
    expect(parseSettingInput(budget, '0')).toEqual({ ok: true, value: 0 })
    expect(parseSettingInput(settingDef('google_sign_in')!, 'false')).toEqual({ ok: true, value: false })
    expect(SETTING_CATALOG.map((d) => d.key)).toEqual([
      'google_sign_in',
      'access_allowlist_enabled',
      'student_id_verification',
      'uploads_enabled',
      'ai_public_pipeline',
      'ai_monthly_budget_micro_usd',
      'ai_timeout_ms',
      'search_hybrid',
      'search_timeout_ms',
      'account_minimum_age',
      'digital_consent_age',
    ])
  })

  it('reads the wrapped value, and a legacy boolean row', () => {
    expect(decodeSettingValue({ v: false }, true)).toBe(false)
    expect(decodeSettingValue({ v: 21 }, false)).toBe(21)
    expect(decodeSettingValue({ v: null }, true)).toBeNull()
    expect(decodeSettingValue(null, true)).toBe(true)
  })
})

describe('plan pricing input', () => {
  const keys = Object.values(LimitKey)

  it('accepts a priced plan and its limits', () => {
    const parsed = parsePlanDraft({ code: 'plus', name: ' Plus ', priceMinor: 49900, currency: 'inr', interval: 'MONTH', features: [' More AI '], active: true, entitlements: [{ key: 'AI_TOKENS_DAILY', limit: '500000', appliesToRole: 'STUDENT' }, { key: 'STORAGE_BYTES', limit: null, appliesToRole: null }] }, keys)
    expect(parsed.ok && parsed.value).toMatchObject({ code: 'PLUS', name: 'Plus', currency: 'INR', priceMinor: 49900, features: ['More AI'] })
    if (!parsed.ok) return
    expect(parsed.value.entitlements).toEqual([
      { key: 'AI_TOKENS_DAILY', limit: 500000n, appliesToRole: 'STUDENT' },
      { key: 'STORAGE_BYTES', limit: null, appliesToRole: null },
    ])
  })

  it('refuses a bad price, a duplicate limit and an edit that forgets to send a name', () => {
    expect(parsePlanDraft({ code: 'X', name: 'X', priceMinor: -1, currency: 'INR', interval: 'YEAR' }, keys).ok).toBe(false)
    expect(parsePlanDraft({ code: 'PLUS', name: 'Plus', priceMinor: 1, currency: 'INR', interval: 'NONE', entitlements: [{ key: 'ORG_SEATS', limit: '1', appliesToRole: null }, { key: 'ORG_SEATS', limit: '2', appliesToRole: null }] }, keys).ok).toBe(false)
    const patch = parsePlanPatch({ priceMinor: 100 }, keys)
    expect(patch.ok && patch.value).toEqual({ priceMinor: 100 })
  })
})

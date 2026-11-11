import { LimitKey } from '@lvn/contracts/domain'
import { decodeSettingValue, parseSettingInput, SETTING_CATALOG, settingDef } from '../../src/domain/setting-catalog'
import { parsePlanDraft, parsePlanPatch } from '../../src/domain/plan-pricing'

describe('admin setting catalog', () => {
  it('parses booleans, bounded integers and an empty cap', () => {
    const age = settingDef('account_minimum_age')!
    expect(age).toMatchObject({ min: 5, max: 21, defaultValue: 13, environmentFallback: false })
    expect(age.description).toContain('From 5 to 21')
    expect(age.description).toContain('An admin cannot set this below 5')
    expect(age.description).toContain('sets this to 5')
    expect(parseSettingInput(age, '13')).toEqual({ ok: true, value: 13 })
    expect(parseSettingInput(age, '5')).toEqual({ ok: true, value: 5 })
    expect(parseSettingInput(age, '18')).toEqual({ ok: true, value: 18 })
    expect(parseSettingInput(age, '4').ok).toBe(false)
    expect(parseSettingInput(age, '22').ok).toBe(false)
    const notice = settingDef('guardian_notice_version')!
    expect(notice).toMatchObject({ defaultValue: '2026-11-11', environmentFallback: false })
    expect(parseSettingInput(notice, '2026-12-01')).toEqual({ ok: true, value: '2026-12-01' })
    expect(parseSettingInput(notice, '2026-02-30').ok).toBe(false)
    expect(parseSettingInput(age, 'true').ok).toBe(false)
    const budget = settingDef('ai_monthly_budget_micro_usd')!
    expect(parseSettingInput(budget, '')).toEqual({ ok: true, value: null })
    expect(parseSettingInput(budget, '0')).toEqual({ ok: true, value: 0 })
    expect(parseSettingInput(settingDef('google_sign_in')!, 'false')).toEqual({ ok: true, value: false })
    expect(SETTING_CATALOG.map((d) => d.key)).toEqual([
      'google_sign_in',
      'access_allowlist_enabled',
      'unverified_gated_actions',
      'student_id_verification',
      'student_id_ai_check',
      'student_id_ai_auto_approve',
      'student_id_ai_confidence_threshold',
      'student_id_image_retention_days',
      'uploads_enabled',
      'uploads_per_minute',
      'uploads_per_day',
      'upload_bytes_per_day',
      'upload_pending_scans',
      'uploads_per_ip_per_minute',
      'scan_queue_concurrency',
      'ai_public_pipeline',
      'ai_monthly_budget_micro_usd',
      'ai_timeout_ms',
      'openai_zdr_approved',
      'ai_child_safety_prompt',
      'ai_report_max_per_hour',
      'search_hybrid',
      'search_timeout_ms',
      'account_minimum_age',
      'digital_consent_age',
      'guardian_notice_version',
      'guardian_email_plus_enabled',
      'guardian_consent_required_for_access',
      'guardian_link_ttl_hours',
      'guardian_manage_session_minutes',
      'guardian_link_resend_per_hour',
      'minor_purge_window_days',
      'public_notes_require_verification',
      'terms_version',
      'sentry_minor_events_enabled',
      'minor_pii_filter_mode',
      'sentry_tunnel_max_bytes',
      'sentry_tunnel_per_minute',
      'terms_published_versions',
    ])
  })

  it('lists a 50 GiB upload cap that does not fit in a GraphQL Int', () => {
    const cap = settingDef('upload_bytes_per_day')!
    expect(cap.max).toBe(53_687_091_200)
    expect(cap.max!).toBeGreaterThan(2_147_483_647)
  })

  it('parses the unverified action list and refuses an unknown id', () => {
    const gates = settingDef('unverified_gated_actions')!
    expect(parseSettingInput(gates, '')).toEqual({ ok: true, value: '' })
    expect(parseSettingInput(gates, ' note.publish, note.share ')).toEqual({ ok: true, value: 'note.publish,note.share' })
    expect(parseSettingInput(gates, 'not.an.action').ok).toBe(false)
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
    const added = parsePlanDraft({ code: 'PLUS', name: 'Plus', priceMinor: 0, currency: 'INR', interval: 'NONE', entitlements: [{ key: 'NOTES_OWNED', limit: '40', appliesToRole: null }, { key: 'AI_REQUESTS_DAILY', limit: null, appliesToRole: 'STUDENT' }] }, keys)
    expect(added.ok && added.value.entitlements).toEqual([
      { key: 'NOTES_OWNED', limit: 40n, appliesToRole: null },
      { key: 'AI_REQUESTS_DAILY', limit: null, appliesToRole: 'STUDENT' },
    ])
    const patch = parsePlanPatch({ priceMinor: 100 }, keys)
    expect(patch.ok && patch.value).toEqual({ priceMinor: 100 })
  })

  it('keeps Families AI settings off the environment', () => {
    const zdr = settingDef('openai_zdr_approved')!
    const prompt = settingDef('ai_child_safety_prompt')!
    const reports = settingDef('ai_report_max_per_hour')!
    expect(zdr).toMatchObject({ type: 'BOOLEAN', defaultValue: false, environmentFallback: false })
    expect(prompt).toMatchObject({ type: 'STRING', defaultValue: '', environmentFallback: false })
    expect(reports).toMatchObject({ type: 'INTEGER', defaultValue: 10, environmentFallback: false })
    expect(parseSettingInput(zdr, 'true')).toEqual({ ok: true, value: true })
    expect(parseSettingInput(prompt, '')).toEqual({ ok: true, value: '' })
  })
})

/** One admin-editable application setting (ADR-0101). Ports, URLs and secrets stay in the environment. */

export type SettingType = 'BOOLEAN' | 'INTEGER' | 'STRING'

export interface SettingDef {
  key: string
  type: SettingType
  category: string
  description: string
  /** Used when the row is missing and this setting has no environment fallback. */
  defaultValue: boolean | number | string | null
  /** A missing row uses the process environment, passed in by the composition root. */
  environmentFallback: boolean
  /** An integer may be saved as empty (no cap). */
  nullable: boolean
  min?: number
  max?: number
  maxLength?: number
  pattern?: string
}

export const GOOGLE_SIGN_IN_SETTING = 'google_sign_in'
export const ACCESS_ALLOWLIST_SETTING = 'access_allowlist_enabled'
export const STUDENT_ID_VERIFICATION_SETTING = 'student_id_verification'

export const SETTING_CATALOG: SettingDef[] = [
  {
    key: GOOGLE_SIGN_IN_SETTING,
    type: 'BOOLEAN',
    category: 'auth',
    description: 'Offer Google sign-in. It still needs FIREBASE_PROJECT_ID. A missing row means on.',
    defaultValue: true,
    environmentFallback: false,
    nullable: false,
  },
  {
    key: ACCESS_ALLOWLIST_SETTING,
    type: 'BOOLEAN',
    category: 'auth',
    description: 'When on, only emails an admin has added can sign up or sign in. Off lets everyone in. A missing row means off.',
    defaultValue: false,
    environmentFallback: false,
    nullable: false,
  },
  {
    key: STUDENT_ID_VERIFICATION_SETTING,
    type: 'BOOLEAN',
    category: 'verification',
    description: 'Let a student send one college ID card for an admin to review. Off until an admin turns it on. It does not turn general uploads on.',
    defaultValue: false,
    environmentFallback: false,
    nullable: false,
  },
  {
    key: 'uploads_enabled',
    type: 'BOOLEAN',
    category: 'uploads',
    description: 'Let people upload files. Until an admin saves this, UPLOADS_ENABLED applies (default off). College ID verification has its own switch.',
    defaultValue: false,
    environmentFallback: true,
    nullable: false,
  },
  {
    key: 'ai_public_pipeline',
    type: 'BOOLEAN',
    category: 'ai',
    description: 'Make study aids when a note is published publicly. Until an admin saves this, AI_PUBLIC_PIPELINE applies (default on).',
    defaultValue: true,
    environmentFallback: true,
    nullable: false,
  },
  {
    key: 'ai_monthly_budget_micro_usd',
    type: 'INTEGER',
    category: 'ai',
    description: 'Monthly AI spend cap, in millionths of a US dollar. Empty means no cap. 0 pauses AI for the rest of the month. Until an admin saves this, AI_MONTHLY_BUDGET_MICRO_USD applies.',
    defaultValue: null,
    environmentFallback: true,
    nullable: true,
    min: 0,
    max: 2_000_000_000,
  },
  {
    key: 'ai_timeout_ms',
    type: 'INTEGER',
    category: 'ai',
    description: 'How long one AI provider call may take, in milliseconds. Until an admin saves this, AI_TIMEOUT_MS applies.',
    defaultValue: 120_000,
    environmentFallback: true,
    nullable: false,
    min: 1_000,
    max: 600_000,
  },
  {
    key: 'search_hybrid',
    type: 'BOOLEAN',
    category: 'search',
    description: 'Fuse keyword and semantic search. Until an admin saves this, SEARCH_HYBRID applies (default off).',
    defaultValue: false,
    environmentFallback: true,
    nullable: false,
  },
  {
    key: 'search_timeout_ms',
    type: 'INTEGER',
    category: 'search',
    description: 'How long Typesense may take before Postgres answers instead, in milliseconds. Until an admin saves this, SEARCH_TIMEOUT_MS applies.',
    defaultValue: 800,
    environmentFallback: true,
    nullable: false,
    min: 50,
    max: 10_000,
  },
  {
    key: 'account_minimum_age',
    type: 'INTEGER',
    category: 'accounts',
    description: 'Youngest age that may hold an account. An admin cannot set this below 18. Until an admin saves this, ACCOUNT_MINIMUM_AGE applies.',
    defaultValue: 18,
    environmentFallback: true,
    nullable: false,
    min: 18,
    max: 21,
  },
  {
    key: 'digital_consent_age',
    type: 'INTEGER',
    category: 'accounts',
    description: 'Below this age an account is a restricted minor unless a guardian has consented. It does not let anyone under account_minimum_age register. Until an admin saves this, DIGITAL_CONSENT_AGE applies.',
    defaultValue: 18,
    environmentFallback: true,
    nullable: false,
    min: 13,
    max: 21,
  },
]

const byKey = new Map(SETTING_CATALOG.map((d) => [d.key, d]))

export function settingDef(key: string): SettingDef | undefined {
  return byKey.get(key)
}

/** The wire form of a stored value: `true`/`false`, a decimal integer, text, or empty for an explicit empty integer. */
export function serializeSetting(value: boolean | number | string | null): string {
  if (value === null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function decodeSettingValue(value: unknown, enabled: boolean): boolean | number | string | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'v' in value) {
    const v = (value as { v: unknown }).v
    if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string' || v === null) return v
  }
  return enabled
}

/** Parses an admin's input. Returns a message when it does not match the catalog. */
export function parseSettingInput(def: SettingDef, raw: string): { ok: true; value: boolean | number | string | null } | { ok: false; message: string } {
  if (def.type === 'BOOLEAN') {
    if (raw === 'true') return { ok: true, value: true }
    if (raw === 'false') return { ok: true, value: false }
    return { ok: false, message: 'Use true or false.' }
  }
  if (def.type === 'INTEGER') {
    if (raw === '') {
      if (def.nullable) return { ok: true, value: null }
      return { ok: false, message: 'Enter a whole number.' }
    }
    if (!/^\d+$/.test(raw)) return { ok: false, message: 'Enter a whole number, 0 or greater.' }
    const n = Number(raw)
    if (!Number.isSafeInteger(n)) return { ok: false, message: 'That number is too large.' }
    if (def.min !== undefined && n < def.min) return { ok: false, message: `Use at least ${def.min}.` }
    if (def.max !== undefined && n > def.max) return { ok: false, message: `Use at most ${def.max}.` }
    return { ok: true, value: n }
  }
  if (def.maxLength !== undefined && raw.length > def.maxLength) return { ok: false, message: `Use at most ${def.maxLength} characters.` }
  if (def.pattern && !new RegExp(def.pattern).test(raw)) return { ok: false, message: 'That value does not match the expected pattern.' }
  return { ok: true, value: raw }
}

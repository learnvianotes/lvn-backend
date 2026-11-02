/** One admin-editable application setting (ADR-0101). Ports, URLs and secrets stay in the environment. */
import { DEFAULT_UNVERIFIED_GATED_ACTIONS, parseUnverifiedGateSetting, PUBLIC_NOTES_REQUIRE_VERIFICATION } from '@lvn/contracts/domain'

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
/** Comma-separated action ids an institution-unverified account cannot do. Empty gates nothing. A missing row is the default list. */
export const UNVERIFIED_GATED_ACTIONS_SETTING = 'unverified_gated_actions'
export const STUDENT_ID_VERIFICATION_SETTING = 'student_id_verification'
/** AI reads a college ID or proof image. Off until an admin turns it on. */
export const STUDENT_ID_AI_CHECK_SETTING = 'student_id_ai_check'
/** Approve a student request when the check is a high-confidence match. Default off. Never auto-rejects. */
export const STUDENT_ID_AI_AUTO_APPROVE_SETTING = 'student_id_ai_auto_approve'
/** Minimum confidence, 0–100, before a match may be auto-approved. */
export const STUDENT_ID_AI_THRESHOLD_SETTING = 'student_id_ai_confidence_threshold'
/** Days a college ID image is kept after the request is decided. Default 30. */
export const STUDENT_ID_IMAGE_RETENTION_SETTING = 'student_id_image_retention_days'

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
    key: UNVERIFIED_GATED_ACTIONS_SETTING,
    type: 'STRING',
    category: 'auth',
    description: 'Actions an account cannot do until it is institution-verified. Comma-separated action ids such as note.publish. Empty gates nothing. A missing row uses the built-in list: publishing, sharing, contests, payouts, bulk AI and submitting resources.',
    defaultValue: DEFAULT_UNVERIFIED_GATED_ACTIONS.join(','),
    environmentFallback: false,
    nullable: false,
    maxLength: 500,
  },
  {
    key: STUDENT_ID_VERIFICATION_SETTING,
    type: 'BOOLEAN',
    category: 'verification',
    description: 'Let a student send one college ID card for review. Off until an admin turns it on. It does not turn general uploads on.',
    defaultValue: false,
    environmentFallback: false,
    nullable: false,
  },
  {
    key: STUDENT_ID_AI_CHECK_SETTING,
    type: 'BOOLEAN',
    category: 'verification',
    description: 'aiCheckEnabled. When a student uploads a college ID or proof, a background job reads that image only and stores a match, mismatch or unreadable verdict. Off until an admin turns it on. Mismatches always wait for a person.',
    defaultValue: false,
    environmentFallback: false,
    nullable: false,
  },
  {
    key: STUDENT_ID_AI_AUTO_APPROVE_SETTING,
    type: 'BOOLEAN',
    category: 'verification',
    description: 'autoApproveOnHighConfidence. When on, a high-confidence match verifies the student account. Default off. A mismatch or a low score is never decided by the check.',
    defaultValue: false,
    environmentFallback: false,
    nullable: false,
  },
  {
    key: STUDENT_ID_AI_THRESHOLD_SETTING,
    type: 'INTEGER',
    category: 'verification',
    description: 'Confidence, from 50 to 100, required before autoApproveOnHighConfidence may approve. 90 means the check must be at least 90 percent sure.',
    defaultValue: 90,
    environmentFallback: false,
    nullable: false,
    min: 50,
    max: 100,
  },
  {
    key: STUDENT_ID_IMAGE_RETENTION_SETTING,
    type: 'INTEGER',
    category: 'verification',
    description: 'Days a college ID image is kept after the request is approved or rejected. Default 30. A withdrawn card is deleted at once. The image is sent only to the ID check and is never written to logs.',
    defaultValue: 30,
    environmentFallback: false,
    nullable: false,
    min: 1,
    max: 3650,
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
    key: 'uploads_per_minute',
    type: 'INTEGER',
    category: 'uploads',
    description: 'Files one person may start uploading per minute. Until an admin saves this, UPLOADS_PER_MINUTE applies (default 10).',
    defaultValue: 10,
    environmentFallback: true,
    nullable: false,
    min: 1,
    max: 10_000,
  },
  {
    key: 'uploads_per_day',
    type: 'INTEGER',
    category: 'uploads',
    description: 'Files one person may start uploading per day. Until an admin saves this, UPLOADS_PER_DAY applies (default 100).',
    defaultValue: 100,
    environmentFallback: true,
    nullable: false,
    min: 1,
    max: 100_000,
  },
  {
    key: 'upload_bytes_per_day',
    type: 'INTEGER',
    category: 'uploads',
    description: 'Bytes one person may declare on upload URLs per day. Until an admin saves this, UPLOAD_BYTES_PER_DAY applies (default 500 MB).',
    defaultValue: 500 * 1024 * 1024,
    environmentFallback: true,
    nullable: false,
    min: 1,
    // 50 GiB. Above the GraphQL Int limit (2^31-1); AdminSettingConstraints.max is a Float.
    max: 50 * 1024 * 1024 * 1024,
  },
  {
    key: 'upload_pending_scans',
    type: 'INTEGER',
    category: 'uploads',
    description: 'Files one person may have waiting on the remote scanner. Until an admin saves this, UPLOAD_PENDING_SCANS applies (default 5).',
    defaultValue: 5,
    environmentFallback: true,
    nullable: false,
    min: 1,
    max: 1000,
  },
  {
    key: 'uploads_per_ip_per_minute',
    type: 'INTEGER',
    category: 'uploads',
    description: 'Upload URLs one client address may ask for per minute. Until an admin saves this, UPLOADS_PER_IP_PER_MINUTE applies (default 30).',
    defaultValue: 30,
    environmentFallback: true,
    nullable: false,
    min: 1,
    max: 10_000,
  },
  {
    key: 'scan_queue_concurrency',
    type: 'INTEGER',
    category: 'uploads',
    description: 'Scan jobs the worker runs at once. Match the scanner host. Read when the worker starts. Until an admin saves this, SCAN_QUEUE_CONCURRENCY applies (default 2).',
    defaultValue: 2,
    environmentFallback: true,
    nullable: false,
    min: 1,
    max: 8,
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
  {
    key: PUBLIC_NOTES_REQUIRE_VERIFICATION,
    type: 'BOOLEAN',
    category: 'notes',
    description: 'When on, an unverified account cannot set a note or a quiz to Public. Private, Shared and Unlisted stay available. A missing row means on. A verification gate may set the actor flag mayPublishPublic, which wins over this switch.',
    defaultValue: true,
    environmentFallback: false,
    nullable: false,
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
  if (def.key === UNVERIFIED_GATED_ACTIONS_SETTING) {
    const parsed = parseUnverifiedGateSetting(raw)
    if (!parsed.ok) return parsed
    return { ok: true, value: [...parsed.actions].join(',') }
  }
  if (def.maxLength !== undefined && raw.length > def.maxLength) return { ok: false, message: `Use at most ${def.maxLength} characters.` }
  if (def.pattern && !new RegExp(def.pattern).test(raw)) return { ok: false, message: 'That value does not match the expected pattern.' }
  return { ok: true, value: raw }
}

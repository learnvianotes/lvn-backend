/**
 * Google Play Families gates that are the same in every context (ADR-0112).
 * A minor is under 18 or has no known age. Under-13 is the guardian age band, decided in `users`.
 */

export const FEATURE_UNAVAILABLE_FOR_MINOR_MESSAGE = 'This isn’t available on this account yet.'

export const MINOR_PII_BLOCKED_MESSAGE = 'Remove phone numbers, email addresses, street addresses and social handles before sending this.'

/** Admin setting. `block` refuses the write, `redact` stores a cleaned copy, `off` stores the text as written. */
export const MINOR_PII_FILTER_MODES = ['block', 'redact', 'off'] as const
export type MinorPiiMode = (typeof MINOR_PII_FILTER_MODES)[number]

export const DEFAULT_MINOR_PII_FILTER_MODE: MinorPiiMode = 'block'

export function minorPiiMode(value: string | null | undefined): MinorPiiMode {
  if (value === 'redact' || value === 'off' || value === 'block') return value
  return DEFAULT_MINOR_PII_FILTER_MODE
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
/** An Indian mobile, with or without +91, and an international number that starts with +. */
const PHONE = /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)|(?<!\d)\+\d{1,3}[\s.-]?(?:\d[\s.-]?){7,14}\d(?!\d)/g
/** A house number plus a street-style name. A bare word such as "Road" in a title does not match. */
const STREET = /\b\d{1,6}[A-Za-z]?\s+(?:[A-Z0-9][A-Za-z0-9.'-]{0,30}\s+){1,4}(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Drive|Dr\.?|Nagar|Marg|Colony|Sector|Block)\b/g
const HOUSE = /\b(?:H\.?\s*No\.?|House)\s*[:#]?\s*\d{1,6}\b/gi
const SOCIAL_URL = /\b(?:https?:\/\/)?(?:www\.)?(?:instagram|twitter|tiktok|snapchat|facebook|fb|linkedin|telegram|discord|x)\.(?:com|me|gg)\/[A-Za-z0-9._-]{2,}/gi
/** @name, after emails are gone so an address is not also a handle. */
const HANDLE = /(?<![A-Za-z0-9._%+-])@[A-Za-z][A-Za-z0-9._]{1,29}\b/g

export const PII_REDACTION = '[removed]'

/** True when the text contains a phone, email, street address or social handle. */
export function containsMinorPii(text: string): boolean {
  return maskMinorPii(text) !== text
}

/** Replaces each match with `[removed]`. Study text with none of these is unchanged. */
export function maskMinorPii(text: string): string {
  return text
    .replace(EMAIL, PII_REDACTION)
    .replace(PHONE, PII_REDACTION)
    .replace(STREET, PII_REDACTION)
    .replace(HOUSE, PII_REDACTION)
    .replace(SOCIAL_URL, PII_REDACTION)
    .replace(HANDLE, PII_REDACTION)
}

export interface MinorPiiOutcome {
  mode: MinorPiiMode
  blocked: boolean
  changed: boolean
  text: string
}

/** What to do with one piece of text a minor wrote. Adults are not passed here. */
export function applyMinorPii(text: string, mode: MinorPiiMode): MinorPiiOutcome {
  if (mode === 'off') return { mode, blocked: false, changed: false, text }
  const masked = maskMinorPii(text)
  const changed = masked !== text
  if (mode === 'block') return { mode, blocked: changed, changed: false, text }
  return { mode, blocked: false, changed, text: masked }
}

/**
 * Walks a rich-text document (and any JSON value) and rewrites string leaves.
 * `block` does not rewrite: the caller refuses when `blocked` is true.
 */
export function applyMinorPiiValue(value: unknown, mode: MinorPiiMode): { blocked: boolean; changed: boolean; value: unknown } {
  if (mode === 'off') return { blocked: false, changed: false, value }
  let blocked = false
  let changed = false
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      const outcome = applyMinorPii(node, mode)
      if (outcome.blocked) blocked = true
      if (outcome.changed) changed = true
      return mode === 'redact' ? outcome.text : node
    }
    if (Array.isArray(node)) return node.map((item) => walk(item))
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(node)) out[key] = walk(child)
      return out
    }
    return node
  }
  const next = walk(value)
  return { blocked, changed, value: mode === 'redact' ? next : value }
}

/**
 * Uploads a client can tell us are a camera, microphone, or a video or audio file.
 * Still images are not in this list: the upload intent has a purpose and a MIME type, and no capture source,
 * so a camera photo and a gallery photo are the same `image/*` upload.
 */
export function isCaptureUpload(purpose: string, mimeType: string): boolean {
  if (purpose === 'VOICE_NOTE') return true
  const mime = mimeType.trim().toLowerCase()
  return mime.startsWith('audio/') || mime.startsWith('video/')
}

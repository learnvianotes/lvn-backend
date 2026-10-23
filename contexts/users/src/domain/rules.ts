import { z } from 'zod'

/** Current versions of the Terms, Privacy Policy and public-content licence (§15.2). Bump on a material change. */
export const TERMS_VERSION = '2026-10-08'

export const SESSION_TTL_DAYS = 30
export const VERIFY_EMAIL_TTL_HOURS = 24
export const RESET_PASSWORD_TTL_MINUTES = 60

/** §7.1 rate limits. */
export const LIMITS = {
  signIn: { max: 5, windowSeconds: 15 * 60 },
  /**
   * Credential stuffing: failed sign-ins from one network across any number of accounts. Only failures count, so a
   * campus behind one address is not locked out by people signing in normally.
   */
  signInFailuresPerNetwork: { max: 50, windowSeconds: 15 * 60 },
  passwordReset: { max: 3, windowSeconds: 60 * 60 },
  verifyEmailResend: { max: 3, windowSeconds: 60 * 60 },
  /** Emails that attach a password to an account that already exists (ADR-0100). */
  linkEmail: { max: 3, windowSeconds: 60 * 60 },
} as const

/** §7.1: at least 10 characters; the upper bound keeps hashing cheap for absurd inputs. */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email({ message: 'Enter a valid email address.' }))
  .transform((e) => e.toLowerCase())

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(60, 'Use at most 60 characters.')
  .refine((s) => !/[<>]/.test(s) && ![...s].some((c) => c.charCodeAt(0) < 0x20), 'Use letters, numbers and simple punctuation.')

/** YYYY-MM-DD, a real calendar date (no 30 February), not in the future and not before 1900. */
export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, 'Enter a real date.')
  .transform((s) => new Date(`${s}T00:00:00Z`))
  .refine((d) => d.getTime() <= Date.now(), 'The date of birth cannot be in the future.')
  .refine((d) => d.getUTCFullYear() >= 1900, 'Enter a real date of birth.')

/** Whole years between `dateOfBirth` and `on` (UTC dates). */
export function ageOn(dateOfBirth: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const birthdayPassed =
    on.getUTCMonth() > dateOfBirth.getUTCMonth() || (on.getUTCMonth() === dateOfBirth.getUTCMonth() && on.getUTCDate() >= dateOfBirth.getUTCDate())
  if (!birthdayPassed) age--
  return age
}

/**
 * ADR-0091: whether a date of birth is too young for an account at all. 0 means no minimum. Only the outcome matters to
 * the caller; the refusal never says where the line is before the person has answered.
 */
export function isBelowMinimumAge(dateOfBirth: Date, minimumAge: number, on = new Date()): boolean {
  return minimumAge > 0 && ageOn(dateOfBirth, on) < minimumAge
}

/** What a refused person reads (web and phone show it, and remember the refusal on the device for a day). */
export const UNDER_MINIMUM_AGE_MESSAGE = 'Sorry, you can’t create an account. LearnViaNotes accounts are only for adults; you can still read the public notes without one.'

/**
 * A minor without verified guardian or institutional consent (§15.2): private notes and classroom content only, no
 * public publishing, no DMs, no behavioural recommendations. Unknown date of birth (registration not finished) is
 * treated as restricted.
 */
export function isRestrictedMinor(dateOfBirth: Date | null, consentAge: number, hasGuardianConsent: boolean, on = new Date()): boolean {
  if (hasGuardianConsent) return false
  if (!dateOfBirth) return true
  return ageOn(dateOfBirth, on) < consentAge
}

/**
 * Letters and digits only, so `Learn-Via-Notes`, `LearnViaNotes` and `learn_via_notes` are one handle.
 * The same folding as a new account's slug.
 */
export function handleKey(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Handles no person may take. Email sign-up, Google sign-up and a later handle edit all refuse these.
 * Compared on {@link handleKey}. The product name is reserved in every form (`learnvianotes`, `learn-via-notes`,
 * `lvn`, and a handle that contains those), and so are staff-shaped names (`admin`, `support`, `official`,
 * `system`, `publisher`, and the same kind of name).
 */
const RESERVED_HANDLES = new Set([
  'admin',
  'administrator',
  'admins',
  'support',
  'official',
  'system',
  'publisher',
  'moderator',
  'moderators',
  'moderation',
  'staff',
  'root',
  'help',
  'helpdesk',
  'security',
  'abuse',
  'noreply',
  'postmaster',
  'webmaster',
  'hostmaster',
  'operator',
  'ops',
  'owner',
  'founder',
  'billing',
  'legal',
  'privacy',
  'trust',
  'safety',
  'press',
  'contact',
  'newsletter',
  'anonymous',
  'deleted',
  'guest',
  'team',
  'info',
  'mail',
  'bot',
  'null',
  'test',
  'api',
  'www',
  'notes',
])

/** Role names long enough that `superadmin` or `adminrao` is the same reservation, without swallowing short names. */
const RESERVED_AFFIXES = ['admin', 'administrator', 'support', 'official', 'system', 'publisher', 'moderator', 'moderation']

export function isReservedHandle(handle: string): boolean {
  const key = handleKey(handle)
  if (!key) return false
  if (RESERVED_HANDLES.has(key)) return true
  if (key.includes('learnvianotes') || key.includes('learnvia') || key.includes('lvn')) return true
  return RESERVED_AFFIXES.some((role) => key.startsWith(role) || key.endsWith(role))
}

/**
 * A handle someone chose. Brand and role handles are refused. Stored as the folded key, so a hyphen
 * cannot hide `learn-via-notes`.
 */
export const handleSchema = z
  .string()
  .trim()
  .transform((value) => handleKey(value))
  .refine((key) => key.length >= 3 && key.length <= 30, 'Use 3 to 30 letters or numbers.')
  .refine((key) => !isReservedHandle(key), 'That handle is reserved.')

/**
 * Handle for a new account: the name as a lowercase slug. A reserved brand or role slug is not offered;
 * those names get `learner`, and freeHandle adds digits when that is taken. People can change it later,
 * except onto a reserved handle.
 */
export function handleBase(displayName: string): string {
  const key = handleKey(displayName)
  if (isReservedHandle(key)) return 'learner'
  const slug = key.slice(0, 20)
  const base = slug.length >= 3 ? slug : `learner${slug}`
  return isReservedHandle(base) ? 'learner' : base
}

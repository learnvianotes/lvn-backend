import { z } from 'zod'
import { AI_MINOR_AGE } from '@lvn/contracts/domain'
import { hasVerifiedGuardianConsent } from './guardian-consent'
import type { GuardianVerificationSettings } from './guardian-verification'

/**
 * Built-in version of the Terms, Privacy Policy and public-content licence (§15.2), all three accepted together.
 * ADR-0103: the version in effect is the admin setting `terms_version`, else the TERMS_VERSION environment variable,
 * else this. Read it through TermsVersionProvider, never directly.
 */
export const DEFAULT_TERMS_VERSION = '2026-11-12'

/**
 * Built-in list of versions whose text lvn-web has published (`features/legal/documents.ts`). ADR-0103: an admin may
 * only choose one of these. The admin setting `terms_published_versions`, else TERMS_PUBLISHED_VERSIONS, replaces it.
 * `2026-11-12` is the 13+ terms update (ADR-0113). Older dates stay so an acceptance of them is still a known version.
 */
export const DEFAULT_PUBLISHED_TERMS_VERSIONS: readonly string[] = ['2026-10-08', '2026-11-03', '2026-11-12']

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
  /**
   * Password-reset mail to many addresses from one network. The per-address cap above does not stop that.
   * High enough that a campus behind one address can still ask for resets.
   */
  passwordResetPerNetwork: { max: 40, windowSeconds: 60 * 60 },
  /**
   * New accounts (and the verification mail they send) from one network. Anonymous GraphQL has no per-person cap;
   * address floods are still the edge's job, and this stops one address creating accounts without a bound.
   * The suite shares one Redis and one loopback address, so the ceiling sits above what the tests create in an hour.
   */
  signUpPerNetwork: { max: 300, windowSeconds: 60 * 60 },
  verifyEmailResend: { max: 3, windowSeconds: 60 * 60 },
  /** Emails that attach a password to an account that already exists (ADR-0100). */
  linkEmail: { max: 3, windowSeconds: 60 * 60 },
  /** Sign-in codes emailed to one account. */
  mfaSend: { max: 5, windowSeconds: 60 * 60 },
  /**
   * Sign-in codes from one network. High enough for several admins behind one address,
   * low enough that one network cannot mail codes without a bound.
   */
  mfaSendPerNetwork: { max: 30, windowSeconds: 60 * 60 },
  /** Code checks for one account. Wrong attempts are also capped on the challenge itself. */
  mfaVerify: { max: 10, windowSeconds: 15 * 60 },
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

/** ADR-0104: a typed age outside these whole years is a typo, not an age. */
export const AGE_MIN = 1
export const AGE_MAX = 120

const AGE_RANGE_MESSAGE = `Enter an age from ${AGE_MIN} to ${AGE_MAX}.`

/**
 * ADR-0104: the age a person types at sign-up and registration, in whole years. The message never names the minimum
 * age for an account (ADR-0091).
 */
export const ageSchema = z
  .number({ message: 'Enter your age as a whole number.' })
  .int('Enter your age as a whole number.')
  .min(AGE_MIN, AGE_RANGE_MESSAGE)
  .max(AGE_MAX, AGE_RANGE_MESSAGE)

/**
 * YYYY-MM-DD, a real calendar date (no 30 February), not in the future and not before 1900. Since ADR-0104 only the
 * deprecated `dateOfBirth` input of older apps and an admin's correction use it.
 */
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
 * What an account holds about its holder's age (ADR-0104). Accounts registered before ADR-0104 (and admin corrections)
 * have a date of birth. Newer ones have the whole-number age given at registration and when it was given. An
 * unfinished registration has neither.
 */
export interface AgeFacts {
  dateOfBirth: Date | null
  declaredAge: number | null
  ageDeclaredAt: Date | null
}

/** `day` moved by whole years. 29 February becomes 1 March in a year without one, which is the day ageOn turns over. */
function addYears(day: Date, years: number): Date {
  const out = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  out.setUTCFullYear(out.getUTCFullYear() + years)
  return out
}

/**
 * ADR-0104: whole years of age on `on`. A stored date of birth decides when there is one. Otherwise the declared age
 * plus the whole years since it was declared. Someone who said 17 may turn 18 the next day but is counted 18 only a
 * year after saying 17, so the result is never older than the person. null when the account holds neither.
 */
export function ageOf(facts: AgeFacts, on: Date = new Date()): number | null {
  if (facts.dateOfBirth) return ageOn(facts.dateOfBirth, on)
  if (facts.declaredAge === null || !facts.ageDeclaredAt) return null
  return facts.declaredAge + Math.max(0, ageOn(facts.ageDeclaredAt, on))
}

/**
 * Families policy: under 18, or an age the account does not hold. Guardian consent does not change it, and it does
 * not follow the admin consent age.
 */
export function isAiMinor(facts: AgeFacts, on: Date = new Date()): boolean {
  const age = ageOf(facts, on)
  return age === null || age < AI_MINOR_AGE
}

/**
 * The first UTC day on which `ageOf` reaches `age` (people search's `adultFrom`, ADR-0055), or null when no age is
 * known. A declared age that already reached it gives the day it was declared.
 */
export function dayReachingAge(facts: AgeFacts, age: number): Date | null {
  if (facts.dateOfBirth) return addYears(facts.dateOfBirth, age)
  if (facts.declaredAge === null || !facts.ageDeclaredAt) return null
  return addYears(facts.ageDeclaredAt, Math.max(0, age - facts.declaredAge))
}

/**
 * The latest UTC day `X` with `ageOn(X, on) >= years`: a date of birth on or before it is at least that old on `on`.
 * On 29 February the same day `years` back may not exist; 28 February is then the latest.
 */
export function latestDayYearsBefore(on: Date, years: number): Date {
  const year = on.getUTCFullYear() - years
  const lastOfMonth = new Date(Date.UTC(year, on.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, on.getUTCMonth(), Math.min(on.getUTCDate(), lastOfMonth)))
}

/**
 * ADR-0091: whether an age is too young for an account at all. 0 means no minimum. Only the outcome matters to the
 * caller; the refusal never says where the line is before the person has answered.
 */
export function isBelowMinimumAge(age: number, minimumAge: number): boolean {
  return minimumAge > 0 && age < minimumAge
}

/**
 * What a refused person reads (web and phone show it, and remember the refusal on the device for a day).
 * It does not name the cut-off (ADR-0091). The floor is at least 13 (ADR-0113), from `account_minimum_age` when that
 * setting is 13 or higher.
 */
export const UNDER_MINIMUM_AGE_MESSAGE = 'Sorry, you can’t create an account. You can still read the public notes without one.'

/** Stored on an AGE_BLOCKED account. It does not name the cut-off. */
export const AGE_BLOCK_REASON = 'Below the minimum age for an account.'

/** The sign-up and sign-in message, including the address the client shows as "contact admin at <email>". */
export function ageRestrictedMessage(supportEmail: string): string {
  return `${UNDER_MINIMUM_AGE_MESSAGE} Contact an admin at ${supportEmail}.`
}

/**
 * A minor without verified guardian consent (§15.2): private notes and classroom content only, no public
 * publishing, no DMs, no behavioural recommendations. The age is `ageOf` (ADR-0104). An unknown age (registration
 * not finished) is treated as restricted.
 *
 * `methods` are guardian consent methods (`auto_unverified`, `email_plus`, `verified`, …). Only a method that
 * currently counts as verified lifts the limits (ADR-0109, ADR-0110). `auto_unverified`, recorded at sign-up,
 * does not. `email_plus` does only while its admin setting is on. An empty list does not.
 */
export function isRestrictedMinor(
  facts: AgeFacts,
  consentAge: number,
  methods: readonly (string | null | undefined)[] = [],
  on = new Date(),
  verification: GuardianVerificationSettings = { emailPlusEnabled: true },
): boolean {
  if (hasVerifiedGuardianConsent(methods, verification)) return false
  const age = ageOf(facts, on)
  return age === null || age < consentAge
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

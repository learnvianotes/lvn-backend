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

/** Handle for a new account: the name as a lowercase slug plus a short suffix (users can change it later). */
export function handleBase(displayName: string): string {
  const slug = displayName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20)
  return slug.length >= 3 ? slug : `learner${slug}`
}

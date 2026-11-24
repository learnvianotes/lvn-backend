/**
 * Pluggable parent verification (ADR-0110).
 *
 * A method is a small object registered here. Adding one later is code: the `method` column is text, so a new id
 * does not need a migration. Sign-up always records `auto_unverified`. That method never lifts restricted-minor
 * limits. `email_plus` becomes the row's method, with `verifiedAt`, only after the parent clicks the confirm link.
 * Opening or receiving the email does not. While the admin setting is on (the default), `email_plus` lifts limits
 * for every minor, including under 13. Turning the setting off leaves the row as it is and stops it counting.
 * `verified` stays the legacy method (a ConsentRecord of kind GUARDIAN is reported as this id).
 */

export interface GuardianVerificationSettings {
  /** Admin setting `guardian_email_plus_enabled`. Default on. */
  emailPlusEnabled: boolean
}

export interface GuardianVerificationMethod {
  readonly id: string
  /** Whether a parent can complete this method now. */
  enabled(settings: GuardianVerificationSettings): boolean
  /** Whether a recorded row of this method lifts restricted-minor limits. */
  liftsRestrictions(settings: GuardianVerificationSettings): boolean
}

export const GUARDIAN_EMAIL_PLUS_ENABLED_SETTING = 'guardian_email_plus_enabled'

/** Withdrawal suspends the account only while this is on. Default off: the account returns to restricted use. */
export const GUARDIAN_CONSENT_REQUIRED_FOR_ACCESS_SETTING = 'guardian_consent_required_for_access'

export const GUARDIAN_LINK_TTL_HOURS_SETTING = 'guardian_link_ttl_hours'

export const GUARDIAN_MANAGE_SESSION_MINUTES_SETTING = 'guardian_manage_session_minutes'

export const GUARDIAN_LINK_RESEND_PER_HOUR_SETTING = 'guardian_link_resend_per_hour'

export const MINOR_PURGE_WINDOW_DAYS_SETTING = 'minor_purge_window_days'

export const DEFAULT_GUARDIAN_LINK_TTL_HOURS = 72

export const DEFAULT_GUARDIAN_MANAGE_SESSION_MINUTES = 60

export const DEFAULT_GUARDIAN_LINK_RESEND_PER_HOUR = 3

/** Owner decision: the minor purge window defaults to 14 days, and an admin can change it. */
export const DEFAULT_MINOR_PURGE_WINDOW_DAYS = 14

export const MINOR_PURGE_WINDOW_DAYS_MIN = 1

export const MINOR_PURGE_WINDOW_DAYS_MAX = 90

/** Shown on the account when withdrawal suspends access. No names or addresses. */
export const GUARDIAN_CONSENT_WITHDRAWN_REASON = 'A parent withdrew consent.'

const AUTO_UNVERIFIED: GuardianVerificationMethod = {
  id: 'auto_unverified',
  enabled: () => true,
  liftsRestrictions: () => false,
}

const EMAIL_PLUS: GuardianVerificationMethod = {
  id: 'email_plus',
  enabled: (settings) => settings.emailPlusEnabled,
  liftsRestrictions: (settings) => settings.emailPlusEnabled,
}

const VERIFIED: GuardianVerificationMethod = {
  id: 'verified',
  enabled: () => true,
  liftsRestrictions: () => true,
}

const METHODS = new Map<string, GuardianVerificationMethod>([
  [AUTO_UNVERIFIED.id, AUTO_UNVERIFIED],
  [EMAIL_PLUS.id, EMAIL_PLUS],
  [VERIFIED.id, VERIFIED],
])

/**
 * A later method (a card check, DigiLocker, …) calls this at startup. Unknown ids stay disabled and never lift
 * limits, which is the safe side of a typo.
 */
export function registerGuardianVerificationMethod(method: GuardianVerificationMethod): void {
  METHODS.set(method.id, method)
}

export function verificationMethod(id: string): GuardianVerificationMethod {
  return (
    METHODS.get(id) ?? {
      id,
      enabled: () => false,
      liftsRestrictions: () => false,
    }
  )
}

export function methodLiftsRestrictions(method: string | null | undefined, settings: GuardianVerificationSettings): boolean {
  return method != null && verificationMethod(method).liftsRestrictions(settings)
}

/** What the direct notice tells a parent. Transactional: no offer, no list to join. */
export const GUARDIAN_NOTICE_COLLECTS = [
  'The child’s name, age and email address',
  'Notes, files and learning activity they create',
  'Sign-in sessions and push tokens for their devices',
  'This parent or guardian email address, stored with the consent record',
] as const

export const GUARDIAN_NOTICE_WHY = 'To provide the LearnViaNotes account the child created, including private notes and classes, and only the features their age allows.'

export const GUARDIAN_NOTICE_PROCESSORS = [
  'LearnViaNotes, to run the account',
  'Google Firebase, for Google sign-in and push delivery when those are used',
  'Cloudflare R2, for files the child stores',
  'Resend, to send this message and other account email',
] as const

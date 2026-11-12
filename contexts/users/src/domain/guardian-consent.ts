/**
 * Guardian consent recorded when someone under 18 signs up (ADR-0109).
 *
 * Age bands, stored on the row so a later re-consent can query them:
 * - `under_13`: sign-up age below 13. With the admin floor at 5 this is ages 5–12
 *   (Google Play Families). One band, so every under-13 account is one query.
 * - `13_15`: 13, 14 or 15.
 * - `16_17`: 16 or 17.
 * - 18 or older: no row.
 *
 * `auto_unverified` is written at sign-up with no check of a parent. It does not lift
 * restricted-minor limits. Only `verified` does. A `ConsentRecord` of kind GUARDIAN is the
 * older verified-consent row (it has no method) and still lifts those limits. Sign-up does
 * not write that row.
 */

/** Written for every admitted sign-up under 18. Not a verified consent. */
export const GUARDIAN_CONSENT_AUTO_UNVERIFIED = 'auto_unverified'

/**
 * The method a later verified-consent flow records. The only method that lifts public
 * publishing, direct messages, behavioural recommendations and usage analytics.
 */
export const GUARDIAN_CONSENT_VERIFIED = 'verified'

/** Sign-up ages under this get a guardian consent row. Not the admin minimum, and not `digital_consent_age`. */
export const GUARDIAN_CONSENT_UNDER = 18

/** Admin setting `account_minimum_age` when no row is saved. Under-13 sign-up stays off. */
export const DEFAULT_ACCOUNT_MINIMUM_AGE = 13

/** Lowest value an admin may save. 5 admits ages 5–12. 4 cannot sign up. */
export const ACCOUNT_MINIMUM_AGE_MIN = 5

export const ACCOUNT_MINIMUM_AGE_MAX = 21

/** Admin setting `guardian_notice_version` when no row is saved. */
export const GUARDIAN_NOTICE_VERSION_SETTING = 'guardian_notice_version'

export const DEFAULT_GUARDIAN_NOTICE_VERSION = '2026-11-11'

export type SignUpAgeBand = 'under_13' | '13_15' | '16_17'

const VERIFIED_METHODS: ReadonlySet<string> = new Set([GUARDIAN_CONSENT_VERIFIED])

/** True only for a verified consent method. `auto_unverified` and anything unknown are false. */
export function guardianConsentLiftsRestrictions(method: string | null | undefined): boolean {
  return method != null && VERIFIED_METHODS.has(method)
}

export function hasVerifiedGuardianConsent(methods: readonly (string | null | undefined)[]): boolean {
  return methods.some((method) => guardianConsentLiftsRestrictions(method))
}

/**
 * Methods to pass to `isRestrictedMinor`. A legacy `ConsentRecord` of kind GUARDIAN counts as
 * `verified`. Rows on `GuardianConsent` contribute their own method, so `auto_unverified` does not.
 */
export function methodsFromConsentRows(row: {
  consents?: readonly { kind?: string | null }[] | null
  guardianConsents?: readonly { method: string }[] | null
}): string[] {
  const legacy = (row.consents ?? []).some((consent) => consent.kind === 'GUARDIAN')
  return [...(legacy ? [GUARDIAN_CONSENT_VERIFIED] : []), ...(row.guardianConsents ?? []).map((consent) => consent.method)]
}

/** The band stored at sign-up, or null when the age is 18 or older (no guardian row). */
export function signUpAgeBand(age: number): SignUpAgeBand | null {
  if (!Number.isInteger(age) || age >= GUARDIAN_CONSENT_UNDER) return null
  if (age < 13) return 'under_13'
  if (age <= 15) return '13_15'
  return '16_17'
}

/** Fields for the guardian row, or null when this age does not get one. The caller supplies the id. */
export function guardianConsentFields(age: number, noticeVersion: string, recordedAt: Date): {
  kind: 'GUARDIAN'
  method: typeof GUARDIAN_CONSENT_AUTO_UNVERIFIED
  noticeVersion: string
  recordedAt: Date
  ageBand: SignUpAgeBand
} | null {
  const ageBand = signUpAgeBand(age)
  if (!ageBand) return null
  return { kind: 'GUARDIAN', method: GUARDIAN_CONSENT_AUTO_UNVERIFIED, noticeVersion, recordedAt, ageBand }
}

import { hasVerifiedGuardianConsent } from './guardian-consent'
import type { GuardianVerificationSettings } from './guardian-verification'
import { ageOf, isAiMinor, type AgeFacts } from './rules'

/**
 * Who the Families gates apply to (ADR-0112).
 * A minor is under 18, or an account with no age. Under-13 is the guardian age band `under_13`,
 * and also a known age under 13 when the band was never stored.
 * Verified consent is the #72/#73 rule: `email_plus` after the click, or the legacy `verified` method.
 */
export interface FamiliesStanding {
  minor: boolean
  under13: boolean
  consentVerified: boolean
  /** The parent's stored choice. It does not apply until consent is verified. */
  socialEnabled: boolean
  safetyReminderAcknowledgedAt: Date | null
}

export function familiesStandingFrom(input: {
  facts: AgeFacts
  ageBand: string | null
  methods: readonly (string | null | undefined)[]
  socialEnabled: boolean
  safetyReminderAcknowledgedAt: Date | null
  verification?: GuardianVerificationSettings
  on?: Date
}): FamiliesStanding {
  const age = ageOf(input.facts, input.on)
  return {
    minor: isAiMinor(input.facts, input.on),
    under13: input.ageBand === 'under_13' || (age !== null && age < 13),
    consentVerified: hasVerifiedGuardianConsent(input.methods, input.verification),
    socialEnabled: input.socialEnabled === true,
    safetyReminderAcknowledgedAt: input.safetyReminderAcknowledgedAt,
  }
}

/** Push, FCM, camera, microphone, audio and video stay off until consent is verified. */
export function under13DevicesClosed(standing: Pick<FamiliesStanding, 'under13' | 'consentVerified'>): boolean {
  return standing.under13 && !standing.consentVerified
}

/**
 * Groups, classes, doubts, direct messages and public posts stay off until a parent turns them on.
 * The stored choice is ignored until consent is verified. Ages 13–17 are not this gate.
 */
export function under13SocialClosed(standing: Pick<FamiliesStanding, 'under13' | 'consentVerified' | 'socialEnabled'>): boolean {
  return standing.under13 && !(standing.consentVerified && standing.socialEnabled)
}

/** Minors, including an unknown age, until they acknowledge the reminder. Adults are false. */
export function safetyReminderRequired(standing: Pick<FamiliesStanding, 'minor' | 'safetyReminderAcknowledgedAt'>): boolean {
  return standing.minor && standing.safetyReminderAcknowledgedAt == null
}

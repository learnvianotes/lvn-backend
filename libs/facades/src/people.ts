import type { GlobalRole } from '@lvn/contracts/domain'

/**
 * People, as other contexts need them: finding the person a note is shared with, by handle or email. Answered by the
 * `users` context; nothing private (no email, no date of birth or age) comes back.
 */
export const PEOPLE = Symbol('PEOPLE')

export interface Person {
  id: string
  handle: string
  displayName: string
  globalRole: GlobalRole
}

/**
 * What people search indexes of an account (ADR-0055). `adultFrom` is the day the account passes the digital-consent
 * age (§15.2): search decides with it who may be found, while the date of birth or declared age (ADR-0104) stays in `users`.
 */
export interface SearchProfile extends Person {
  headline: string | null
  bio: string | null
  adultFrom: Date
}

export interface People {
  /** The account with this handle (with or without @) or email address, or null; deleted accounts are not found. */
  find(handleOrEmail: string): Promise<Person | null>
  /**
   * People whose handle starts with, or whose name contains, the words — for search. Minors are never listed, and
   * neither is anyone the viewer blocked or who blocked the viewer (ADR-0043).
   */
  search(query: string, limit: number, viewerId?: string | null): Promise<Person[]>
  /** Everyone `userId` blocked or was blocked by (ADR-0043): their content is left out of what `userId` sees. */
  blockedIds(userId: string): Promise<string[]>
  /** Either of the two blocked the other: no new interaction between them (ADR-0016). */
  blockedBetween(a: string, b: string): Promise<boolean>
  /** The teachers `userId` is connected with (ADR-0013, ADR-0044). */
  connectionIds(userId: string): Promise<string[]>
  /** The two are connected. */
  connected(a: string, b: string): Promise<boolean>
  /** Display names by id, for push text and emails (ADR-0050); deleted accounts are left out. */
  namesOf(ids: string[]): Promise<Record<string, string>>
  /** Where `communication` writes to a person (ADR-0050): their sign-in email and name; null for deleted accounts. */
  contactOf(userId: string): Promise<{ email: string; displayName: string; restrictedMinor: boolean } | null>
  /** When the account was made (ADR-0069: Rhythm misses nothing from before); null for deleted accounts. */
  joinedAt(userId: string): Promise<Date | null>
  /** The notes topics `userId` chose as interests on their study profile (ADR-0071: recommendations). */
  interestTopicIds(userId: string): Promise<string[]>
  /** Who `userId` follows, most recent first, at most 2,000 (ADR-0049: the Following feed). */
  followingIds(userId: string): Promise<string[]>
  /** `restricterId` restricts `restrictedId` (ADR-0016): their comments wait for approval and cause no notification. */
  restricts(restricterId: string, restrictedId: string): Promise<boolean>
  /** People search's documents for these accounts (ADR-0055); deleted accounts and ones with no known age are left out. */
  searchProfiles(ids: string[]): Promise<SearchProfile[]>
  /** Account ids after `after`, in id order, `take` at a time: for re-indexing everyone (ADR-0055). */
  personIdsAfter(after: string | null, take: number): Promise<string[]>
  /**
   * Under 18, or an age this account does not hold, including a deleted account (Families policy).
   * Guardian consent does not change it. This is not the admin consent age.
   */
  isMinorForAi(userId: string): Promise<boolean>
  /**
   * Age band, verified consent and the parent social choice (ADR-0112). Null when the account is gone.
   * `minor` is under 18 or an unknown age. `under13` is the guardian age band, or a known age under 13.
   */
  familiesStanding(userId: string): Promise<FamiliesStanding | null>
  /** Throws FEATURE_UNAVAILABLE_FOR_MINOR when an under-13 account has no verified consent. */
  assertDevicesOpen(userId: string): Promise<void>
  /**
   * Throws FEATURE_UNAVAILABLE_FOR_MINOR when an under-13 account may not use groups, classes, doubts,
   * direct messages or public posts. Ages 13–17 are not this gate. There is no direct-message store yet;
   * a message write calls this same check.
   */
  assertSocialOpen(userId: string): Promise<void>
  /** Throws FEATURE_UNAVAILABLE_FOR_MINOR for a camera, microphone, audio or video upload while devices are closed. */
  assertCaptureAllowed(userId: string, purpose: string, mimeType: string): Promise<void>
  /** Of these accounts, the ones whose under-13 social features are still off. */
  socialClosedIds(userIds: string[]): Promise<string[]>
  /**
   * The text a minor may store. Block mode throws MINOR_PII_BLOCKED. Redact mode returns the cleaned text.
   * An adult's text is returned unchanged.
   */
  filterMinorText(userId: string, text: string): Promise<string>
  /** The same filter for a rich-text document or other JSON value. */
  filterMinorDoc(userId: string, doc: unknown): Promise<unknown>
}

/** What Families gates read. `socialEnabled` is the stored parent choice and applies only with verified consent. */
export interface FamiliesStanding {
  minor: boolean
  under13: boolean
  consentVerified: boolean
  socialEnabled: boolean
  safetyReminderAcknowledgedAt: Date | null
}

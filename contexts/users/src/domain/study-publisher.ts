/**
 * The account that owns the seeded study notes (ADR-0098).
 *
 * It is not a person. The address is on the reserved `.invalid` domain (RFC 2606), so it cannot receive mail.
 * `passwordHash`, `emailVerifiedAt`, `dateOfBirth`, `declaredAge`, `verifiedAt` and `verificationMethod` are left
 * null: nothing here is a credential, and the columns are nullable, so an age and a document-verification flag are
 * not required to store the row. Sign-in is refused in `AuthService`, `OAuthService` and `SessionService` — a password,
 * a reset link, an email-link sign-up or a provider link cannot attach, even if those columns are filled in later.
 *
 * The same id and email are created by `contexts/notes` study-content sync. Keep the two copies identical.
 * The handle `learnvianotes` belongs to this account. Sign-up will not give it to a person. If some other account
 * already holds it, the sync stops instead of publishing the notes under that account.
 */
export const STUDY_PUBLISHER_ID = '019a118c-f480-7000-8000-000000000001'
export const STUDY_PUBLISHER_EMAIL = 'publisher@learnvianotes.invalid'

export function isStudyPublisher(user: { id?: string | null; email?: string | null }): boolean {
  if (user.id === STUDY_PUBLISHER_ID) return true
  return (user.email ?? '').trim().toLowerCase() === STUDY_PUBLISHER_EMAIL
}

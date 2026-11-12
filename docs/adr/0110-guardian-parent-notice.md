# ADR-0110: Parent notice, email-plus confirmation, and the minor purge window

- Status: Accepted (owner decision, 2026-11-11: email plus is the active method and is on by default; a click records consent for every minor, including under 13; the minor purge window defaults to 14 days)
- Date: 2026-11-11
- Deciders: Backend; owner
- Spec sections: §15.2 (Age, Deletion), §7 (registration), §8.4 (deletion)
- Amends: ADR-0088, ADR-0109

## Context

ADR-0109 records `auto_unverified` guardian consent for every admitted sign-up under 18 and keeps that minor restricted. It left the parent address, the notice email, and a shorter purge for minors out of scope.

The owner now wants a direct notice to a parent, a manage link, and email plus as the verification method that is on unless an admin turns it off. Consent is recorded only when the parent clicks a signed link. Opening or receiving the email does not count. That click counts for every minor, including under 13. There is no separate setting that withholds email plus from under-13 accounts. After the click, the parent gets a second email saying consent was given and how to withdraw it. Withdrawing consent returns the row to unverified and restores the restrictions.

A minor's deletion uses an admin window that defaults to 14 days, not 24 hours. Adults stay on the fixed 14-day grace. The minor purge also deletes the Firebase Auth user, FCM tokens, Firebase installation registrations and the user's R2 objects, and keeps the anonymised guardian row.

## Decision

**An admitted sign-up under 18 requires a parent email.** Email `signUp` and provider `completeRegistration` reject a missing address, an invalid address, and the child's own login email. The address is stored on `GuardianConsent.parentEmail`, not on the user. The age floor is checked first, so a blocked sign-up stays `AGE_RESTRICTED` and stores no parent address. An existing-account conflict is still a conflict, before the parent address is required.

**The row is still `auto_unverified` at sign-up.** `method` is text (`auto_unverified`, `email_plus`, `verified`, or a later id) so a new method needs no migration. `verifiedAt` stays null until a click.

**A direct notice goes to the parent** through the existing mailer (Resend when that transport is configured), after the account is stored. A mail failure does not undo sign-up. The message says what LearnViaNotes collects, why, which processors are used, the notice version, and links to confirm and to manage. It is not marketing and sets no list-unsubscribe header. The child's welcome email is unchanged.

**`email_plus` is on by default.** Admin setting `guardian_email_plus_enabled` stays, so it can be switched or replaced later. While it is on, a clicked confirm link sets `method` to `email_plus` and `verifiedAt`, for every minor including under 13. While it is off, the click is refused and the link is not spent, and an existing `email_plus` row stops lifting limits. `auto_unverified` never lifts limits. `verified` still does. Unknown methods do not. Callers that decide a restriction pass the live setting.

**Confirm and manage links are signed, expiring and single-use.** The signature uses `CODE_HMAC_SECRET`. The database stores the SHA-256 of the token. A manage link opens one session; the session lasts until it expires and is not single-use. Links can be sent again, which retires the unused link of that purpose, and resends are rate limited per account per hour. The first notice is not rate limited.

**After the click, a follow-up email is sent** saying consent was given and how to withdraw it or manage the account. That is the second email of email plus.

**Withdrawing consent** sets the row back to `auto_unverified`, clears `verifiedAt`, and retires unused confirm links, so the restrictions return. The account is suspended only when `guardian_consent_required_for_access` is on (default off). A later confirm lifts only that suspension.

**A parent manage session** can read a count summary (no email addresses, no note text), request the existing data export, withdraw consent, or schedule deletion without the child's password. The word DELETE is required.

**The minor purge window is `minor_purge_window_days`.** Default 14, range 1–90, `environmentFallback: false`. It applies when the account is still under 18. Adults keep `DELETION_GRACE_DAYS` (14) and do not use this setting. The nightly job judges each pending account on its own age, so a shorter minor window does not delete an adult early.

**A minor purge, before the usual erase,** deletes the Firebase Auth user for each Google uid, each FCM token (remote registration, then the local row), each Firebase installation (remote, then the local row), and the user's R2 objects. It then sets `parentEmail` to null and does not delete `GuardianConsent`. A retryable Firebase error is thrown so the job runs again before `deletedAt` is set. A missing Firebase project or credential is recorded as unconfigured and does not throw. Logs carry counts and the user id, not an address, token, installation id or uid.

## Consequences

- Web and mobile must send `parentEmail` on `signUp` and `completeRegistration` when the age is under 18, and add pages for `/guardian/confirm?token=` and `/guardian/manage?token=`.
- `email_plus` lifts limits for under-13 accounts after the click, while the setting stays on.
- Turning the setting off re-restricts accounts whose only verification is `email_plus`, without rewriting the row.
- A minor asked for deletion is purged after the admin window (14 days unless changed), not after a separate 24-hour clock. Adults stay at 14 days.
- Firebase installation ids are stored when a client registers one. Until then the installation step deletes nothing.
- A later method (a card check, DigiLocker) registers in code. The column is already text.

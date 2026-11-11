# Parent notice, email-plus confirmation, and the minor purge window

- Date: 2026-11-11
- Package: `@lvn/contracts` **0.82.0 → 0.83.0**
- Spec: ADR-0110 (amends ADR-0088, ADR-0109), §15.2, §7
- Depends on: the minimum-age guardian-consent change (contracts 0.82.0). Merge that first.
- Breaking: additive GraphQL fields and operations. An admitted sign-up under 18 now requires `parentEmail`.

## Why

A parent gets a direct notice when a minor account is created, and can confirm, review, withdraw or delete from a signed link. Email plus is the verification method and is on unless an admin turns it off. Consent is recorded only when the parent clicks. The minor purge window defaults to 14 days and also removes Firebase, FCM, installation registrations and R2 objects.

## Admin settings

All of these have `environmentFallback: false`. A missing row uses the default. Nothing new is read from the environment.

| Key | Type | Default |
| --- | --- | --- |
| `guardian_email_plus_enabled` | boolean | `true` |
| `guardian_consent_required_for_access` | boolean | `false` |
| `guardian_link_ttl_hours` | integer 1–336 | `72` |
| `guardian_manage_session_minutes` | integer 10–1440 | `60` |
| `guardian_link_resend_per_hour` | integer 1–20 | `3` |
| `minor_purge_window_days` | integer 1–90 | `14` |

`guardian_notice_version` is unchanged (default `2026-11-11`). There is no setting that withholds email plus from under-13 accounts.

## What changes for clients

- `SignUpInput.parentEmail` and `CompleteRegistrationInput.parentEmail`. Required when the admitted age is under 18. Optional, and ignored, at 18 or older and when the age is below the floor (that answer stays `AGE_RESTRICTED` and stores no parent address). The child's own email is `VALIDATION` on `parentEmail`. The address is not the account email.
- Public, no sign-in: `confirmGuardianConsent(token)`, `redeemGuardianManageLink(token)`, `guardianChildSummary(sessionToken)`, `guardianDataExports(sessionToken)`, `guardianRequestDataExport(sessionToken)`, `guardianWithdrawConsent(sessionToken)`, `guardianDeleteAccount(sessionToken, confirm)`.
- Signed in: `resendGuardianConfirmLink`, `resendGuardianManageLink`.
- Confirm and manage URLs the emails use: `{WEB_URL}/guardian/confirm?token=` and `{WEB_URL}/guardian/manage?token=`. Web and mobile own those pages. This API does not render them.
- `viewer.deletionScheduledFor` for a minor uses `minor_purge_window_days`. Adults stay on the 14-day grace.
- `requestAccountDeletion` description now says the minor window defaults to 14 days.

## Email templates

Sent through the existing mailer. Transactional. No list-unsubscribe header.

- `guardianNotice` — direct notice when the account is created. What is collected, why, processors, notice version, confirm link (omitted when email plus is off), manage link.
- `guardianConsentConfirmed` — sent only after the parent clicks confirm. Says consent was given and how to withdraw it or manage the account.
- `guardianManageLink` — a replacement manage link when one is sent again.

The child's welcome email is unchanged.

## Migration

`20261115100000_guardian_parent_notice`

- `GuardianConsent.method` becomes text. `users.GuardianConsentMethod` is dropped.
- Adds `GuardianConsent.verifiedAt` and `GuardianConsent.parentEmail` (citext, nullable). Purge sets `parentEmail` to null and keeps the row.
- Adds `users.GuardianLink` (`CONFIRM`, `MANAGE`, `SESSION`) and `users.FirebaseInstallation`.

No `AppSetting` row is seeded. A missing `guardian_email_plus_enabled` is on. A missing `minor_purge_window_days` is 14.

## Follow-ups, outside this repository

- Web and mobile: send `parentEmail` on `signUp` and `completeRegistration` when the age is under 18.
- Web: pages at `/guardian/confirm` and `/guardian/manage` that call the operations above. Mobile can open the same web URLs.
- Clients already read `accountMinimumAge` from the previous release. Keep doing that. Do not hard-code 13.

# ADR-0100: One account for Google and email

- Status: Accepted
- Date: 2026-10-23
- Deciders: Backend; owner (Manideep)
- Spec sections: §7, §7.1; amends ADR-0007's linking rule and ADR-0091's gate (the gate already covers provider sign-up)

## Context

People sign in with Google or with email and a password. The same person was able to end up as two users, and a Google
sign-in would attach itself to an account whose email had never been verified. That second case is an account takeover:
whoever typed the address first, without proving the inbox, would receive the Google sign-in.

Beta has no Firebase project yet, so Google has to stay off until one is configured. Turning Google on or off after
that is an application setting, not a deploy. ADR-0099 already stores that kind of switch in `users.AppSetting`
(`student_id_verification`). This decision uses the same table instead of a second settings table.

## Decision

**One user, several methods.** `User.email` is the address, normalised (trim, lowercase). Provider identities live in
`OAuthAccount(userId, provider, providerSubject)`, unique on `(provider, providerSubject)`. `providerSubject` is the
Firebase UID, the GitHub user id, or the LinkedIn `sub`. The email method is the password hash on the user, not a
second row: the address is already unique.

**Google ID tokens are verified on the server** (`firebase-admin` `verifyIdToken` for `FIREBASE_PROJECT_ID`,
`sign_in_provider == "google.com"`, `email_verified == true`). Anything else is refused and is not used to look up an
account.

**Auto-link only when both sides have verified the email.**

- The provider identity is already linked: sign in to that user. Password, role, sessions and other data stay.
- Else the provider verified the email and a user with that verified email exists: add the `OAuthAccount` row and sign
  in. Do not change the password, role, name, date of birth or existing sessions.
- Else the email matches a user whose email is not verified: do not link, do not create a second user, do not start a
  session, do not drop the password. The caller is told to confirm the address first.
- Else create a new user. Registration details, including the adults-only gate (ADR-0091), are still collected by
  `completeRegistration`.

**Email sign-up joins an existing account only after a link is used.** `signUp` with an email that already belongs to
a verified account with no password (a Google, GitHub or LinkedIn account) does not create a user and does not return
a session. It emails a single-use link. `verifyEmail` with that token stores the password. Until then, `signIn` with
the new password fails. The account's name, role, sessions and registration state are unchanged. A sign-up against an
account that already has a password, or whose email is not verified, is the existing conflict ("Sign in instead") and
writes nothing. A date of birth below the minimum age is refused before any of this, and does not erase the existing
account.

**No unsafe enumeration.** `signIn` stays "email or password is incorrect" either way. `signUp` does not return the
existing user id or a session when the email is taken. `emailLinkPending: true` means a link was sent and nothing
else: it is not a session, and it is false when the answer is "sign in instead".

**Google is config-driven.** `signInOptions.google` is true only when `FIREBASE_PROJECT_ID` is set and
`AppSetting` key `google_sign_in` is on. The migration inserts that row on, and a missing row is treated as on, so a
deployment that already configured Firebase keeps Google. An admin turns it off by writing the row false. Either
Firebase being unset or the switch being off makes `signInWithGoogle` answer "Google sign-in is not available here."
The admin API is `authSettings` / `setGoogleSignInEnabled` (platform admins). The environment holds the project id only.

**Account settings** read `viewer.signInMethods` (`EMAIL`, `GOOGLE`, `GITHUB`, `LINKEDIN`). The field is null on
anyone else's `User`.

## Consequences

- Web and mobile draw buttons from `signInOptions`, and after `signUp` they branch on `emailLinkPending` (show the
  "check your email" screen; `verifyEmail` then `signIn`). The verify page is the one they already have.
- Linking no longer drops an unverified password. The owner of that inbox confirms it, or uses password reset, and
  only then can Google attach.
- Contracts **0.65.0**. 0.63.0 shipped with the AI connection models (PR #17) and 0.64.0 shipped with college ID
  verification (PR #18, ADR-0099).

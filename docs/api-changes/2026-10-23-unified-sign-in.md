# One account for Google and email

- Date: 2026-10-23
- Package: `@lvn/contracts` 0.64.0 → **0.65.0**
- Spec: ADR-0100 (§7, §7.1), ADR-0007, ADR-0091
- Breaking: no, for a client that only reads fields it asks for. New fields and one new enum. `signUp` gains a success
  path that returns no session.

**Version.** 0.63.0 shipped with the AI connection models (PR #17). 0.64.0 shipped with college ID verification
(PR #18, ADR-0099). This change is **0.65.0**.

## What changes for clients

Read `signInOptions` before drawing buttons. `google` is false when `FIREBASE_PROJECT_ID` is unset or a platform admin
has turned Google off. Both cases make `signInWithGoogle` return `userErrors: [{ code: VALIDATION, message: "Google sign-in is not available here." }]`.

### `signInWithGoogle(input: { idToken })`

Send the Firebase ID token once. The API verifies it. Then:

| Situation | Result |
| --- | --- |
| New Google user | `session` for a new account. `emailVerified: true`, `registrationComplete: false`. Call `completeRegistration` (a date of birth under 18 is `AGE_RESTRICTED`, the account stays `AGE_BLOCKED`, and the session ends — see `2026-10-25-age-restricted-accounts.md`). |
| Google email matches a **verified** account | `session` for **that** account. No second user. Password, role, name and existing sessions stay. `viewer.signInMethods` includes `GOOGLE` and `EMAIL` if a password is set. |
| Google email matches an **unverified** account | No session. `userErrors: [{ code: VALIDATION }]`. Nothing is linked and no user is created. Ask them to confirm the address (or reset the password), then try Google again. |
| Token missing, forged, or `email_verified` is not true | No session. `UNAUTHENTICATED` ("could not be verified") when the token is rejected; `VALIDATION` ("no verified email") when the provider account has no verified email. |

Emails are trimmed and lowercased before they are stored or matched.

### `signUp` when the email already exists

| Situation | `session` | `emailLinkPending` | `userErrors` |
| --- | --- | --- | --- |
| New email | session, as today | `false` | `[]` |
| Verified account, **no password** (Google / GitHub / LinkedIn) | `null` | `true` | `[]` |
| Account already has a password, or its email is not verified | `null` | `false` | `[{ code: CONFLICT, field: ["input", "email"], message: "An account with this email already exists. Sign in instead." }]` |
| Date of birth under the minimum age | `null` | `false` | `[{ code: AGE_RESTRICTED, field: ["input", "dateOfBirth"], supportEmail }]`. A new address is stored as `AGE_BLOCKED`. An existing account is not modified or deleted. |

When `emailLinkPending` is true the API has emailed **Add a password to your account**. The link is
`{WEB_URL}/verify?token=…`, the same page as email verification. Call `verifyEmail(input: { token })`. That mutation
still returns `{ ok: true }` and **does not sign the person in** and does not revoke other sessions. Then `signIn`
with the email and the password from the form reaches the **same** user id as Google. Until `verifyEmail` succeeds,
`signIn` with that password fails with the usual "Email or password is incorrect."

Do not treat `emailLinkPending` as proof you can show the account. It carries no user id. `signIn` does not say
whether the email is registered.

### Account settings

`viewer { signInMethods }` is `[EMAIL, GOOGLE, GITHUB, LINKEDIN]` for the methods actually linked, `EMAIL` first.
On any other person's `User` the field is null.

### Admin

Platform admins:

```graphql
query { authSettings { googleConfigured googleEnabled } }
mutation { setGoogleSignInEnabled(input: { enabled: false }) { settings { googleConfigured googleEnabled } userErrors { code message } } }
```

`googleConfigured` is true when `FIREBASE_PROJECT_ID` is set. The id is not in the API. `googleEnabled` is the switch
(default true), stored as `AppSetting` key `google_sign_in` — the same table as college ID verification
(`student_id_verification`, ADR-0099), not a separate settings table. Google is shown only when both are true.
Anyone else gets `FORBIDDEN` (or `UNAUTHENTICATED` if signed out). The audit action is `settings.google_sign_in`.

## Config (names only)

- `FIREBASE_PROJECT_ID` — Firebase project whose ID tokens are accepted. Unset: Google is off. Not a secret.
- No new environment variable for the on/off switch.

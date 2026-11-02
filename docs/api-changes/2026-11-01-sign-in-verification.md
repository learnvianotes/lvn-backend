# Sign-in linking, verification, and review

Review and platform-admin verification in this note were superseded on 2026-11-02 by [verification review rules](2026-11-02-verification-review-rules.md) (`@lvn/contracts` 0.75.0).

- Date: 2026-11-01
- Package: `@lvn/contracts` 0.73.0 → **0.74.0**
- Spec: ADR-0100 (amended), ADR-0017, ADR-0019, ADR-0005
- Breaking: yes, for `verifyEmail`'s payload type and for `AdminSettingConstraints.min` / `max`. Approved in this note.

## Why

Mobile needs a way to resend the login-email link. Google (and the other providers) must attach to the existing user
when the provider has verified that email, including when the local login email is not confirmed yet. `verifyEmail`
must return the updated user so a client can replace the session snapshot. Platform admins and managers must be able
to review verification while their own account is not institution-verified. The 50 GiB upload cap does not fit in a
GraphQL `Int`.

## Operations

### `resendVerification: OkPayload!`

No arguments. Signed in (`SignedInGuard`). Rate limit 3 per hour per user (`RATE_LIMITED`, `retryAfter` set) only when
a mail is sent.

| Situation | Result |
| --- | --- |
| Signed out | `UNAUTHENTICATED` |
| Login email already verified | `{ ok: true, userErrors: [] }`. No mail. |
| Unverified, under the limit | `{ ok: true, userErrors: [] }` and a `verifyEmail` mail |
| Allowlist denies the address | `FORBIDDEN` in `userErrors` |

### `verifyEmail(input: VerifyEmailInput!): VerifyEmailPayload!`

`VerifyEmailInput` is unchanged: `{ token: String! }`.

```graphql
type VerifyEmailPayload {
  ok: Boolean!
  user: User
  userErrors: [UserError!]!
}
```

On success `ok` is true and `user` is the account as `viewer` would return it. `user.emailVerified` is true after a
`VERIFY_EMAIL` link. `user.verified` (institution) is unchanged by this mutation. A `LINK_EMAIL` link still attaches
the password and does not sign anyone in; `user.emailVerified` stays true. A bad link is `{ ok: false, user: null,
userErrors: [{ code: VALIDATION }] }`.

This replaces `OkPayload`. A client that only asked for `ok` and `userErrors` still compiles. A client that needs the
session snapshot to flip should read `user { id emailVerified verified }`. `viewer` and `refreshSession` already read
the database.

### `unverifiedGatedActions: [String!]!`

Public. No arguments. The action ids an institution-unverified account cannot do. Empty means none are gated. A
missing admin row is the default list:

`note.publish`, `note.share`, `contest.enter`, `payout.request`, `ai.bulk`, `resource.submit`.

Pass the result into `can()` as `actor.unverifiedGates`. Changing a note to SHARED follows `note.share`; to PUBLIC
follows `note.publish`. Back to PRIVATE stays allowed unless `note.changeVisibility` is itself in the list.
`account.reviewVerification` is not controlled by this list: an unverified teacher still cannot review.

Admins edit it with the existing `updateAdminSetting`:

```graphql
updateAdminSetting(input: { key: "unverified_gated_actions", value: "note.publish,note.share" })
```

An unknown action id is `VALIDATION`. An empty value gates nothing.

### `AdminSettingConstraints.min` and `max`

Both fields change from `Int` to `Float`. `upload_bytes_per_day` has max `53687091200` (50 GiB), which overflows a
32-bit GraphQL `Int`. Stored setting values stay strings. Clients that read `constraints.max` as a number keep working.

### `signInWithGoogle` / `oauthExchange`

Same operations. When the provider says the email is verified and a user with that email exists, the API links and
sets `emailVerifiedAt`. It does not create a second user and does not change the password, role, name, date of birth,
institution `verifiedAt`, or existing sessions. A provider email that is not verified is `VALIDATION` ("no verified
email") and stores nothing. A token the server cannot verify is still `UNAUTHENTICATED`.

## Authorization

- `resendVerification`: the signed-in user only.
- Review: `PLATFORM_ADMIN` and `MANAGER` may review without `institutionVerified`. A teacher still needs it. Nobody
  reviews their own request (`FORBIDDEN`, "You cannot review your own request."). `documentsFor` then returns `[]`.
- `setGlobalRole` to `PLATFORM_ADMIN` or `MANAGER` sets `verifiedAt` when it was null. `TEACHER` does not. Demotion
  does not clear `verifiedAt`.

## Migration

Web and mobile: call `resendVerification` from the signed-in unverified state. After `verifyEmail`, replace the
session user with `VerifyEmailPayload.user`. Read `unverifiedGatedActions` once per session and pass it into `can()`.
Read `AdminSettingConstraints.min` and `max` as floats.

# Recoverable age-blocked accounts

> Sign-up and `completeRegistration` now take `age` (whole years); `dateOfBirth` is deprecated, and admins get `age`.
> See `2026-11-04-age-instead-of-date-of-birth.md`.

- Date: 2026-10-25
- Package: `@lvn/contracts`
- Spec: ADR-0091, amended (accounts are kept)
- Breaking: the live refusal code is `AGE_RESTRICTED`. `UNDER_MINIMUM_AGE` stays in `ErrorCode` for older clients and is no longer returned.

## What changes for clients

- Minimum age is still `account_minimum_age` / `ACCOUNT_MINIMUM_AGE` (default **18**, not 13). `0` turns the gate off.
- `signUp` and `completeRegistration` below that age return `userErrors` with `code: AGE_RESTRICTED`, `field: ["input", "dateOfBirth"]`, and `supportEmail`. That field stays a single `String`: the earliest non-deleted `PLATFORM_ADMIN` by `createdAt`. `SUPPORT_EMAIL` (default `support@learnvianotes.in`) is used only when no such account exists. Show "contact admin at \<email\>". The message also names that address.
- The account is created or kept with `accountStatus: AGE_BLOCKED`. No session. Nothing public. A later sign-in of that account returns `AGE_RESTRICTED` again. An address that already has an account is not changed by someone else's date of birth.
- `BLOCKED` and `SUSPENDED` sign-in returns `VALIDATION` ("This account is blocked…") with `supportEmail`. Refresh of a non-active account is `UNAUTHENTICATED`.

## Admin (PLATFORM_ADMIN)

```
query adminUsers(status: AdminUserStatusFilter!, search: String, first: Int): AdminUserList!
mutation adminUpdateUser(input: AdminUpdateUserInput!): AdminUserPayload!
mutation adminSetAccountStanding(input: AdminSetAccountStandingInput!): AdminUserPayload!
mutation adminDeleteUser(input: AdminDeleteUserInput!): OkPayload!
```

```
enum AccountStatus { ACTIVE AGE_BLOCKED BLOCKED SUSPENDED }
enum AdminUserStatusFilter { AGE_BLOCKED BLOCKED_OR_SUSPENDED ACTIVE }
type AdminManagedUser { id: UUID! email: String! displayName: String! handle: String! dateOfBirth: String accountStatus: AccountStatus! statusReason: String globalRole: GlobalRole! createdAt: DateTime! }
type AdminUserList { users: [AdminManagedUser!]! total: Int! }
type AdminUserPayload { user: AdminManagedUser userErrors: [UserError!]! }
input AdminUpdateUserInput { userId: UUID! displayName: String email: String dateOfBirth: String reason: String! }
input AdminSetAccountStandingInput { userId: UUID! status: AccountStatus! reason: String! until: DateTime }
input AdminDeleteUserInput { userId: UUID! reason: String! confirm: String! }
```

- `dateOfBirth` is `YYYY-MM-DD`. `adminUpdateUser` re-runs the gate. A passing date clears `AGE_BLOCKED`. A failing date sets `AGE_BLOCKED`. `reason` is required, including when the new date lets the account pass. `adminSetAccountStanding` with `ACTIVE` is refused while the account is still under age or `AGE_BLOCKED`. `AGE_BLOCKED` cannot be set by hand.
- `SUSPENDED` requires a future `until`. `BLOCKED` is indefinite. Both revoke sessions.
- `adminDeleteUser` requires `confirm: "DELETE"`. PII is anonymised, sessions and files go, and a tombstone keeps a SHA-256 of the email, the admin, the reason, and the time.

`UserError.supportEmail: String` stays a single nullable `String` (`@shareable` on every subgraph). It is not a list. The value is the earliest non-deleted `PLATFORM_ADMIN` by `createdAt`, cached for about a minute in each API process. `SUPPORT_EMAIL` is the fallback when none exists. The study publisher is never the contact.

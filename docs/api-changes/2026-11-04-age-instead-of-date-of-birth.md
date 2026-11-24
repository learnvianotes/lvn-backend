# Age in whole years instead of a date of birth

- Date: 2026-11-04
- Package: `@lvn/contracts` 0.77.0 → **0.78.0**
- Spec: ADR-0104 (amends ADR-0017 and ADR-0091), §15.2, §7; follows
  [recoverable age-blocked accounts](2026-10-25-age-restricted-accounts.md)
- Breaking: no. New optional fields. `dateOfBirth` on the two registration inputs becomes nullable and deprecated, and
  is still accepted. Clients built before this change keep working unchanged.

## Why

The owner asked for the date-of-birth input on sign-up and complete-registration to be replaced by an age, typed as
a number. The minimum age for an account, the restricted-minor rules and the consent records stay. They now read
that age.

## What changes for clients

### `signUp(input: SignUpInput!)` and `completeRegistration(input: CompleteRegistrationInput!)`

```graphql
input SignUpInput {
  email: String!
  password: String!
  displayName: String!
  age: Int                                   # new: whole years, 1 to 120
  dateOfBirth: String @deprecated(reason: "Send age, in whole years. Ignored when age is sent.")   # was String!
  institutionalEmail: String
  acceptedTermsVersion: String!
}

input CompleteRegistrationInput {
  displayName: String!
  age: Int                                   # new
  dateOfBirth: String @deprecated(reason: "Send age, in whole years. Ignored when age is sent.")   # was String!
  institutionalEmail: String
  acceptedTermsVersion: String!
}
```

Send `age`, a whole number of years. Drop the date picker and send no `dateOfBirth`. Server checks, in this order:

| Input | Result |
| --- | --- |
| `age` 1–120 | Accepted. `ageDeclaredAt` is set to now. |
| `age` < 1 or > 120 | `userErrors: [{ code: VALIDATION, field: ["input", "age"], message: "Enter an age from 1 to 120." }]` |
| `age` not a whole number (`17.5`, `"18"`) | GraphQL refuses the variable: top-level `errors[0].extensions.code: VALIDATION` and no `data`. Validate on the client so this is not reached. |
| neither `age` nor `dateOfBirth` (or both null) | `userErrors: [{ code: VALIDATION, field: ["input", "age"], message: "Enter your age." }]` |
| only `dateOfBirth` (apps from before this change) | Checked as before (`YYYY-MM-DD`, a real date, not in the future, from 1900). Errors stay on `["input", "dateOfBirth"]`. It is turned into whole years today and must give 1–120 (otherwise `VALIDATION`, "Enter a real date of birth."). Only that age is stored. |
| both `age` and `dateOfBirth` | **`age` is used.** `dateOfBirth` is ignored: not checked, not stored. |
| age below `account_minimum_age` (18 by default) | As before, `AGE_RESTRICTED` with `supportEmail`, and the account is kept as `AGE_BLOCKED` with no session. `field` is `["input", "age"]`, or `["input", "dateOfBirth"]` when the client sent only a date of birth. |

The messages never name the minimum age (ADR-0091). Keep the confirmation step: show the number back ("You are 17.
Is this right?") before sending any answer, adult or not. Keep the one-day refusal memory on the device, and don't
show the cut-off before the answer.

### Admin (PLATFORM_ADMIN)

```graphql
type AdminManagedUser {
  # …
  dateOfBirth: String   # YYYY-MM-DD, only for accounts that have one (registered before this change, or set by an admin)
  age: Int              # new: whole years now; null before registration is finished
}

input AdminUpdateUserInput {
  # …
  age: Int              # new: whole years, 1 to 120, as of now
  dateOfBirth: String   # unchanged
  reason: String!
}
```

- `age` on `AdminManagedUser` is the account's age now. It comes from `dateOfBirth` when the account has one,
  otherwise from the declared age plus the whole years since it was given. Show `age`. Show `dateOfBirth` only when
  it is not null. Admins see no more than before: the date of birth only where it was already stored, and the
  declared value and its time are not exposed separately.
- `adminUpdateUser(input: { age })` re-runs the age gate the way `dateOfBirth` did. Below the minimum it sets
  `AGE_BLOCKED` and ends sessions. A passing age clears `AGE_BLOCKED`. `reason` is still required.
- `age` is refused (`VALIDATION`, `["input", "age"]`) on an account that has a `dateOfBirth`, because the date decides
  its age. Correct `dateOfBirth` there. `age` and `dateOfBirth` together are refused the same way.
- `adminSetAccountStanding(status: ACTIVE)` on an account still under age points at the field to correct:
  `["input", "age"]`, or `["input", "dateOfBirth"]` for an account that has one. The message for `AGE_BLOCKED` by hand
  now reads "Correct the age, with a reason."
- Audit rows list `"age"` among `fields`. The value is not recorded.

### Unchanged

`User.restrictedMinor`, `ErrorCode` (`AGE_RESTRICTED`, `UNDER_MINIMUM_AGE` kept for older clients),
`UserError.supportEmail`, `account_minimum_age` / `digital_consent_age` and the terms version (`2026-11-03`; see
below).

## Date of birth handling

- **Existing accounts keep their date of birth.** The migration adds two nullable columns and changes no data:
  `users."User"."declaredAge" INTEGER` and `"ageDeclaredAt" TIMESTAMPTZ(3)`
  (`prisma/migrations/20261113090000_declared_age`). Nothing is converted or deleted.
- **New registrations store no date of birth.** They store the age typed and when it was given. A deprecated
  `dateOfBirth` from an older app is used only to work out that age.
- **Age now** = the date of birth when the account has one (exact, as before), otherwise the declared age plus the
  whole years since it was given. That never says someone is older than they are, so a minor's restriction is never
  lifted early. It can lift up to a year after the real birthday. People search (`adultFrom`), the followers who may
  be named, profile visibility, `restrictedMinor`, contest bands and achievements all use this rule.
- **Erasure and export.** Account deletion clears `declaredAge` and `ageDeclaredAt` with `dateOfBirth`. The data
  export's `data/users/account.json` includes them, and its README says "the age you gave (or your date of birth, if
  you gave one)". Logs redact `age` and `declaredAge` as well as `dateOfBirth`.

## Terms version

Not changed. The legal and privacy text needs only a factual word change ("date of birth" → "age"). A new terms
version makes every signed-in person accept again (ADR-0103). That is the owner's call, not part of this change.

## Migration for clients

1. Web and mobile: replace the date picker with a number field (whole years). Send `age`, not `dateOfBirth`.
   Regenerate types from `contracts/graphql/schema.graphql` (`dateOfBirth` is now optional and deprecated).
2. Admin page: show `age`, show `dateOfBirth` only when present, and edit with `age` (or `dateOfBirth` for an
   account that has one).
3. Phones that already have an older build installed need no update: their `dateOfBirth` is still accepted.

# Accounts from age 8

- Date: 2026-11-06
- Package: `@lvn/contracts` (config default only; the GraphQL schema is unchanged)
- Spec: ADR-0108 (amends ADR-0091, ADR-0101, ADR-0104), §15.2, §7
- Breaking: no schema change. Behaviour changes: ages 8 to 17 can register. An admin can set `account_minimum_age` from 8, not only from 18.

## Why

The owner set the youngest account age to 8. `DIGITAL_CONSENT_AGE` stays 18. Ages 8 to 17 sign up and sign in with no guardian step, as restricted minors.

## What changes for clients

- `ACCOUNT_MINIMUM_AGE` defaults to **8** (still 0–21 in the environment; `0` turns the floor off).
- Admin setting `account_minimum_age`: **from 8 to 21**, default 8. `7` is `VALIDATION`. The description says "From 8 to 21" and "An admin cannot set this below 8".
- `digital_consent_age` is unchanged (default 18, range 13–21).
- `signUp` / `completeRegistration` with an age **below 8** (or a date of birth that is under 8 today): `AGE_RESTRICTED`, account kept as `AGE_BLOCKED`, no session. The message no longer says accounts are only for adults, and it still does not name the cut-off.
- An age **from 8 to 17**: a session, `accountStatus: ACTIVE`, `viewer.restrictedMinor: true`, no `GUARDIAN` consent row, `analyticsOptOut: true`. Sign-in works. `userByHandle` is null for anyone else. `setAnalyticsOptOut(false)` does not turn usage analytics back on while they are a restricted minor.
- An age **18 or older**: unchanged. Not a restricted minor. Analytics follow the viewer's own choice.

Contest bands and public achievements stay off under the digital-consent age. Their errors still say "until you are 18".

## Migration

None. `account_minimum_age` is not seeded. A missing row uses this default.

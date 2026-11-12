# Minimum sign-up age and guardian consent

- Date: 2026-11-11
- Package: `@lvn/contracts` **0.81.0 → 0.82.0**
- Spec: ADR-0109 (amends ADR-0091, ADR-0101, ADR-0104, ADR-0108), §15.2, §7
- Breaking: additive GraphQL field. Behaviour changes: the default floor is 13, not 8. An admitted sign-up under 18 stores `auto_unverified` guardian consent, which does not lift restricted-minor limits.

## Why

The youngest age that may sign up is an admin setting, so it can change without a deploy. The default is 13. Ages 5–12 stay supported and stay off until an admin sets `account_minimum_age` to 5. Every admitted account under 18 records guardian consent. That record is `auto_unverified` and must not lift public publishing, direct messages, behavioural recommendations or usage analytics.

## What changes for clients

- **`Query.accountMinimumAge: Int!`** (public, no sign-in). The live admin setting. Default **13**. Read this on the sign-up screen instead of hard-coding a minimum.
- `ACCOUNT_MINIMUM_AGE` is no longer an environment variable. The floor is admin setting `account_minimum_age`: **from 5 to 21**, default 13. `4` is `VALIDATION`. The description says "From 5 to 21" and "An admin cannot set this below 5".
- New admin setting `guardian_notice_version` (YYYY-MM-DD, default `2026-11-11`). Stored on new under-18 rows. Changing it does not ask existing accounts again.
- `signUp` and `completeRegistration` (Google, GitHub, LinkedIn) below the floor: `AGE_RESTRICTED`, account kept as `AGE_BLOCKED`, no session. The message does not name the cut-off.
- An age from the floor up to 17: a session, `accountStatus: ACTIVE`, `viewer.restrictedMinor: true`, `analyticsOptOut: true`, and one `GuardianConsent` row (`method: auto_unverified`). No `ConsentRecord` of kind `GUARDIAN`.
- Age bands on that row: `under_13` (below 13), `13_15`, `16_17`.
- An age of 18 or older: no guardian row. Not a restricted minor.
- Only consent method `verified`, or a legacy `ConsentRecord` of kind `GUARDIAN`, lifts restricted-minor limits. `auto_unverified` does not.
- Contest bands and public achievements stay off under the digital-consent age. Their errors still say "until you are 18".

## Migration

`20261115090000_guardian_consent` creates `users.GuardianConsent` (`ON DELETE RESTRICT`) and `users.GuardianConsentMethod`. No `AppSetting` row is seeded. A missing `account_minimum_age` row is 13.

# Accounts from age 13

- Date: 2026-11-12
- Package: `@lvn/contracts` **0.85.0 → 0.86.0**
- Spec: ADR-0113 (amends ADR-0108, ADR-0109), §15.2, §7
- Breaking: no schema shape change. The `accountMinimumAge` description changes. Behaviour changes: the floor cannot go below 13. The built-in terms version is `2026-11-12`.

## Why

LVN is 13+ only. The Play target groups are 13–15, 16–17 and 18+. The app stays out of the Families policy. Ages 5–12 are no longer a sign-up path, including when an admin had set `account_minimum_age` to 5 or 8.

## What changes for clients

- `Query.accountMinimumAge` is still the live floor. It is **at least 13**. A saved setting below 13 is returned as 13. Read this on the sign-up screen instead of hard-coding a minimum.
- Admin setting `account_minimum_age`: **from 13 to 21**, default 13. `12` is `VALIDATION`. The description says "From 13 to 21" and "An admin cannot set this below 13".
- `signUp` and `completeRegistration` (Google, GitHub, LinkedIn) with an age **under 13**: `AGE_RESTRICTED`, account kept as `AGE_BLOCKED`, no session, no guardian row. The message does not name the cut-off. `supportEmail` is unchanged.
- An age from 13 to 17: unchanged. A session, `accountStatus: ACTIVE`, one `GuardianConsent` row (`method: auto_unverified`, parent email, notice version). Bands stay `13_15` and `16_17`.
- An age of 18 or older: unchanged. No guardian row.
- `digital_consent_age` is unchanged (default 18 in code, range 13–21). An admin-saved value of 13 stays 13. It still decides restricted-minor handling. It does not let anyone under 13 register.
- Built-in `termsVersion` is **`2026-11-12`** when no admin has saved `terms_version` and `TERMS_VERSION` is unset. The built-in published list is `2026-10-08`, `2026-11-03`, `2026-11-12`. A saved terms row still wins. `guardian_notice_version` defaults to `2026-11-12` when no row is saved; a saved row still wins, and existing consent rows are not asked again.

## Existing accounts under 13

No migration. This change does not delete, block, or rewrite them. An `ACTIVE` account that is already under 13 still signs in. How to find them, without running this against production from the change itself, is in the pull request.

## Migration

None. No `AppSetting` row is written or updated. A missing `account_minimum_age` row is 13. A row below 13 is left stored and enforced as 13.

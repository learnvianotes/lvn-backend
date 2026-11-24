# ADR-0108: Accounts from age 8, restricted until the digital-consent age

- Status: Accepted (owner decision, 2026-11-06: K Manideep — LVN accounts must be allowed from age 8 instead of 18)
- Date: 2026-11-06
- Deciders: Backend; owner
- Spec sections: §15.2 (Age), §7 (registration)
- Amends: ADR-0091 (the minimum is 8, not 18); ADR-0101 (`account_minimum_age` may be set from 8); ADR-0104 (the same floor, read from the declared age)

## Context

ADR-0091 kept accounts for adults while the College/Interview track launched: `ACCOUNT_MINIMUM_AGE` defaulted to 18, and an admin could not set `account_minimum_age` below 18. Anyone younger was stored as `AGE_BLOCKED` with no session.

The restricted-minor rule of §15.2 was already in the code. Under `DIGITAL_CONSENT_AGE` (default 18) and without a guardian consent record, an account has no public profile, is left out of people search, and cannot publish in public. That rule never ran for a new sign-up, because the floor and the consent age were the same number.

The owner now wants accounts from age 8. Ages 8 to 17 join at once. There is no parent or guardian step. A missing guardian consent must not block sign-up or sign-in. They are restricted minors until they reach the digital-consent age.

## Decision

**`ACCOUNT_MINIMUM_AGE` defaults to 8.** Below it, sign-up and `completeRegistration` still keep the account as `AGE_BLOCKED` and return `AGE_RESTRICTED`, with no session. `0` still turns the floor off.

**`account_minimum_age` is from 8 to 21**, default 8. An admin cannot set it below 8. The description says so. `digital_consent_age` stays 13–21, default 18.

**Ages from the floor up to the consent age sign in.** No guardian-consent flow is added. `isRestrictedMinor` is unchanged: under the consent age, and with no `GUARDIAN` consent row, the account is a restricted minor. A consent row that already exists still lifts that. Nothing in sign-up or sign-in reads that row as a requirement.

**No usage analytics for a restricted minor.** Sign-up and `completeRegistration` set `analyticsOptOut` when the declared age is under the consent age. While `isRestrictedMinor` is true, ingest drops usage events and `setAnalyticsOptOut(false)` does not clear the flag.

The refusal copy no longer says accounts are only for adults. It still does not name the cut-off.

## Consequences

- An 8-year-old can register and sign in. A 7-year-old cannot. A 17-year-old is a restricted minor and needs no consent record.
- Contest bands and public achievements stay adult-only. They follow `adultFrom`, which is the digital-consent age, and their copy still says 18.
- There is no direct-message product in this repository. The restricted-minor gates that do exist (public profile, discoverability, public notes and quizzes, follows) apply as soon as the account exists.
- Web and mobile copies that still refuse under 18, including lvn-web `ACCOUNTS_FROM_AGE`, are outside this repository and must be updated separately.
- No `AppSetting` row is seeded for `account_minimum_age`. Production has not saved one, so the new default applies without a migration.

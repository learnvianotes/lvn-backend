# ADR-0109: Minimum sign-up age is an admin setting, and auto_unverified consent does not lift limits

- Status: Accepted (owner decision, 2026-11-11: K Manideep — LVN is no longer adults-only; under-13 sign-up stays off until an admin sets the floor to 5)
- Date: 2026-11-11
- Deciders: Backend; owner
- Spec sections: §15.2 (Age), §7 (registration)
- Amends: ADR-0091, ADR-0101, ADR-0104, ADR-0108

## Context

ADR-0108 set the youngest account age to 8, through `ACCOUNT_MINIMUM_AGE` and an admin floor of 8–21. Ages 8–17 signed in as restricted minors and no guardian row was written.

The owner now wants the floor to be the admin setting `account_minimum_age`, changeable without a deploy. The default is 13, so a 12-year-old is blocked. Ages 5–12 (Google Play Families) stay supported and stay off until an admin sets the floor to 5. A 4-year-old stays blocked at that floor. The setting cannot go below 5 or above 21. The environment does not set it.

Every admitted sign-up under 18 records guardian consent in the same transaction. The method is `auto_unverified`: no parent has been checked. A security review found that `isRestrictedMinor` treated any GUARDIAN consent as enough to lift public publishing, direct messages, behavioural recommendations and usage analytics. An `auto_unverified` row must not do that.

## Decision

**The floor is `account_minimum_age`.** Default 13, range 5–21, `environmentFallback: false`. A missing row is 13. `ACCOUNT_MINIMUM_AGE` is no longer a configuration key. `Query.accountMinimumAge` returns the live value for sign-up screens.

**Every account-creation path enforces it on the server.** Email `signUp`, and Google, GitHub and LinkedIn through `completeRegistration`. Below the floor the account is kept as `AGE_BLOCKED`, no session is issued, and the answer is `AGE_RESTRICTED`. The message does not name the cut-off. A blocked sign-up does not get a guardian row.

**An admitted sign-up under 18 writes one `GuardianConsent` row in the same transaction.** Kind `GUARDIAN`, method `auto_unverified`, `noticeVersion` from admin setting `guardian_notice_version` (default `2026-11-11`), `recordedAt`, and `ageBand`: `under_13` (below 13), `13_15`, or `16_17`. 18 or older gets no row. The table is indexed by `(method, noticeVersion)`, `ageBand` and `userId`.

**The row survives purge.** It has no cascade delete. Account erasure anonymises the user and deletes `ConsentRecord`. It does not delete `GuardianConsent`. The row holds no name, email or date of birth.

**Only a verified method lifts restricted-minor limits.** `isRestrictedMinor` takes consent methods and returns not-restricted only when one of them is `verified`. `auto_unverified` and any unknown method leave the minor restricted. A legacy `ConsentRecord` of kind `GUARDIAN` counts as `verified`. People-list filters match that legacy row or `GuardianConsent.method = verified`. They do not match `auto_unverified`.

Sign-up does not write a `ConsentRecord` of kind `GUARDIAN`.

## Consequences

- At the default, a 12-year-old cannot sign up and a 13-year-old can, as a restricted minor with an `auto_unverified` row in band `13_15`.
- When an admin sets the floor to 5, a 5-year-old can sign up (band `under_13`) and a 4-year-old cannot.
- Public publishing, direct messages, behavioural recommendations and usage analytics stay off for a minor whose only consent is `auto_unverified`.
- Contest bands and public achievements stay adult-only. Their copy still says 18.
- Web and mobile must read `accountMinimumAge` and update sign-up copy. That work is outside this repository.
- Turning off AI features or Sentry for under-13s, social-feature limits beyond the existing restricted-minor gates, a parent email, and a change to purge timing are not part of this decision.

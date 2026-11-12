# ADR-0113: Accounts from age 13, outside the Families policy

- Status: Accepted (owner decision, 2026-11-12: K Manideep — LVN is 13+ only, targeting Play age groups 13–15, 16–17 and 18+, and staying out of the Families policy)
- Date: 2026-11-12
- Deciders: Backend; owner
- Spec sections: §15.2 (Age), §7 (registration)
- Amends: ADR-0108, ADR-0109

## Context

ADR-0108 admitted accounts from age 8. ADR-0109 raised the default of `account_minimum_age` to 13 and left the admin range at 5–21, so ages 5–12 (Google Play Families) stayed available if an admin set the floor to 5.

The owner now wants LVN to be 13+ only. The Play target groups are 13–15, 16–17 and 18+. The app stays out of the Families policy. People who already have an account under 13 keep it. The admin-saved `digital_consent_age` is 13 and stays 13.

## Decision

**The sign-up floor is at least 13.** `account_minimum_age` is from 13 to 21, default 13. An admin cannot save 12 or below. `signUp` and `completeRegistration` refuse an age under 13 with `AGE_RESTRICTED`. The message still does not name the cut-off. The account is kept as `AGE_BLOCKED`, with no session and no guardian row.

**A stored value below 13 is not rewritten.** `minimumAge()` and the same check on sign-up, registration and admin unblocking read it as 13. `Query.accountMinimumAge` returns that enforced value. Resetting the setting returns to 13. The environment does not set it.

**Existing accounts under 13 are not deleted or modified.** Sign-in does not re-apply the new floor to an account that is already `ACTIVE`. No migration and no job walks those rows.

**Parental consent for an admitted sign-up under 18 is unchanged.** Ages 13–17 still record `auto_unverified` guardian consent, a parent email and the notice. `email_plus` still lifts limits only after the parent clicks. The `under_13` band stays on rows that already have it, including the parent social toggle for those accounts.

**`digital_consent_age` is unchanged.** Its code default stays 18, its range stays 13–21, and an admin-saved value of 13 is left in the database. It still decides who is a restricted minor. It does not admit anyone under the sign-up floor.

**The built-in terms version is `2026-11-12`.** It is added to the built-in published list. The guardian notice default is the same date. A saved `terms_version` or `guardian_notice_version` row still wins; this decision does not update those rows.

## Consequences

- A 12-year-old cannot sign up, including when a previously saved floor is 5 or 8. A 13-year-old can, as a restricted minor when `digital_consent_age` is above 13, with an `auto_unverified` row in band `13_15`.
- An admin may still raise the floor, up to 21. They cannot open sign-up to ages 5–12.
- Web and mobile must read `accountMinimumAge` and stop offering a Families or under-13 sign-up. That work is outside this repository. They must also publish terms text for `2026-11-12` before an operator switches a saved `terms_version` to it.
- Contest bands and public achievements stay adult-only. Their copy still says 18.

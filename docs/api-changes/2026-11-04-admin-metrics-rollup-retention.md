# Admin metrics rollup and retention cohorts

- Date: 2026-11-04
- Package: `@lvn/contracts` 0.79.0 → **0.80.0**
- Spec: ADR-0106 (amends ADR-0105); admin plan step 5
- Breaking: no. One new admin query and one new enum. The ADR-0105 queries keep their arguments, shape and
  definitions; past days are now read from a nightly rollup.

## Why

The admin queries scanned raw rows for every day of the window on every call. A nightly job now stores each past
IST day's counts in `users.daily_metrics`, and the queries read them, counting only today (and any day the job has
not written) from the tables. Retention cohorts by sign-up week are added on the same rollup. No new tracking, no
third-party service; Google Analytics (ADR-0092) is unchanged.

## Changed (behaviour only): `adminGrowth`, `adminEngagement`, `adminContentStats`, `adminVerificationStats`

Same arguments, fields and numbers. A past day's figures are as of the last rollup (02:00 IST nightly, recomputing
the last 3 days), so an account deleted, or an event delivered, more than 3 days after a day does not change that
day. Until a day is rolled up it is counted live, as before. Top subjects, uploads, per-group breakdowns and the
verification queue stay live. `adminTopSubjects` and `adminFunnel` are unchanged.

## New query: `adminRetention(cohortInterval: CohortInterval = WEEK, weeks: Int): AdminRetention!`

```graphql
enum CohortInterval { WEEK }

type AdminRetentionCohort {
  start: String!        # the sign-up week's Monday, YYYY-MM-DD (IST)
  size: Int!            # people in the cohort, as last counted; always >= 5
  returned: [Float!]!   # returned[n]: share (0-1, 3 decimals) active in week n after sign-up; [0] = sign-up week,
                        # the last value = this week, still in progress
}

type AdminRetention {
  cohortInterval: CohortInterval!
  timeZone: String!     # Asia/Kolkata
  firstWeek: String!    # the first and the last (this) sign-up week asked for, Mondays
  lastWeek: String!
  generatedAt: DateTime!
  cohorts: [AdminRetentionCohort!]!   # oldest first
  hiddenSmallGroups: Int!
}
```

- **Authorization:** platform admins only (`FORBIDDEN` otherwise, `UNAUTHENTICATED` signed out).
- **weeks:** 1 to 52, 12 when omitted, this week included; outside that → `VALIDATION` on `weeks`.
- **Cohort:** people who signed up in that IST week (Monday to Sunday). Deleted accounts, accounts that opted out of
  analytics and the study publisher are in no cohort.
- **Active:** as in `adminEngagement`: a session started or refreshed, a usage event, or learning that week.
- **Small groups:** a cohort with fewer than 5 people (in any week counted) is left out and counted in
  `hiddenSmallGroups`. A week nobody signed up in is left out and not counted. Render missing weeks as empty rows.
- **Shares:** each share is over the cohort as it was when that week was counted, so it never exceeds 1.
- **Caching:** about 5 minutes per API process.

```graphql
query { adminRetention(weeks: 8) { firstWeek lastWeek cohorts { start size returned } hiddenSmallGroups } }
```

## Migration

- Database: `20261113090000_daily_metrics` creates `users.daily_metrics` (additive; nothing else changes).
- Worker: new scheduled job `users.maintenance` / `rollup-metrics`; new optional variables `METRICS_ROLLUP_CRON`
  (default `30 20 * * *` UTC = 02:00 IST) and `METRICS_ROLLUP_DAYS` (default 3). After deploying, backfill history
  once: `node apps/worker/dist/cli.js metrics:backfill <from> <yesterday>`. Without it, nothing is wrong; older days
  are counted live until then.
- Clients: run `contracts:sync` and codegen to get `adminRetention`. No change is needed for the existing queries.

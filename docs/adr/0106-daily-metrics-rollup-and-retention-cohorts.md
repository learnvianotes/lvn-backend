# ADR-0106: Daily metrics rollup and retention cohorts

- Status: Proposed
- Date: 2026-11-04
- Deciders: Backend; owner
- Spec sections: §6.1 and §6.5 (contexts talk through facades), §6.3 (indexes and cheap reads), §9.1 (scheduled jobs),
  §14 (first-party analytics, DPDP)
- Amends: ADR-0105 (past days are read from a rollup; `adminRetention` is added)

## Context

ADR-0105's admin queries scan raw rows for every day of the window on every call, up to 366 days, and move account
ids between contexts in memory to count active people. On the 2 GB production box that cost grows with the data.
Step 5 of the admin plan (`ADMIN-FEATURES-PLAN.md` §2) adds a nightly rollup the dashboard reads for past days, and
retention cohorts by sign-up week. Usage events are deleted after 180 days, so cohort curves computed only from raw
rows would also lose part of their history.

Owner defaults this work follows (each may be vetoed): (a) the terms version is chosen only from versions the web has
published (ADR-0103, unchanged here); (b) new first-party events (feature use, zero-result searches, quiz starts, app
and version adoption) come later with the same opt-out and 180-day retention, no IP addresses, no free text, no
third-party SDKs, and groups under 5 people hidden; (c) Google Analytics (ADR-0092) stays as it is. This ADR adds no
events, no SDK and nothing on the web; ADR-0092 is untouched.

## Decision

**Table.** `users.daily_metrics(day date, metric text, dimension text default '', value bigint, computedAt
timestamptz)`, primary key `(day, metric, dimension)`. `day` is an IST day (ADR-0105's `ADMIN_METRICS_TIME_ZONE`);
learning is stored on the learner's own day, as ADR-0105 counts it. `dimension` is a breakdown key: a sign-up method,
a visibility, a scan result, a cohort's Monday, or a duration in milliseconds. One additive migration
(`20261113090000_daily_metrics`): a new table, no change to an existing one, so it is safe on the live database.

**Rows.** Counts only, zeros left out, never an account id or free text. The users context owns the table and
assembles it; `notes` and `core` return their own per-day counts through `NOTES_ADMIN_STATS.dailyCounts` and
`CORE_ADMIN_STATS.dailyCounts` (names in `NOTES_DAILY_METRICS` / `CORE_DAILY_METRICS`), so no context reads another's
tables. Per day:
- users: `sign_ups`, `sign_up_method` (by method), `emails_verified`, `registrations_completed`, `verifications`,
  `verification_requests`, `verification_approved`, `verification_rejected`, `verification_decision_ms` (by duration),
  `active_users`, `active_users_7d`, `active_users_30d` (distinct people that day and over the 7 and 30 days ending it).
- notes: `notes_created` (by visibility), `upload_scans` (by result), `note_shares`, `place_shares`, `saves`.
- core: `learning_seconds`, `doubts_asked`, `doubts_answered`, `doubt_first_answer_ms` (by duration),
  `doubts_resolved`, `doubt_answers`, `quiz_attempts`, `groups_created`, `classrooms_created`, `group_posts`,
  `classroom_posts`.
- A marker `_rollup` / `day` says the day is complete. Medians are kept as distributions (how many requests or doubts
  took each millisecond count), so a median over any set of days is the exact median of the rows.

Per complete week (Monday to Sunday, `day` = its Monday): `cohort_active` and `cohort_size` by sign-up week (the 52
sign-up weeks up to it) and a marker `_rollup` / `week`. `cohort_size` is the cohort's size when that week was counted,
so each share is over the people it was counted among.

**Job.** BullMQ repeatable `users.maintenance` / `rollup-metrics`, at `METRICS_ROLLUP_CRON` (UTC like every
schedule; default `30 20 * * *`, 02:00 IST). Each run recomputes the `METRICS_ROLLUP_DAYS` days before today (default
3, 1 to 31) and the cohorts of every complete week whose Sunday is among them. Today is never rolled up. A run upserts
the rows of those days and weeks and deletes the ones the computation no longer has (a deleted doubt's duration, a
count gone to zero), in one transaction under an advisory lock, so two workers, a retry, or a backfill running at the
same time cannot interleave. Re-running writes the same rows. `queue:run users.maintenance rollup-metrics` runs it now
(job data `{ "days": n }` overrides the window once).

**Backfill.** `node apps/worker/dist/cli.js metrics:backfill <from> <to>` (or `pnpm --filter @lvn-backend/worker
metrics:backfill …`) rolls up past IST days in its own process, 31 days at a time, oldest first. It refuses today and
later, a start after the end, and a start more than 730 days back. Days whose raw rows are already purged (usage
events after 180 days) are rolled up from what is left.

**Reading.** `adminGrowth`, `adminEngagement`, `adminContentStats` and `adminVerificationStats` read a past day from
the rollup when its marker exists and compute every other day (today always, and any day the job has not written)
from the tables with the same code the job uses, so a stored day and a live one give the same numbers on the same
data; an e2e test compares the two on seeded data. Distinct people over several days come from the rollup only for a
span of 1, 7 or 30 days ending on a stored day (a whole past week is 7 days ending on its Sunday); any other span, and
any span reaching today, is counted live from activity. Unchanged and live, because a day cannot hold them: distinct
people per breakdown group over the window (upload purposes, verification methods, subjects; the small-group rule
needs the exact number), the verification queue now, uploads, `adminTopSubjects` and `adminFunnel`. The ~5-minute
per-process cache stays.

**Retention.** `adminRetention(cohortInterval: CohortInterval = WEEK, weeks: Int)`, platform admins only. `weeks`
is 1 to 52 (12 when omitted) sign-up weeks, oldest first, the last one this week. A cohort is the people who signed up
in an IST week and can be counted (not deleted, not opted out of analytics, not the study publisher);
`returned[n]` is the share of them active (ADR-0105's definition) in the n-th week after it, `returned[0]` the sign-up
week and the last value this week, still in progress. Complete weeks come from the rollup; this week, and a week the
job has not written, are counted live. `size` is the latest count. A cohort below 5 people, in any week counted, is
left out and counted in `hiddenSmallGroups`; a week nobody signed up in is not a group and is left out uncounted.

**Retention of the rollup: 730 days**, purged by the existing `purge-analytics` job. Owner default, may be vetoed:
the rows are counts with no personal data (no account id, no free text, nothing that singles a person out; a
duration is a count of requests or doubts that took that long), so they need not follow `usage_events`' 180 days.
Two years covers any window the queries accept (366 days) and a year of cohorts with room for year-on-year
comparison. The table is never exposed raw: only through the admin queries, which apply the k-anonymity threshold.
Opting out or deleting an account removes the person from raw data and from every later computation; counts already
rolled up are not recounted.

## Consequences

The dashboard's cost no longer grows with the window: a 366-day `adminGrowth` reads ~366 small rows and counts only
today live. `adminEngagement` still reads up to 30 days of activity live when the window ends today (MAU and
stickiness need who was active, which is never stored), and a partial first or last week of a WEEK series.

A past day is frozen at its last rollup. Learning days close at 04:00 in each learner's zone and usage events may
arrive up to 7 days late (the ingest clamp), so the default 3 days recompute misses only an event delivered 4 to 7
days late from someone with no other activity that day; set `METRICS_ROLLUP_DAYS=7` to catch those too. Accounts
deleted or opted out after a day was rolled up stay in its counts (as counts), so a past day can differ from a live
recount. Until the job has run (or a backfill), every day is counted live, as before: results stay right, only
slower.

The CLI backfill runs in one process with the same lock as the job, so it can run while the worker runs. Revisit the
730 days if the owner wants rollups to follow the 180 days of usage events, and the per-group live counts if top
subjects or upload breakdowns become slow (a per-window cache table, never person-level rows).

# ADR-0105: Admin usage metrics from existing tables

- Status: Proposed
- Date: 2026-11-04
- Deciders: Backend; owner
- Spec sections: §6.1 and §6.5 (contexts talk through facades), §6.3 (short caches), §14 (first-party analytics, DPDP)
- Amends: ADR-0101 (the admin dashboard gains usage metrics; `adminFunnel` gains database steps)
- Amended by: ADR-0106 (past days are read from the `users.daily_metrics` rollup; `adminRetention` cohorts)

## Context

The admin dashboard (ADR-0101) shows totals as of now. The owner wants trends: sign-ups, activity, content, top
subjects, verification throughput and a sign-up funnel. Step 3 of the admin plan (`ADMIN-FEATURES-PLAN.md` §2,
"Feasible now") builds these from tables the product already keeps, with no new tracking and no migration. A daily
rollup table and retention cohorts follow in step 5; new first-party events in step 6.

Owner defaults this work follows (each may be vetoed): (a) the terms version is chosen only from versions the web
has published (ADR-0103, unchanged here); (b) new first-party events (feature use, zero-result searches, quiz starts,
app and version adoption) come later with the same opt-out and 180-day retention, no IP addresses, no free text and
no third-party SDKs, and groups under 5 people hidden; (c) Google Analytics (ADR-0092) stays as it is. This ADR adds
no events, no SDK and nothing on the web; ADR-0092 is untouched.

## Decision

**Queries.** Platform admins only (`assertAdmin`: PLATFORM_ADMIN; anyone else FORBIDDEN, signed out
UNAUTHENTICATED): `adminGrowth(from, to, interval)`, `adminEngagement(from, to, interval)`,
`adminContentStats(from, to)`, `adminTopSubjects(from, to, by, first)` and `adminVerificationStats(from, to)`.
`adminFunnel` keeps its shape and also takes database steps. Nothing is written, so nothing is audited.

**Days.** Calendar days in `ADMIN_METRICS_TIME_ZONE`, `Asia/Kolkata` (IST, UTC+05:30, no daylight saving), a constant
in `contexts/users/src/domain/usage-metrics.ts` passed to every query. `from` and `to` are any instants on the first
and last day; the window runs from midnight IST at the start of the first day to midnight after the last. Without
`from` it is the last 30 days, today included; a last day after today is today; at most 366 days, else VALIDATION.
`interval` is DAY (default) or WEEK; weeks start on Monday and the first one starts on the window's first day. Every
result returns its `range` (instants, days and time zone). One exception: learning time and learning activity are
stored per learner's own day (ADR-0030: their zone, rolling over at 04:00), so they are counted on that stored day.

**Definitions.**
- Growth: accounts created, login emails verified, registrations finished and accounts verified per bucket.
  Deleted accounts and the study publisher (ADR-0098) are left out. The sign-up method is the provider linked in the
  sign-up transaction (within a minute of the account), else EMAIL (password or email link); a provider linked later
  does not change it.
- Active person on a day: a session started or refreshed (each refresh writes a new `Session` row), a usage
  event, or a `LearningDay` with at least one event that day. DAU is the last day of the window, WAU and MAU its last
  7 and 30 days, stickiness the average DAU over those 30 days divided by MAU (a partly-over today does not drag it).
- Learning minutes: `LearningDay.learningSeconds` (focus, reviews, quizzes), not imported old-site time. Notes
  created: not deleted, not the synced study pages. Doubts answered: the first answer from someone other than the asker;
  the median hours to first answer is over the doubts first answered in the window. Quiz attempts: class and shared
  quizzes. Uploads: files people uploaded in the window that are still stored, not server-made exports. Shares: direct
  shares with a person (not the CONNECTIONS fan-out rows), and shares to a group or class.
- Top subjects: notes created with a topic in the subject (a note counts once per subject), saves of such notes, or
  minutes with the subject's topics open (`LearningDayTopic.seconds`, studying and reading). A topic key
  `topic:<id>` maps to its subject; `core:<subject>/<topic>` to the subject with that slug.
- Verification: requests made in the window, decisions (approved, rejected) made in it, the median hours from request
  to decision for those decisions, and the queue now (pending and the oldest pending request's age), by method with
  college-ID cards apart from other documents.
- Funnel database steps: `signed_up` (account created), `email_verified` (never before sign-up), `first_note` (the
  account's first note, deleted ones included, study pages not), `returned_d7` (first activity, as above, at least 7
  days after sign-up and not before the previous step). Each step's time is its first occurrence since `since`.

**Privacy.** Aggregates only; no account, note or document is identified and no free text is returned. A breakdown
group with fewer than 5 distinct people (sign-up methods, upload purposes, verification methods, subjects) is left out
and counted in `hiddenSmallGroups` (k-anonymity threshold 5, the constant ADR-0103 introduced). Counts of people by
their activity (active people, the funnel's database steps) leave out accounts that opted out of analytics
(`User.analyticsOptOut`) and deleted accounts, whatever table the activity comes from; usage events from opted-out
accounts are already dropped at ingest. Counts of things (notes, minutes, doubts, files, requests) include everyone,
as `adminMetrics` does.

**Boundaries.** The `users` context assembles the results and reads only its own tables (User, OAuthAccount,
Session, usage_events, VerificationRequest). `notes` and `core` count their own tables through new methods on the
existing `NOTES_ADMIN_STATS` and `CORE_ADMIN_STATS` facades. Top subjects by learning time takes three calls so no
context reads another's tables: `core` lists the topic keys with time, `notes` maps keys to subjects, `core` sums
seconds and distinct learners per subject. Active people and `returned_d7` need person-level sets across contexts, so
`core` returns account ids per learning day to `users` in process; only counts leave `users`.

**Caching.** Each API process keeps a result for about 5 minutes, keyed by query, days and options; concurrent
identical requests share one computation and a failure is not kept. `generatedAt` says when it was computed.
`adminFunnel` is not cached (its default `since` moves).

## Consequences

The web can build the Growth, Engagement, Content, Subjects, Verification and Funnel tabs (plan step 4) against these
queries. Results for today can be up to 5 minutes old in a process.

Every call scans raw rows in the window. `Session` has no index on `createdAt`, and active people, MAU and
`returned_d7` move account ids between contexts in memory; this is fine at today's size and is what the step-5
`daily_metrics` rollup replaces (past days from rollups, today live), together with retention cohorts. Revisit then,
or sooner if `adminEngagement` takes over a second on the production box. ADR-0106 (2026-11-04) adds that rollup:
growth, engagement, content and verification read past days from it and count today live; the definitions above are
unchanged.

Hiding a small group does not stop subtraction: a total minus the shown groups can reveal the hidden ones' sum.
Admins can already see individual accounts in the admin tools, so the threshold keeps the dashboard from singling
people out rather than protecting against a determined admin; revisit (complementary suppression) if metrics are ever
shown to anyone else.

The time zone is a constant: a second market would make it a setting or a query argument.

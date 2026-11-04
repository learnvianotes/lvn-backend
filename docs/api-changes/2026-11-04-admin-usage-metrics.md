# Admin usage metrics from existing tables

- Date: 2026-11-04
- Package: `@lvn/contracts` 0.78.0 → **0.79.0**
- Spec: ADR-0105 (amends ADR-0101); admin plan step 3
- Breaking: no. Five new admin queries, four new enums; `adminFunnel` accepts four more step names. Existing fields
  and existing funnel calls keep their shape and results.

## Why

The admin dashboard showed totals as of now. These queries add trends (sign-ups, activity, content, top subjects,
verification) and a sign-up funnel, computed from tables the product already keeps. No new tracking, no migration,
no third-party service. Google Analytics (ADR-0092) is unchanged.

## Common rules

- **Authorization:** platform admins only. Anyone else gets `FORBIDDEN`; signed out, `UNAUTHENTICATED`.
- **Days:** calendar days in Asia/Kolkata (IST). `from` and `to` (`DateTime`, both optional) are any instants on the
  first and last day. Without `from`: the last 30 days, today included. A last day after today becomes today. More
  than 366 days, or `from` after `to` → a `VALIDATION` error on `from`.
- **Buckets:** `interval: MetricsInterval` is `DAY` (default) or `WEEK`. Weeks start on Monday; the first week starts
  on the window's first day and can be shorter. Every bucket is present, zeros included; `date` is its first day
  (YYYY-MM-DD).
- **Range:** each result has `range: AdminMetricsRange { from to firstDay lastDay timeZone }`.
- **Small groups:** a breakdown row with fewer than 5 distinct people is left out and counted in `hiddenSmallGroups`
  (k-anonymity threshold 5). Show it as "n groups with fewer than 5 people hidden".
- **Caching:** about 5 minutes per API process; `generatedAt` says when the numbers were computed.

```graphql
enum MetricsInterval { DAY WEEK }
enum SignUpMethod { EMAIL GOOGLE GITHUB LINKEDIN }
enum AdminSubjectMetric { NOTES LEARNING_TIME SAVES }
enum AdminVerificationMethod { INSTITUTIONAL_EMAIL TEACHER DOCUMENTS COLLEGE_ID }

type AdminMetricsRange { from: DateTime! to: DateTime! firstDay: String! lastDay: String! timeZone: String! }
```

## New queries

### `adminGrowth(from, to, interval): AdminGrowth!`

```graphql
type AdminGrowth {
  range: AdminMetricsRange!  interval: MetricsInterval!  generatedAt: DateTime!
  totals: AdminGrowthTotals!                    # signUps emailVerified registrationsCompleted verifications
  series: [AdminGrowthPoint!]!                  # date + the same four counts
  signUpMethods: [AdminSignUpMethodCount!]!     # { method: SignUpMethod!, users: Int! }, largest first
  hiddenSmallGroups: Int!
}
```

Accounts created, login emails verified, registrations finished, accounts verified. Deleted accounts and the study
publisher are left out. The sign-up method is the provider linked within a minute of the account's creation, else
`EMAIL`.

### `adminEngagement(from, to, interval): AdminEngagement!`

```graphql
type AdminEngagement {
  range: AdminMetricsRange!  interval: MetricsInterval!  generatedAt: DateTime!
  dau: Int!  wau: Int!  mau: Int!  stickiness: Float!
  series: [AdminEngagementPoint!]!  # date activeUsers learningMinutes notesCreated doubtsAsked doubtsAnswered quizAttempts
}
```

Active on a day: started or refreshed a session, sent a usage event, or recorded learning that day. Accounts that
opted out of analytics and deleted accounts are never counted as active. `dau` is the last day; `wau`/`mau` the last
7/30 days (they can reach before `range.from`); `stickiness` = average DAU over those 30 days ÷ `mau` (0–1, 0 when
`mau` is 0). In a WEEK bucket `activeUsers` is distinct people in the week. `learningMinutes` counts each learner's own
day (04:00 rollover in their zone). `doubtsAnswered` is doubts whose first answer from someone other than the asker
came in the bucket. `quizAttempts` covers class and shared quizzes.

### `adminContentStats(from, to): AdminContentStats!`

```graphql
type AdminContentStats {
  range: AdminMetricsRange!  generatedAt: DateTime!
  notes: AdminNoteCreationCounts!   # created public unlisted shared private (visibility now; deleted and study pages left out)
  uploads: AdminUploadStats!        # files bytes(String) byPurpose { purpose files bytes } hiddenSmallGroups
  scans: AdminScanCounts!           # clean infected failed pending, of those uploads
  doubts: AdminDoubtStats!          # asked answered resolved answers medianHoursToFirstAnswer (Float, null when none)
  places: AdminPlaceCounts!         # groups classrooms groupPosts classroomPosts
  sharing: AdminSharingCounts!      # noteShares (to one person) placeShares (to a group or class) saves
}
```

Uploads are files people uploaded in the window that are still stored; data exports are left out. `byPurpose` hides a
purpose with fewer than 5 uploaders (its files stay in `files` and `bytes`). `purpose` is a `FilePurpose` value as a
string.

### `adminTopSubjects(from, to, by: AdminSubjectMetric!, first: Int): AdminTopSubjects!`

```graphql
type AdminTopSubjects {
  range: AdminMetricsRange!  by: AdminSubjectMetric!  generatedAt: DateTime!
  subjects: [AdminSubjectCount!]!   # { subjectId: UUID!, title, value: Int!, users: Int! }, by value
  hiddenSmallGroups: Int!
}
```

`value` is notes created, minutes with the subject's topics open, or saves. `users` is the distinct note owners,
learners or savers (always ≥ 5). `first` is 1–50 (10 when omitted); outside that → `VALIDATION` on `first`.

### `adminVerificationStats(from, to): AdminVerificationStats!`

```graphql
type AdminVerificationStats {
  range: AdminMetricsRange!  generatedAt: DateTime!
  requested: Int!  approved: Int!  rejected: Int!  pending: Int!
  medianHoursToDecision: Float      # decisions in the window; null when none
  oldestPendingHours: Float         # the queue now; null when empty
  byMethod: [AdminVerificationMethodCount!]!   # { method, requested, approved, rejected }
  hiddenSmallGroups: Int!
}
```

`requested` counts requests made in the window; `approved`/`rejected` count decisions made in it; `pending` and
`oldestPendingHours` describe the queue now. Every purpose (account and teacher role) is included.

## Changed: `adminFunnel(steps, since)`

Same arguments and result. `steps` may now also contain:

| Step | Reached when |
| --- | --- |
| `signed_up` | the account was created |
| `email_verified` | the login email was verified (never earlier than sign-up) |
| `first_note` | the account's first note was created (deleted notes count, synced study pages do not) |
| `returned_d7` | first activity (session start or refresh, usage event, learning day) ≥ 7 days after sign-up and not before the previous step |

They mix with event names, e.g. `["signed_up", "email_verified", "first_note", "returned_d7"]` or
`["signed_up", "page_view"]`. Database steps leave out deleted accounts and accounts that opted out of analytics.
An unknown step → `VALIDATION` listing every allowed step ("Use each step once." for duplicates). Funnels of event
names alone return the same numbers as before.

## Migration

None. No schema change, no new setting, no new environment variable.

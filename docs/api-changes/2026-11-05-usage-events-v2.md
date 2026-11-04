# First-party usage events v2 and their admin metrics

- Date: 2026-11-05
- Package: `@lvn/contracts` 0.80.0 → **0.81.0**
- Spec: ADR-0107 (amends B9's ingest, ADR-0105, ADR-0106); admin plan step 6, backend half
- Breaking: no new required field. Behaviour: `ingestAnalytics` is stricter about `props` (see below); three new
  admin queries and four enums.

## Ingest (`ingestAnalytics`)

New event names, each with required props (fixed values only, lower case, from `@lvn/contracts/domain`):

| name | props |
| --- | --- |
| `feature_use` | `{ feature: UsageFeature }`, e.g. `{ feature: 'pdf_viewer' }`. Once per feature per page session. |
| `search_no_results` | `{ scope: UsageSearchScope, wordCount: number }`. Never the query. Send it besides the `search`. |
| `quiz_start` | `{ kind: QuizStartKind }` (`class`, `shared`, `note`, `practice`). |
| `search` | optional `{ scope, wordCount }` (`words` still read as `wordCount`). |

- **Refused** (`VALIDATION` in `userErrors`, `field` points at the event, nothing in the batch is stored): an unknown
  event name; props not an object, over 1024 characters or over 16 keys; a new event without its value or with an
  unknown one.
- **Dropped** (the event is stored without them): keys a new event does not have; in the older events, keys naming
  personal data or text (email, name, query, text, title, url, path, user, …) and values that are not a short token,
  a number or a boolean. Clients can run `sanitizeUsageProps` from `@lvn/contracts/validation` first.
- **appVersion:** `MAJOR.MINOR[.PATCH[.BUILD]]`, optional `-pre` and `+build`, ≤ 32 characters, leading `v` dropped;
  anything else is stored as null. Send the web build version / the app's version name consistently.
- Opt-out, batching (40 per call, 30 calls a minute) and 180-day retention are unchanged.

## New queries (platform admins only: `FORBIDDEN` otherwise, `UNAUTHENTICATED` signed out)

All take `from: DateTime, to: DateTime` (last 30 days when omitted, at most 366 days, IST days) and return `range`
and `generatedAt`. A group with fewer than 5 distinct people is left out and counted in `hiddenSmallGroups`.

```graphql
adminFeatureUsage(from: DateTime, to: DateTime): AdminFeatureUsage!
#   events, features { feature: UsageFeature, users, events }, hiddenSmallGroups,
#   quizStarts { starts, byKind { kind: QuizStartKind, users, starts }, hiddenSmallGroups }
adminSearchQuality(from: DateTime, to: DateTime): AdminSearchQuality!
#   searches, zeroResults, zeroResultRate (null without searches),
#   byScope { scope: UsageSearchScope (null = none sent), users, searches, zeroResults, zeroResultRate }, hiddenSmallGroups
adminVersionAdoption(from: DateTime, to: DateTime): AdminVersionAdoption!
#   platforms { platform: ClientPlatform, users, events, versions { appVersion (null = none), users, events, share } },
#   hiddenSmallGroups (a hidden platform counts itself and its versions)
```

Enums: `UsageFeature`, `UsageSearchScope`, `QuizStartKind` (the contracts ids in upper case).

```graphql
query { adminFeatureUsage { features { feature users events } hiddenSmallGroups quizStarts { starts } } }
```

## Migration

- Database: none. The nightly rollup writes new metric names into `users.daily_metrics` and a `_rollup` /
  `day:usage` marker; days rolled up before the deploy are counted live until re-rolled (a backfill re-rolls them).
- Clients: run `contracts:sync` and codegen. Web/mobile start sending the new events in their own PRs.

# ADR-0107: First-party usage events v2: feature use, zero-result searches, quiz starts and app versions

- Status: Proposed
- Date: 2026-11-05
- Deciders: Backend; owner
- Spec sections: §14 (first-party analytics, DPDP), §6.3 (cheap reads)
- Amends: B9's usage-event ingest (allow-list and props), ADR-0105 (three more admin queries), ADR-0106 (the rollup
  stores their counts)

## Context

Step 6 of the admin plan (`ADMIN-FEATURES-PLAN.md`) asks which product areas people use, how often search finds
nothing, how many quizzes are started, and which app versions are in use. B9's ingest accepted six event names and
stored any small `props` object as sent, so a client could store free text (a search query, a title) by mistake, and
`appVersion` was any 32 characters.

Owner default (b), which this ADR implements and which may be vetoed: new first-party events for feature use,
zero-result searches and quiz starts, plus app/version adoption, with the same opt-out and 180-day retention, no IP
addresses or user agents, no free text, no third-party SDKs, and admin breakdowns hiding groups under 5 people.
Owner default (c): Google Analytics (ADR-0092) stays as it is; nothing here touches it.

## Decision

**One definition in contracts.** `@lvn/contracts` (`domain/usage-events`, `validation/usage-events`) owns the event
names, the fixed id lists and the props rules, so web, mobile and the API read the same thing. Added events:
- `feature_use` `{ feature }`: one of `UsageFeature` (notes_editor, page_editor, pdf_viewer, voice_note,
  quick_capture, read_aloud, class_quiz, shared_quiz, flashcards_review, exam_plan, focus, groups, classroom, doubts,
  ai_assist, resources, search, profile, settings). Clients send it once per feature per page session, not per action.
- `search_no_results` `{ scope, wordCount }`: a `UsageSearchScope` (all, notes, people, groups, classrooms,
  resources, topics) and the number of words, capped at 20. Never the words. Sent besides the `search` event.
- `quiz_start` `{ kind }`: a `QuizStartKind` (class, shared, note, practice).
- `search` may now carry `{ scope, wordCount }` (both optional; older clients' `words` is read as `wordCount`).

**Strict props, server side.** `sanitizeUsageProps` runs on every event before it is stored. A batch is refused
(`VALIDATION`, nothing stored) for an unknown event name, props that are not an object, over 1024 characters as JSON
or over 16 keys, or one of the three new events without its required fixed value. Otherwise unknown keys are dropped;
the three new events keep only their own keys. The older events keep only short tokens (no spaces, `@` or `/`, at most
40 characters, not an id-like hex run), finite numbers and booleans, under keys that do not name personal data or text
(email, name, query, text, title, url, path, user, …); everything else is dropped.

**App version.** Stored only when it looks like a version: `MAJOR.MINOR[.PATCH[.BUILD]]`, optional `-prerelease` and
`+build`, at most 32 characters, a leading `v` dropped; anything else is stored as no version. The session id is kept
only when it is 1 to 64 letters, digits, `_` or `-`.

**Admin queries** (platform admins only, `assertAdmin`; IST days; at most 366 days; ~5-minute cache):
- `adminFeatureUsage(from, to)`: per feature, distinct people and events; quiz starts per kind.
- `adminSearchQuality(from, to)`: searches, zero-result searches and their rate, in all and per scope.
- `adminVersionAdoption(from, to)`: per platform, distinct people and events per app version, and its share.
Every breakdown group with fewer than 5 distinct people is left out and counted in `hiddenSmallGroups`; totals include
it. A hidden platform's versions are hidden with it. Opted-out and deleted accounts are not counted.

**Rollup.** The ADR-0106 nightly job also stores per day: `feature_use_events` / `feature_use_users` (by feature),
`quiz_starts` / `quiz_start_users` (by kind), `searches`, `searches_no_results`, `search_users` (by scope),
`app_version_events` / `app_version_users` (by `PLATFORM|version`) and `platform_users`. A second marker
`_rollup` / `day:usage` says a day has them, so days rolled up before this change are counted live until rolled up
again. Distinct people over a window are counted live from the events (the small-group rule needs the exact number);
past the 180 days the events are kept, the busiest stored day is used as a lower bound, which can only hide more.
No migration: the rows go in the existing `users.daily_metrics` table.

Unchanged: opt-out (`User.analyticsOptOut` drops the events at ingest), 180-day retention of `usage_events`, 730-day
retention of rollup rows, no IP address or user agent read or stored, no third-party SDK, Google Analytics.

## Consequences

Clients must send the new events' fixed values exactly; a client with an id the API does not know gets its whole
batch refused, so a new feature id is added to contracts (and the GraphQL enum) before a client sends it. The zero-
result rate is only right when the client sends `search_no_results` besides the `search`, as documented. Props the
old clients sent that are free text are now dropped instead of stored.

Privacy text (the web owns the policy): suggested addition to the first-party analytics list: "which parts of the app
you use, when a search finds nothing (its type and number of words, never what you typed), when you start a quiz, and
the app version". No new purpose.

Revisit if the owner vetoes default (b), or if a feature id list per client is needed.

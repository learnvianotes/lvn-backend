# Learning history (P6b)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.42.0
- Spec: §14.2; ADR-0023, ADR-0030, ADR-0067
- Breaking: no

## What changes for clients

- **`learningHistory(before?, days?)`** (signed in) gives the person's days, newest first, in their time zone (a day
  rolls over at 04:00):
  - `days` at a time, at most 60 (default 14); `before` (YYYY-MM-DD) pages back, from `nextBefore`, which is null
    when no older day has anything in it;
  - each `LearningHistoryDay` has `day`, `learningSeconds` (focus sessions, reviews and quizzes), `readingSeconds`
    (notes and /core topics open), `reviews`, `quizAnswers`, and `counted` (10 learning minutes or 10 reviews, the
    Rhythm bar of ADR-0030);
  - `topics`, most time first: `key` (`topic:<id>` or `core:<subject>/<topic>`), `seconds`, and `topic`, the notes
    `Topic` when the viewer may see it (null for /core topics);
  - `notes`: the notes opened that day that the viewer can still read, newest first (an entry is null when the note
    is no longer readable);
  - `timeZone`, the zone the days are counted in.
- **`setLearningTimeZone(input: { timeZone })`** sets the zone by hand (an IANA zone; others answer `VALIDATION`).
  The apps send the device's zone with their learning events.
- **`Topic`** is now a federation entity of the notes subgraph (`@key(fields: "id")`), so other subgraphs can return
  it.
- Events about /core topics (any with a `core:` topic key) keep /core progress (ADR-0023): time on a topic and its last
  visit, `TOPIC_COMPLETED` (done, revisit) and `PROBLEM_MARKED` (SOLVED, REVISIT, NONE), as LVN rows beside the old
  site's. A claimed old-site
  snapshot's study days join the history.

## Authorization

- Each person sees only their own history; signed out answers `UNAUTHENTICATED`.
- Topics and notes in it go through the notes subgraph's visibility rules at read time.

## What clients should do

- Show `counted` days as counting for Rhythm, and the others as plain days: never "missed".
- Keep sending learning events while offline; late events land on the day they happened.

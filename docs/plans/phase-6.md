# Phase 6 — Learning intelligence: plan

Spec §18, §14.1–14.3 and ADR-0030, which replaces streaks with **Rhythm**. Scope:
- `trackEvents`, with learning events partitioned by month;
- learning history;
- Rhythm (the Today ring, the weekly Rhythm and Exam Readiness) in place of streaks;
- FSRS flashcards;
- the exam planner;
- weak-topic detection;
- rule-based recommendations;
- focus mode.

**Exit criteria:**
- recommendations respect visibility;
- Rhythm's time-zone tests (the spec's "streak timezone tests", ADR-0030);
- events survive being offline.

The owner asked (2026-10-13) for every phase to be built and shown on the **local environment** ("use the local VM
for entire setup"); the AWS sandbox stays deferred.

Started 2026-10-13. The way of working is unchanged:
- each slice lands backend first, then web and mobile;
- it is merged to `main` in every repo it touches;
- it is checked on the local environment: smoke, lifecycle, live web and Maestro.

Nothing is pushed.

## What earlier phases left for this one

- **Class performance** (ADR-0046, ADR-0064): staff see per-student quiz results. A class quiz's first attempt is the
  score; attempts are stored.
- **Recommendation signals** from the public-note pipeline (ADR-0061): the study aids of public notes, quizzes among
  them.
- **Profile interests** (ADR-0026): department, year and interests feed recommendations.
- **`/core` progress** (ADR-0023): `TOPIC_COMPLETED` and `PROBLEM_MARKED` events. `coreProgress` returns the old
  site's history plus everything recorded since; the old site's per-day time and focus minutes seed history.
- **`SEARCH_PERFORMED`** (Phase 4) and **`AI_REQUESTED`** (Phase 5) become learning events.

## Research this plan rests on

- **Rhythm** (ADR-0030, its sources):
  - daily streaks raise app use, not learning;
  - forgiving weekly goals, comebacks and pauses keep people going after a miss;
  - retrieval practice and spacing build learning;
  - cooperative goals beat leaderboards.
- **FSRS:** the open-spaced-repetition scheduler. `ts-fsrs` (MIT) implements FSRS v6; 5.4.1 is the stable release,
  and 0.9 is the usual requested retention.
- **Today's queue is capped** at about 20 cards / 15 minutes, with overflow spread over the next days. ADR-0030
  forbids review backlogs without a cap. How large a backlog people tolerate is unmeasured here: ADR-0030's
  validation tracks a median backlog under a day.

## Slices

| Slice | What | Repos |
| --- | --- | --- |
| **P6a Learning events** | `learning.LearningEvent`, partitioned by month on the server's time, with partitions made ahead by the worker. `trackEvents(batch)`: at most 100 events, each with its UUIDv7 id. Ids are deduplicated, so a retried batch counts once. The client's time is clamped to the server's. `metadata` is at most 2 KB. The event enum is in `@lvn/contracts/domain`. Events the server already knows are recorded by the server: notes created, published and forked; class quizzes; AI requests. The apps send searches. Web batcher: every 10 s or 20 events, kept in IndexedDB while offline, flushed when the page is hidden. Phone batcher: the same, in its SQLite store. Events go into the data export and are erased with the account. A pseudonymous copy for self-hosted PostHog, off unless configured | all three |
| **P6b History and `/core` progress** | Learning history by day and topic (time, notes, quizzes, cards reviewed), paginated. `/core` pages send `TOPIC_VIEWED`, `TIME_SPENT`, `TOPIC_COMPLETED` and `PROBLEM_MARKED`; `coreProgress` adds them to the old site's. A history page on the web and a screen on the phone | all three |
| **P6c FSRS flashcards** | A person studies the flashcards of their own notes, and of any note they can read once they choose "Study these cards". Review state is per person per card (`core.CardReview`, FSRS v6 with `ts-fsrs`), with a review log. Today's queue is capped at 20 cards or 15 minutes. Grading (Again, Hard, Good, Easy) is optimistic: feedback in under 100 ms, a haptic tick on the phone. The phone reviews offline and sends its reviews later. A card whose note the person may no longer read leaves the queue | all three |
| **P6d Rhythm** | ADR-0030. The Today ring: due cards, today's plan tasks and one weak topic, filled only by learning actions. A day counts at 10 learning minutes or 10 reviews. 3–6 target days a week (default 4). Weeks run Monday–Sunday in the person's time zone, and the day rolls over at 04:00. Comeback after a missed planned day. Pause up to 14 days a term. Counters never reset. `core.RhythmWeek`, `RhythmPause`; the time zone is taken from the device and is changeable in settings. Time-zone tests cover India, a negative offset, a daylight-saving change and travel | all three |
| **P6e Exams, weak topics, Readiness** | `core.Exam` (name, date, topics from notes and `/core`). The planner spreads revision sessions back from the date into plan tasks; reminders go through notifications, outside quiet hours and never loss-framed. A topic is weak at quiz accuracy under 60 % over its last 3 attempts, or with no revisit in 14 days before an exam. Exam Readiness % comes from FSRS recall strength and quiz accuracy, with a target line. Three weeks out, LVN suggests a higher weekly target | all three |
| **P6f Recommendations** | Hourly per active person into `core.Recommendation(userId, kind, entityId, score, reason, expiresAt)`: revise a weak topic, continue an unfinished note, an upcoming exam's topics, popular public notes in their subjects and interests, quizzes on recently read topics. Every item has a reason. Read through the read predicate at read time, not only when computed. Recommendations join the leakage suite | all three |
| **P6g Focus mode, buddies, class performance** | Focus sessions: Pomodoro, 25/5 by default; 10 minutes or more on a topic counts. Up to five Rhythm buddies, by mutual consent, from people followed or connected; they see "studying now" during each other's sessions, and a session may carry a Google Meet link. A classroom ring of shared weekly progress, where minors appear by first name only. Class performance for staff: per-student quiz results and topics the class finds hard | all three |
| **P6h Home** | The home dashboard on web and phone: greeting, the Today ring, this week's Rhythm, continue learning, the next exam and its Readiness, recommendations | web, mobile |
| **P6i Exit** | Recommendations in the leakage suite; Rhythm time-zone tests; events surviving offline (web: offline, then online; phone: Maestro in airplane mode); live web and Maestro on the local environment; `docs/releases/phase-6.md` | all three |

## Decisions to record before the slice that needs them

| ADR | Question | Leaning |
| --- | --- | --- |
| Learning events (P6a) | Partitioning without Prisma support; idempotency on a partitioned table; client batching | A parent table partitioned by `serverTs`, made by SQL in the migration; the worker creates three months ahead, plus a default partition. A key table (`LearningEventKey(id)`, kept 30 days) answers "seen?", since a unique key on a partitioned table must include its partition key. Prisma reads through a view or raw SQL |
| FSRS reviews (P6c) | Which cards; where state lives; offline reviews | `core.CardReview` keyed by person and card id (card ids are stable across versions). The deck is the person's own notes plus notes they choose to study. Reviews replay in order on the server when they arrive late |
| Rhythm (P6d) | Where the time zone comes from; what counts; term length for pauses | Device time zone, kept on the account. Counting is from learning events in the person's own time zone, with a rollover at 04:00. A term is a half-year (January–June, July–December) until classes define terms |
| Exams and Readiness (P6e) | How Readiness is computed; how the plan spreads sessions | Readiness = the mean over the exam's topics of 0.6 × FSRS retrievability of the topic's cards + 0.4 × recent quiz accuracy (a topic with no data counts as 0). Sessions are spread evenly back from the exam, weak topics first, with no more than one session a day per exam |
| Recommendations (P6f) | Rules, scores, refresh, visibility | One rule per kind with a fixed score band; recomputed hourly for people active in the last 7 days. Read through `NOTE_ACCESS` so a note that left visibility disappears at once |
| Focus and buddies (P6g) | Presence without a live room; minors in the classroom ring | Presence goes over the existing live channel (ADR-0042); buddies only by mutual consent. The classroom ring shows totals, and names only of adults who opted in |

## Needed from the owner (not blocking)

- **PostHog (optional):** a self-hosted PostHog address and key, if product analytics are wanted. Off until then.
- **Term dates:** if pauses should follow real term dates rather than half-years.

## Progress

| Slice | State | Evidence |
| --- | --- | --- |
| P6a Learning events | Done 2026-10-13 | ADR-0067. `trackEvents` (at most 100 per batch, each UUIDv7 once, refusals one by one, the clock believed back 30 days, the device time zone kept on `core.LearnerSettings`); `learning.LearningEvent` partitioned by month in a schema Prisma does not manage, partitions made three months ahead nightly and dropped past 24 months; days in the person's zone with a 04:00 rollover (`core.LearningDay`, `LearningDayTopic`; focus, review and quiz time is learning, reading is history only). The server records notes created, published and forked, AI requests and class quizzes through the new `LEARNING` facade; the apps send searches without their words. Export and erasure; an optional pseudonymous PostHog copy, off by default. Web and phone batchers (localStorage, SQLite outbox) send every 10 s or 20 events and keep events while offline; both record a note opened and the time read. Contracts 0.41.0. Tests: time-zone unit tests (India, New York and London across daylight saving), learning events e2e 9; API 392 + 3 todo (the health check timed out once under the full suite's load and passed alone); web unit 104, Playwright 329 (a note read offline survives a reload and goes out when the connection is back); phone Jest 262. Local environment: smoke 13/13, lifecycle 81/81 (a batch counts once, the focus time lands on the person's day, the server's events, the partitions); live 47/47 (a note read in the browser reaches the events; the Typesense typo test failed once under the run's load, when Postgres answered, and passed alone); Maestro 21/22: the `ai` flow scrolled down past the first AI flashcard when the model answered fast; the flow now finds the cards from their Add button upwards and passed (fixed on the P6b branch) |
| P6b History and `/core` progress | | |
| P6c FSRS flashcards | | |
| P6d Rhythm | | |
| P6e Exams, weak topics, Readiness | | |
| P6f Recommendations | | |
| P6g Focus mode, buddies, class performance | | |
| P6h Home | | |
| P6i Exit | | |

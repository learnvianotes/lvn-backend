# Phase 6 — Learning intelligence (closed on the local environment; AWS still deferred by the owner)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §14 and §18. Plan:
[phase-6.md](../plans/phase-6.md).

Scope:
- learning events, the learning history and /core progress;
- flashcard reviews with FSRS;
- Rhythm (ADR-0030): a weekly, forgiving habit instead of a daily streak;
- exams, weak topics and Exam Readiness;
- rule-based recommendations;
- focus mode, Rhythm buddies, the classroom ring and class performance;
- Home on web and phone.

Everything below runs and is tested on the dev machine and on the **local environment** (ADR-0036), the stand-in for
the AWS sandbox, which the owner has deferred.

## Shipped

### lvn-backend

| Slice | What | ADR |
| --- | --- | --- |
| P6a Learning events | `trackEvents` (at most 100 a batch, each UUIDv7 once, refusals one by one); `learning.LearningEvent` partitioned by month in a schema Prisma does not manage, partitions made three months ahead and dropped past 24 months; days in the person's zone with a 04:00 rollover (`core.LearningDay`, `LearningDayTopic`); events the server records itself; export and erasure; an optional pseudonymous PostHog copy, off | 0067 |
| P6b History | `learningHistory`: days with learning and reading time, reviews, quiz answers, topics, and the notes opened that are still readable; `setLearningTimeZone`; `Topic` a federation entity; /core progress from events | 0067 |
| P6c Flashcard reviews | FSRS v6 (ts-fsrs): today's queue (20 a day, 10 new), grades replayed in order so one made offline lands where it belongs, each once; studying a readable note's cards | 0068 |
| P6d Rhythm | The week by learning day, 3–6 planned days, comebacks after a missed planned day, pauses of up to 14 days a half-year term, counters that never reset, weeks closed with the target they had and closed again by late events; nothing before a person's first day is missed | 0069 |
| P6e Exams | Exams on notes topics with a revision plan back from the day; quiz results by topic; weak topics (under 60 % over the last three results, or not revisited before an exam); Readiness from FSRS recall and accuracy against a target line to 80 %; the ring's plan tasks and weak topic; a day-more suggestion three weeks out; one evening reminder of a task left (`REVISION_REMINDER`); the `TOPICS` facade | 0070 |
| P6f Recommendations | An upcoming exam's topics, weak topics, notes to continue, quizzes on topics read this week and popular public notes, in fixed score bands, each with a reason; hourly for people active in the last week; every note read through the read rule when shown; items set aside for 30 days | 0071 |
| P6g Focus and buddies | Focus sessions whose time the server counts (at most the plan) as focus on their topics; Rhythm buddies by mutual consent from people followed or connected, with presence over the live channel (`BUDDY_PRESENCE`) and a `RHYTHM_BUDDY` notification; the classroom ring (totals, and names only of students who share; a child by first name); class performance for staff (first scores, hard topics) | 0072 |
| P6i Exit | Recommendations in the privacy suite; the Rhythm time-zone tests; events surviving offline on web and phone; this note | — |

Contracts 0.41.0 (P6a) to 0.44.0 (P6e–P6g). Migrations `20261021090000_learning_events` to
`20261023150000_focus_buddies`. New worker jobs: learning partitions (nightly), close Rhythm weeks (hourly),
exam reminders (hourly), recommendations (hourly), close focus sessions (every 15 minutes).

### lvn-web

- **Learning history** at `/history`, with the time zone days are counted in.
- **Reviews** at `/review` (keys 1–4 and Space; grades kept in the browser when the API cannot be reached), and
  "Study these cards" on a read note.
- **Rhythm** at `/rhythm`: today's ring and what is left, a comeback, the week, counters, planned days, pauses, the
  exam suggestion, focus mode, recommendations, buddies, and sharing with classes.
- **Exams** at `/exams` and `/exams/<id>`: Readiness against today's target, the plan, topic mastery, weak topics.
- **Home** at `/home` for a signed-in learner; the landing page's signed-in card opens it.
- **Classes:** a Rhythm tab for members and a Performance tab for staff.
- Quiz cards checked in a note are recorded on the note's topics; learning events are batched in the browser and
  survive going offline and a reload.

### lvn-mobile

- **Learning history**, **Reviews** (an SQLite outbox; today's cards kept for offline), **Rhythm**, **Exams** and
  **focus mode, buddies and sharing**, from the account screen.
- **Home** on real data: the greeting, today's ring and the week, the next exam's Readiness, the note to continue, and
  recommendations. The prototype's subject-chip row has no data behind it yet, so Home leaves it out; the component is
  kept.
- **Classes:** Rhythm and Performance tabs.
- Learning events in an SQLite outbox, sent every 10 seconds or 20 events and when the network returns.

## Bugs found and fixed

- **A new account was told it had missed days before it existed**, and offered a comeback on its first day. Found on
  the local environment (P6d). Rhythm now starts at a person's first day: the earlier of joining and their first
  learning day.
- **The phone said a grade was waiting to be sent after it had gone**: the review screen read the outbox before the
  send finished. Found by the new Maestro `review` flow (P6c).
- **The web sent a review grade twice** when grades came quickly: sending is now one at a time, with a second round
  for grades given meanwhile (P6c).
- **The sharing box on Rhythm only moved after the server answered**; it now moves at once and goes back if the save
  is refused. Found by Playwright (P6g).
- **Tests that depended on timing:**
  - the voice test's card positions were built from the clock and could end in the zero digit, which positions may
    not;
  - the worker test checked the search outbox at one instant;
  - two Maestro taps landed beside the gesture bar or below the fold.

  All four now wait for, or aim at, what they need.
- **The dev machine's disk:** Docker's build cache grew to about 100 GB over the day's deploys and an image build
  failed with `ENOSPC`. It was trimmed to 20 GB (`docker builder prune --keep-storage 20GB`).

## Test evidence (2026-10-13)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck | clean; dependency boundaries clean | clean | clean |
| Unit / integration / e2e | 864 passing + 1 todo across 18 packages: API 423 + 1 todo, contracts 174, notes 51, users 41, ai 40 (and 23 live tests against the real model, run on their own), core 33, storage 19, communication 15, and the libraries | 104 unit (Vitest) | 279 (Jest: unit and components) |
| Browser / device E2E | — | Playwright 377 on desktop and phone (mocked API) | Maestro on the VM (see below) |
| `pnpm audit --prod --audit-level high` | clean (one advisory ignored with its reason) | clean | clean (two advisories ignored with their reasons) |
| Contract | `graphql:check`; `env:check` (67 variables) | codegen against the current schema; the contracts copy synced | the contracts copy synced |
| Migrations | applied to an empty database, no drift | — | — |

### On the local environment (2026-10-13)

Deployed with `infra/scripts/deploy-local.sh` to `http://100.70.234.41:8080`:
- `lvn-backend:c20d0d4d6a2b` (api, worker);
- `lvn-web:646186398a20`;
- `lvn-pdf-engine:35833b87f347`.

| Check | Result |
| --- | --- |
| `pnpm smoke` | 13/13 |
| `pnpm lifecycle` | 89/89. Phase 6 adds: a learning-event batch counted once; the focus time on the person's day in their zone; the partitions; the history showing the day; a new flashcard through today's reviews; Rhythm counting today in A's zone; a plan and a pause round trip; an exam a month away whose topic a wrong quiz answer makes weak; that topic recommended with its reason; a buddy invite accepted, the buddy seen studying with a Meet link, and gone when the session ends |
| Playwright, live | 53/53 + 1 skipped (Google is off on the VM), on desktop and phone: a note read reaches the learning events; a flashcard reviewed shows in the history; a new account's Rhythm, a six-day plan and an exam pause; an exam on a curated topic found by name, its topic recommended, a focus session counted, and Home |
| Maestro | 27/27 on this deploy (27 min), with the Phase 6 flows: `review` (a flashcard written on the phone, reviewed, and the day in the history), `rhythm`, `exams`, `focus`, `home`, and `events-offline` (a note read in airplane mode reaches the server when the network returns) |

Slices were verified as they landed: P6a on its own; P6b and P6c together (lifecycle 83/83, live 49/49, Maestro
23/23); P6d (lifecycle 85/85, live 51/51, Maestro 24/24 once two taps were aimed); P6e–P6h together (above).

## Exit criteria (§18)

- [x] **Recommendations respect visibility.** The privacy suite's two recommendation todos are tests: A's private note
  never reaches B's recommendations, whatever B claims to have opened; and a note made private leaves B's list on the
  next read, before the rows are computed again (every note goes through `NOTE_ACCESS.readable` when shown).
- [x] **Rhythm time-zone tests** (`rhythm.test.ts`, 13): one late-night session on the right day in India, New York
  and Auckland; a Sunday-night session in its week on either side of the date line; both of London's clock changes;
  someone who travels from India to London mid-week; a day lived twice across the date line counting once.
- [x] **Events survive offline.**
  - Web: a note read with the API unreachable is kept in the browser, survives a reload and goes out when the
    connection is back (Playwright `learning.spec.ts`).
  - Phone: the Maestro `events-offline` flow reads a note in airplane mode; when the network returns, the server
    lists it among the notes opened that day.

## Known gaps

- **/core reading is not counted.** /core stays guest-only (the owner's decision of 2026-10-08), so time on /core pages
  reaches neither the history nor Rhythm. A signed-in reader's notes, reviews, quizzes and focus sessions all count.
- **Quizzes on /core pages record nothing**, so /core topics have no accuracy for weak topics or Readiness; they still
  get exam plans and the "not revisited" rule through their curated notes topics.
- **Recommendations are rules.** The table is ready for an embedding-based model's rows, which is not built.
- **The classroom ring and class performance are computed when asked**, for up to 300 students a class. Larger
  classes would want a rollup.
- **Reminders are in-app and push only**; there is no email for a revision task.
- **ADR-0030's A/B test of Rhythm against streaks** waits for analytics (below).

GraphQL schema: `@lvn/contracts` 0.44.0 (`contracts/graphql/schema.graphql`).

## Needed from the owner (not blocking)

- **PostHog (optional):** a self-hosted PostHog address and key, if product analytics are wanted (ADR-0067). Off until
  then; ADR-0030's A/B test of Rhythm against streaks waits for it.
- **Term dates:** if pauses and "Rhythm weeks this term" should follow real term dates rather than half-years.
- **AWS** is still deferred: everything here runs on the local environment.

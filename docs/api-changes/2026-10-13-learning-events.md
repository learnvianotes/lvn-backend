# Learning events (P6a)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.41.0
- Spec: §14.1; ADR-0067
- Breaking: no

## What changes for clients

- `trackEvents(input: TrackEventsInput!): TrackEventsPayload!` on the `core` subgraph, signed in only.
  - **Input:** `events`, at most 100 `LearningEventInput`:
    - `id`, the client's UUIDv7, so a batch sent twice counts once;
    - `type`, `entityType`, `entityId`, `topicKeys` (at most 10, `topic:<id>` or `core:<subject>/<topic>`);
    - `durationMs` (at most 4 hours), `metadata` (at most 2 KB);
    - `clientTs`, `sessionId`, `platform`.

    Plus the device's IANA `timeZone`.
  - **Answer:** `accepted` (new), `duplicates` (seen before), and `rejected`: the batch index and words for each
    refused event.
  - A batch past 100 events answers `VALIDATION`; too many batches in a minute answer `RATE_LIMITED`. Clients keep the
    events and try again.
- New enums `LearningEventType` (§14.1's types) and `Platform` (`WEB`, `ANDROID`, `IOS`).
- `@lvn/contracts`:
  - `validation/learning.ts`: `learningEventInputSchema`, `LEARNING_LIMITS`, `topicKeySchema`, `isTimeZone`;
  - `domain`: `SERVER_LEARNING_EVENTS` (refused from clients), `TimeSpentActivity` and `LEARNING_ACTIVITIES`.

## Meaning of some events

- **`TIME_SPENT`** takes `metadata.activity`. `FOCUS`, `REVIEW` and `QUIZ` are learning time, which Rhythm counts;
  `READING` is history only.
- **`QUIZ_COMPLETED`** takes `metadata.answered`.
- **Recorded by the server, refused from clients:** `NOTE_CREATED`, `NOTE_PUBLISHED`, `NOTE_FORKED`, `EXAM_CREATED`
  and `AI_REQUESTED`.

## Authorization

- A person's events are their own. They go into the data export (`data/learning/`) and are erased with the account.
- Events about something the person cannot read change nothing but their own history.

## What clients should do

- Send through one batcher: every 10 s or at 20 events, and keep what was not sent (localStorage on the web, SQLite on
  the phone, at most 1,000).
- Record `NOTE_OPENED` and the visible `TIME_SPENT` with a note.
- Record `SEARCH_PERFORMED` when words stay in place for two seconds, without the words.

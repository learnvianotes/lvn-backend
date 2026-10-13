# ADR-0067: Learning events

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents
- Spec sections: §14.1, §14.2, §15.2, §18 (Phase 6); ADR-0023, ADR-0030, ADR-0042

## Context

§14.1 asks for one append-only `LearningEvent` table, partitioned monthly. It feeds history, Rhythm (ADR-0030),
recommendations, analytics and notifications.
- Clients send events through a single `trackEvents(batch)` mutation, batched every 10 s or 20 events and queued
  offline.
- No component calls analytics directly.
- A pseudonymous copy goes from the worker to self-hosted PostHog, never from clients.
- Phase 6's exit asks that **events survive offline**.

Facts that shape the design:
- **Prisma (7.10) cannot declare a partitioned table.** Its drift check would see each monthly partition as a table
  missing from the schema and propose to drop it.
- **A unique key on a partitioned table must include the partition key.** So `id` alone cannot be unique across
  partitions: a batch sent again after a lost answer would be stored twice.
- **Clients' clocks are wrong sometimes.** A phone offline for days sends events long after they happened.
- **Rhythm counts days in the person's own time zone** with a 04:00 rollover (ADR-0030), and history is read per day
  and topic. Reading raw events for every screen would not scale.

## Decision

1. **Where.**
   - A Postgres schema of its own, **`learning`**, owned by the `core` context. It is not in Prisma's `schemas` list,
     so migrations create it in SQL and Prisma's drift check never sees it.
   - `core` reads and writes it with SQL (`$queryRaw`/`$executeRaw`) in one repository class.
2. **The table.** `learning.events(id uuid, user_id uuid, type text, entity_type text, entity_id text, topic_keys
   text[], duration_ms int, metadata jsonb, client_ts timestamptz, server_ts timestamptz, session_id text, platform
   text)`.
   - It is `PARTITION BY RANGE (server_ts)`, with one partition per month (`events_2026_10`…) and a default
     partition.
   - The worker's nightly job creates partitions three months ahead.
   - Indexes on each partition: `(user_id, server_ts)` and `(user_id, type, server_ts)`.
   - It is append-only: no updates. Deletion happens only by account erasure, and by dropping partitions past
     retention (below).
3. **Each event counts once.**
   - Clients give every event a UUIDv7.
   - `learning.event_keys(id uuid primary key, received_at)` records the ids seen; it is pruned after 30 days.
   - One statement inserts the keys with `ON CONFLICT DO NOTHING RETURNING id`, and only those events.
   - A batch sent twice is stored once.
4. **Time.**
   - `server_ts` is when the server received the event, and partitions by it.
   - `client_ts` is kept but clamped: never after `server_ts`, and never more than 30 days before it.
   - Days, for history and Rhythm, are taken from `client_ts` in the person's time zone. So an event sent late still
     counts on the day it happened.
5. **`trackEvents(batch)`.**
   - A batch holds at most 100 events. `type` comes from `@lvn/contracts/domain` `LearningEventType`; `metadata` is at
     most 2 KB as JSON; `duration_ms` is at most 4 hours.
   - It answers `{ accepted, duplicates }`. Invalid events are refused one by one with their index, so one bad event
     does not lose a batch.
   - It is rate-limited per person (§7.1).
   - A signed-out person cannot send events. `/core` pages send none until sign-in.
6. **Events the server already knows** are recorded by the server, and `trackEvents` refuses them from clients:
   `NOTE_CREATED`, `NOTE_PUBLISHED`, `NOTE_FORKED`, `EXAM_CREATED` and `AI_REQUESTED`.
   - Other contexts call the new `LEARNING` facade after their own work: `notes` when a note is created, `ai` when a
     task or a question is queued. `core` hears `NotePublished` and `NoteForked`, and records `QUIZ_COMPLETED` when a
     class quiz is submitted.
   - Recording never fails the work that caused it.
   - **Searches are the apps' to send.** The API sees every keystroke of a search box; the apps send
     `SEARCH_PERFORMED` when words stay in place for two seconds, with how many words and where, never the words.
7. **Rollups for reading.** On ingest, `core.LearningDay(userId, day, learningSeconds, reviews, quizAnswers,
   counted)` and `core.LearningDayTopic(userId, day, topicKey, seconds, events)` are upserted. Both are ordinary
   Prisma tables. `day` is the person's local date with the 04:00 rollover. History, Rhythm and recommendations read
   these; raw events are read only to rebuild them.
8. **Clients.**
   - **Web** (`lib/learning.ts`): a batcher sends every 10 s or at 20 events. It keeps unsent events in
     `localStorage` (at most 1,000, the oldest dropped first), sends when the connection returns, and sends with
     `keepalive` when the page is hidden.
   - **Phone** (`lib/learning.ts`): the same over its SQLite store (`learning_outbox`, migration 3). It sends when the
     app changes state or the network comes back.
   - Both drop the queue at sign-out.
   - Both record a note opened (`NOTE_OPENED`) and the visible time with it (`TIME_SPENT`, `READING`) in pieces of at
     most 5 minutes, ignoring glances under 5 seconds.
9. **Privacy and retention.**
   - Events are personal data: they go into the data export (`data/learning`) and are erased on `UserDeleted`.
   - Partitions older than 24 months are dropped, as §15.2 keeps the legacy archive.
   - The PostHog copy is pseudonymous: an HMAC of the user id with its own secret. Its metadata is limited to type,
     platform and duration. It is sent by the worker only when `POSTHOG_HOST` and `POSTHOG_API_KEY` are set (off by
     default).

## Consequences

- **Prisma does not see the schema.** The `learning` schema is invisible to Prisma, so its SQL lives in one class
  with its own tests, and `resetDatabase` in tests truncates it too.
- **Rhythm and history read small rollup tables,** so their cost does not grow with the number of events.
- **Late events can change a past day.** An offline week arriving at once updates that week's Rhythm, as ADR-0030
  intends ("counts when it happened").
- **Old days:** the old site's per-day study time (ADR-0023) is written into `LearningDay` when a legacy claim is
  imported, so returning learners see their history.

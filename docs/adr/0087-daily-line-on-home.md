# ADR-0087: Home's line for the day, written by AI

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §13 (Home), §15 (AI); amends ADR-0076

## Context

Home's night-sky card (board A) said the same thing every day: "Keep learning, K", "Make it happen" and one fixed
quote. The owner circled it: "the highlighted section should be generated with ai and changes daily".

## Decision

- **`dailyLine`** (signed in) gives Home a headline of a few words and one sentence for the person's learning day
  (04:00 rollover, in their zone, ADR-0070). `fromAi` says whether AI wrote it; `pending` says AI is writing it now.
- **The first Home of a learning day** queues a `daily-line` job on `core.engagement`. The job gathers a few facts and
  asks AI, through the new `DAILY_LINES` facade (written by `ai`, prompt `daily-line`, routable as `DAILY_LINE`), for
  the line. The facts are:
  - the week's rhythm (counted of planned days, weeks met);
  - the next exam and how far away it is;
  - the note last worked on;
  - a topic to strengthen.

  The facts are the person's own learning, so the line is the platform's work but goes only to a provider that may
  receive private data. It counts against no one's allowance.
- **Each written line is kept in Redis** for its day (`core:daily-line:<user>:<day>`, two days). It stays the same all
  day and is new the next day.
- **Until it is written, or when AI is off or failed**, a chosen line shows: one of 21 of our own, picked by the person
  and the day, so it also changes daily. No quotes are put in famous people's mouths. After a failure, AI is not asked
  again for an hour.
- **What the model writes is made to fit:** quotes, emoji and a headline's "!" are left out, the headline is at most six
  words, and the line at most 160 characters.
- **Clients:**
  - the phone's card shows "Keep learning, <name>", the headline and the line;
  - web Home shows the headline and line under the greeting;
  - while `pending`, both ask again every few seconds, for up to a minute.

## Consequences

- One small model call per active person per day (about 300 tokens), at most.
- Home never waits for AI: the chosen line shows at once, and the person's own replaces it seconds later.
- A person who never opens Home costs nothing.

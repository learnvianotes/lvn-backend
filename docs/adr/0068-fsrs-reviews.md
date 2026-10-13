# ADR-0068: Flashcard reviews with FSRS

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents
- Spec sections: §14.2 ("Flashcards use FSRS scheduling; review state is per user per card"), §18 (Phase 6);
  ADR-0030, ADR-0067

## Context

Flashcards are a card type of notes (`flashcard`, with a front and a back). People make them by hand or keep them
from AI tasks (ADR-0059) and public notes' study aids (ADR-0061).

§14.2 asks for FSRS scheduling with review state per person per card. ADR-0030's Today ring is built from the reviews
due, capped at about 20 cards or 15 minutes, with the overflow spread over the next days, and never with a backlog
that grows without bound. Grading must answer within 100 ms, with a haptic tick on the phone.

Facts that shape the design:
- **FSRS is open and implemented.** `ts-fsrs` (MIT, 5.4.1) is the open-spaced-repetition group's FSRS v6: per-card
  stability and difficulty, four grades, and a requested retention (0.9 is the usual).
- **A card's id is stable across a note's versions** (§4.6), so review state can hang on it.
- **Not every card a person can read should be in their reviews.** A public note's flashcards are someone else's
  until they choose to study them.
- **The phone reviews offline**, so grades arrive late and sometimes out of order.

## Decision

1. **What a person studies.**
   - The flashcards of their own notes (owner or editor), and of any note they can read once they choose "Study these
     cards" (`core.StudyNote(userId, noteId)`). They can stop.
   - A card is read as the person reads the note now, through `NOTE_ACCESS`: the draft for owners and editors, the
     published version for readers.
   - A note they can no longer read drops out of their reviews at once.
2. **State.**
   - `core.CardReview(userId, cardId)` holds the FSRS card: due, stability, difficulty, reps, lapses, state, last
     review.
   - `core.CardReviewLog` holds every grade: rating, when it was given, its duration and the client's `clientOpId`.
   - The state is always the replay of the card's log in the order the grades were given. So a grade made offline and
     arriving after a later one lands where it belongs, and the same `clientOpId` sent twice counts once.
   - `ts-fsrs` is used with a requested retention of 0.9, a maximum interval of 365 days, and fuzz on.
3. **Today's queue.**
   - Cards due by the end of the person's learning day (04:00 rollover, ADR-0067), most overdue first, then new
     cards.
   - The whole queue is capped at 20 cards a day, of which at most 10 are new. What is left waits for the next days:
     an overdue card loses nothing but a little retention, and FSRS schedules from the real gap.
4. **Grading** (`reviewCard`): rating `AGAIN | HARD | GOOD | EASY`, `reviewedAt`, `durationMs` and `clientOpId`.
   - It answers the card's next due date.
   - The apps update the screen before the answer comes (optimistic).
   - It records `FLASHCARD_REVIEWED` with its duration as a learning event (ADR-0067). The apps do not send their own.
5. **Privacy.**
   - Reviews and their logs are the person's own. They go into the data export and are erased with the account.
   - A note's owner never sees who studies their cards.

## Consequences

- **Rhythm (P6d) and Exam Readiness (P6e) read this state.** Readiness uses each card's retrievability at the exam
  date.
- **A rewritten card is still the same card.** If a person reverses a card's meaning, its schedule carries on as if
  nothing changed. They can reset a card.
- **Review state survives the card leaving the deck.** A card a person cannot read any more keeps its state but is not
  shown; it returns if the note becomes readable again.
- **Later:** FSRS can be optimised per person from their logs once they have a few hundred reviews. The logs are kept
  for that.

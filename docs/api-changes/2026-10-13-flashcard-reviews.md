# Flashcard reviews (P6c)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.42.0
- Spec: §14.2; ADR-0068
- Breaking: no

## What changes for clients

- **`reviewQueue: ReviewQueue!`** (signed in) gives today's cards and the deck's counts: `due`, `new`, `doneToday`,
  and `waiting` (cards past today's cap).
  - The cards come due first (most overdue first), then new, 20 a day, at most 10 new.
  - Each card (`ReviewCard`) has `cardId`, `noteId`, `noteTitle`, `front` and `back` (rich text), `state` and `due`.
- **`reviewCard(input: { cardId, rating, reviewedAt?, durationMs?, clientOpId })`** takes a rating `AGAIN | HARD |
  GOOD | EASY` and answers the card's next `due`, `state` and `intervalDays`.
  - The same `clientOpId` counts once.
  - A grade made offline is sent with its `reviewedAt` and lands in order.
  - A card not in the person's deck answers `NOT_FOUND`.
- **Choosing what to study:**
  - `studyNoteCards(input: { noteId })` and `stopStudyingNoteCards(…)` add or drop a readable note's flashcards.
  - `resetCardReview(input: { cardId })` starts a card again.
  - `Note.viewerStudying` says whether the viewer studies the note.
- `@lvn/contracts` gains `REVIEW_LIMITS`.

## Authorization

- The deck is the person's own notes' flashcards (owner or editor), plus readable notes they chose.
- A note they can no longer read drops out of their deck at once.
- Nobody else sees anyone's reviews.

## What clients should do

- Grade optimistically.
- Send each grade with a fresh `clientOpId`, and keep it to send again offline.
- Do not send `FLASHCARD_REVIEWED` learning events: the server records one per grade.

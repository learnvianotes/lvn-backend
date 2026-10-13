# Study aids for public notes (P5d)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.36.0
- Spec: §10.3; ADR-0061
- Breaking: no

## What changes for clients

- **`Note.aiInsights`**: a public note's study aids, made from its published version when it was published PUBLIC.
  - The tasks are SUMMARIZE, KEY_CONCEPTS, PRACTICE_QUESTIONS, QUIZ and FLASHCARDS, in that order.
  - Each `AiInsight` has `id`, `task`, `status`, `markdown` (text aids), `title` and `cards` (quiz, flashcards),
    `hidden` and `versionId`.
  - Readers, signed in or not, see the READY ones the owner has not hidden. The owner sees every step, hidden ones
    marked.
- **`Note.noteProcessingStatus`**: the owner's view of the aids' progress for the current published version:
  `{ versionId, steps: [{ task, status }], done }`. It is null for anyone else, or before any.
- **`setAiInsightHidden(id, hidden)`** returns `OkPayload`. Owner only; NOT_FOUND otherwise.
- **`keepAiCards`** also takes an aid's id:
  - readers keep its cards as a NEW_NOTE of their own;
  - only people who can edit the note may add them to it (FORBIDDEN otherwise).
- **Live:** `LiveEventKind` gains `NOTE_PROCESSING`. The note's owner gets `{ kind: NOTE_PROCESSING, id: noteId }`
  when an aid finishes; refetch `noteProcessingStatus` and `aiInsights`.
- **Config:** `AI_PUBLIC_PIPELINE` (default true) switches the pipeline off.

## What clients should do

- Show the READY aids beside a public note:
  - text aids as Markdown;
  - the quiz and flashcards as interactive cards, with "Save as my note".
- Show them on the public page too.
- Show the owner the progress and a hide/show toggle per aid.

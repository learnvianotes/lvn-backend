# ADR-0059: AI tasks on notes — results beside the note, cards kept in one tap

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P5b); the owner's notes of 2026-10-09 (ADR-0025)
- Spec sections: §10.1, §10.3, §18 (Phase 5); ADR-0010, ADR-0025, ADR-0058

## Context

ADR-0025 gives every note a person can read one "AI tasks" menu. Its tasks are summarise, key concepts, explain
simply, flashcards, quiz, practice questions, translate (English, Hindi, Telugu), find mistakes, create notes, and
outline → note. Two rules come with them:
- Results that annotate the source are stored beside it.
- Results that make something new become the person's own.

The owner's notes add three things:
- a quick revision sheet;
- a person sees what was made, drops what they do not want, and adds the rest in one tap: into the note if they can
  edit it, otherwise into a new private note of their own;
- that is how quizzes and flashcards are "easy to keep".

§18 adds code explanation. §10.3 stores AI output separately from notes, which AI never changes.

## Decision

1. **Tasks.** `AiTaskType` gains `EXPLAIN_CODE` (on code cards) and `REVISION_SHEET`. There are two kinds:
   - **Text:** SUMMARIZE, KEY_CONCEPTS, EXPLAIN_SIMPLY, PRACTICE_QUESTIONS, TRANSLATE, FIND_MISTAKES and
     EXPLAIN_CODE. Their result is Markdown shown beside the note.
   - **Cards:** FLASHCARDS, QUIZ, REVISION_SHEET, CREATE_NOTES and OUTLINE_TO_NOTE. Their result is cards, each
     checked against its card type's schema in `@lvn/contracts` before it is stored. The preview is therefore exactly
     what is kept; a card that fails is dropped.

   Each task has a versioned prompt and a Zod schema for the model's JSON answer. Every task is tested against the
   real local model.
2. **Rights** (ADR-0025):
   - Every task needs the Ask-AI right (`note.askAi`: whoever may read the note).
   - CREATE_NOTES and OUTLINE_TO_NOTE need the fork right.
   - `notes` answers both through a new `NOTE_AI` facade.
3. **What the model reads.**
   - Owners and editors: the draft. Readers: the published version.
   - The whole note, or chosen cards. EXPLAIN_CODE reads the code cards only.
   - At most 24,000 characters; beyond that the start is used, and the result says it was cut.
   - Material from a note that is not PUBLIC is private, under ADR-0058's data-processing flag.
4. **Results.**
   - Each result is an `ai.NoteArtifact`: the note, the version it was made from, the requester, the task, its
     options, the status (QUEUED, RUNNING, READY or FAILED), the result, the error in words, and `keptAt`.
   - A result is its maker's alone, and is shown only while they can still read the note. They can delete it.
   - The note and its versions are never touched.
5. **Running.**
   - `runAiTask` first checks four things: that AI is on, the right, that there is something to read, and the day's
     allowance. Then it stores a QUEUED result and queues it on `ai.tasks`.
   - The worker runs one task at a time, since one GPU serves one model. It reads the note again as the person, then
     asks the gateway.
   - Clients poll `aiArtifact` until the result is READY or FAILED. Tasks take seconds.
6. **Keeping cards.** `keepAiCards(artifactId, cardIndexes, into)` writes through `NOTE_AI`:
   - `NOTE`: the cards are appended to the source note's draft through the normal save, for people who may edit it.
   - `NEW_NOTE`: the cards make a new PRIVATE note of the person's, titled from the result ("Flashcards — Heaps").
     For CREATE_NOTES and OUTLINE_TO_NOTE, which are always kept as a new note, it carries a copy's credit
     (ADR-0010).
7. **API.**
   - Queries: `aiArtifact(id)` and `Note.aiArtifacts` (the viewer's own, newest first).
   - Mutations: `runAiTask`, `keepAiCards` and `deleteAiArtifact`.
   - `UNAVAILABLE` (AI off or failing) and `RATE_LIMITED` (the day's allowance) come back as payload errors.
8. **Data export.** The archive gains `data/ai/artifacts.json` (the person's results) and `data/ai/usage.json`
   (their AI calls as counts).

## Consequences

- One menu serves every task on both clients. Text results are Markdown, so one renderer shows them all, and card
  previews reuse the card views.
- The public-note pipeline (P5d) writes the same `NoteArtifact` rows with no requester; readers will see those
  beside public notes.
- A person who loses access to a note stops seeing their results of it. Their rows stay in their data export until
  they delete them, or until a later sweep removes results of deleted notes.

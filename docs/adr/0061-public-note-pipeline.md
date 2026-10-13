# ADR-0061: Study aids for public notes, made when they are published

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P5d)
- Spec sections: §10.3, §18 (Phase 5); ADR-0037, ADR-0042, ADR-0058, ADR-0059, ADR-0060

## Context

§10.3: on a publish to PUBLIC, moderation, text extraction, a summary, key concepts, questions, a quiz, flashcards,
embeddings, the search index and recommendation signals follow:
- each step is a job writing a `NoteArtifact(type, versionId, status, payload)`;
- the note is never modified;
- the student sees progress (`noteProcessingStatus`) and can hide any generated artifact.

What already exists:
- **Moderation** decides before `NotePublished` is published for a PUBLIC note (ADR-0037). A held note gets no
  `NotePublished`.
- **Embeddings** come with Ask AI's chunks (ADR-0060), and the search index with Phase 4.
- **AI tasks** (ADR-0059) already make each of the five aids from a note, store them as `ai.NoteArtifact`, and keep
  quiz and flashcard cards in one tap.

Recommendation signals are Phase 6's.

## Decision

1. **The pipeline.**
   - `NotePublished` for a PUBLIC note starts it for that version: SUMMARIZE, KEY_CONCEPTS, PRACTICE_QUESTIONS, QUIZ and
     FLASHCARDS.
   - Each is an `ai.NoteArtifact` with no requester (`ownerId` null) and the version's id. It runs on the AI tasks'
     lane (`ai.tasks`, one at a time) with ADR-0059's prompts and schemas.
   - It reads the note as anyone does, through a new `NOTE_AI.publicSource`: the published version of a PUBLIC note in
     good standing.
   - It counts as the platform's work: no one's quota. The monthly budget breaker still applies.
   - A new version replaces the previous version's aids. The owner's hiding carries over, task by task.
   - With AI off, or `AI_PUBLIC_PIPELINE=false`, nothing starts; a later publish starts it.
   - A note that is no longer public when its turn comes ends FAILED and is not shown.
2. **Progress.**
   - `Note.noteProcessingStatus` gives the current version's steps and their states.
   - The owner's sockets get a live `NOTE_PROCESSING` event (the note's id) when a step ends; the web and the phone
     refetch.
   - Each aid that is READY publishes `NoteArtifactReady` (an event §3 already lists), so the public page is
     regenerated with it.
3. **Who sees them.** `Note.aiInsights`:
   - Readers, including people who are not signed in on a public note, see the READY aids that are not hidden.
   - The owner sees every step, hidden ones marked.
   - Aids are shown only while the viewer may read the note.
4. **Hiding.** `setAiInsightHidden(id, hidden)` is the owner's.
5. **Keeping.** A reader keeps an aid's cards (quiz, flashcards) as a new private note of their own, with
   `keepAiCards`, as with their own results; editors may also add them to the note. Nothing is recorded on the shared
   aid.

## Consequences

- **Cost.** A public note costs five model calls when published, and five more for each new version. Locally that is
  GPU time on the one lane, so a student's own task may wait behind a burst of publishes. In production
  `AI_PUBLIC_PIPELINE` and the budget breaker bound it.
- **Shared aids.** Aids are made from the published words alone and are the same for every reader. They are not the
  owner's data, so they are not in anyone's data export.
- **Recommendation signals** join this pipeline in Phase 6.

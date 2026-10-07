# ADR-0025: Read aloud, AI tasks, and a PDF engine that makes editable notes

- Status: Accepted (owner decisions, 2026-10-08); engine technology in ADR-0028
- Date: 2026-10-08
- Spec sections: §4.1, §4.4, §8.1, §10, §10.3, §18
- Amends: ui-reference items 5 and 6

## Decision

**PDF attachments** show as file cards with page count and a preview; opening or downloading one records a learning
event, so the owner sees how often it is used (ui-reference item 5).

**PDF engine — "Convert to editable note".** Any PDF a user can open becomes **their own PRIVATE note made of
editable cards** — headings, text, lists, tables, images, code, maths — that they can change and study with.
- Each user converts into their own copy, so a class can share one PDF and everyone works on their own version.
- Converting follows the **fork rule** (`file.convertToNote` = `note.fork` on the PDF's note): forking disabled by
  the owner means no conversion by others. The new note carries the same credit line as a fork (ADR-0010).
- Scanned pages go through OCR; pages the engine is unsure about are flagged for review in the editor.
- Pages converted count against the plan's `PDF_PAGES_MONTHLY` (ADR-0024). The engine runs as background jobs with
  progress (`pdfConversion`).
- Phase 2: PDFs with a text layer. Phase 5: scanned PDFs (OCR), handwriting, Hindi and Telugu, AI clean-up. The
  technology is chosen in ADR-0028.

**Read aloud.** Any note can be read aloud using the device's own text-to-speech (Web Speech API on the web,
`expo-speech` on mobile): free, offline, no backend, the current card highlighted, speed control. Phase 2.

**AI tasks.** One "AI tasks" menu on any note or PDF the user can read, and on project-workspace doubts:
Summarize, Key concepts, Explain simply, Flashcards, Quiz, Practice questions, Translate (English, Hindi, Telugu
first), Find mistakes, **Create notes** (from a PDF or note) and Outline → note.
- Results that annotate the source (summary, concepts, questions) are stored as `NoteArtifact`s next to it (§10.3)
  and can be hidden; results that make something new (notes, flashcard decks, quizzes) are the user's own PRIVATE items.
- `CREATE_NOTES` and `OUTLINE_TO_NOTE` make a copy of someone else's work, so they need the **fork** right; every other
  task needs **Ask-AI** (`aiTaskAction` in `@lvn/contracts`).
- All through the `AiGateway` (§10.1): quotas from the plan, cheap models for simple tasks, sources cited, nothing
  identifying sent to providers.
- Phase 5 with the AI gateway; Translate replaces the "Translate" quick action of the UI boards.

## Consequences

- PDFs stop being dead files: every student can turn class material into notes they own.
- The fork rule keeps owners in control of copies made by conversion or AI.

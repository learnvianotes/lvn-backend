# Phase 5 — AI: plan

Spec §18:
- the `AiGateway`, usage and quotas;
- summaries and quick notes;
- RAG Ask AI with sources, and Ask AI on workspace doubts (ADR-0015);
- AI tasks, and the PDF engine's OCR escalation and AI clean-up (ADR-0025, ADR-0028);
- quiz and flashcard generation;
- code explanation;
- transcription;
- the public-note pipeline (§10.3).

**Exit criteria:**
- a RAG leakage test with 0 leaks in 1,000 questions;
- the budget breaker verified;
- every artifact stored separately from the notes.

They are shown on the local environment (ADR-0036).

Started 2026-10-13. The owner asked for a **local model**: Ollama on the dev machine's GPU (RTX 5060 Ti, 16 GB).
- **Generation:** `gemma4` (7.5B, Q4_K_M, 128k context). It also takes images and audio and gives JSON output.
- **Embeddings:** `embeddinggemma` (768 dimensions, multilingual).

The local environment's containers reach the host's Ollama through QEMU's user network, at `10.0.2.2:11434`.

No note content leaves the machine. Other providers (OpenAI, Anthropic) stay adapters behind the same gateway, off
until the owner gives keys and a budget.

The way of working is unchanged: each slice lands backend first, then web and mobile; it is merged to `main` in every
repo it touches and checked on the local environment. Nothing is pushed.

## Owner notes recorded for this phase (ADR-0025)

- "The Quiz should be AI generated from the notes and people can add easily."
- The flashcards and a quick revision sheet are also generated from the notes. The person sees what was made, drops
  what they do not want, and adds the rest in one tap.
- Classroom quizzes come here, with quiz generation (corrected in the Phase 4 plan). Class performance waits for
  Phase 6's learning events.

## Slices

| Slice | What | Repos |
| --- | --- | --- |
| **P5a AI gateway** | The `ai` context. `AiGateway` with an Ollama adapter (chat with JSON schema, streaming, embeddings, images). The task → model table in the database. `AiUsage` per call. Daily token quotas from the plan (`AI_TOKENS_DAILY`: students 200k, teachers 1M, §10.1). A monthly budget breaker. A circuit breaker per provider. Versioned prompt templates in `contexts/ai/prompts/`, with outputs checked by Zod. Content is fenced against prompt injection. A per-provider data-processing flag (private notes go only to self-hosted or zero-retention providers). `aiStatus`, `myAiUsage`. Ollama on the local environment through `OLLAMA_URL`; a stand-in Ollama in tests | backend |
| **P5b AI tasks** | The AI allowance on the account page; ADR-0025's "AI tasks" on any note the person can read: summarise, key concepts, explain simply, practice questions, translate (English, Hindi, Telugu), find mistakes, explain code (on code cards), and the card-making tasks (flashcards, quiz, quick revision sheet, create notes, outline → note). Jobs run on the `ai` queue with live progress. Annotations are the person's own artifacts beside the note; made cards are previewed and kept in one tap, into the note if they can edit it, otherwise into a new private note (with credit, by the fork rule). Web and phone | all three |
| **P5c Ask AI** | `NoteChunk` in `notes` (about 500 tokens with 50 of overlap, per published version, pgvector), embedded through the gateway when a version is published, removed when a note leaves. `askAi` over this note, my notes, my groups and classes, or public notes: candidates filtered by `visibleNotesWhere` in the SQL, then nearest chunks, rerank, and an answer streamed with sources. Ask AI on a workspace doubt. `SEMANTIC_SEARCH` bound to pgvector (hybrid ranking can be switched on). The RAG leakage test | all three |
| **P5d Public-note pipeline** | On a PUBLIC publish: summary, key concepts, questions, a quiz and flashcards, each a `NoteArtifact` job after moderation, with `noteProcessingStatus`. Readers see them beside the note; the owner can hide any of them | all three |
| **P5e Quick notes, voice notes, transcription** | A quick note: rough text or a photo becomes a structured note. Voice notes recorded on the web and the phone (the gap carried since Phase 3). Transcription of voice notes and audio and video cards, with the local model's audio input or a Whisper worker, decided in this slice's ADR | all three |
| **P5f PDF escalation and clean-up** | ADR-0028 stage 4: low-confidence, handwritten and maths pages go to the vision model (at most about 15 % of a document) with a verbatim prompt; sharp disagreement with the OCR is rejected. Stage 6: AI clean-up of a converted note, started by the user and counted against their quota. Hindi now; Telugu waits for the owner's evaluation set | backend, web, mobile |
| **P5g Classroom quizzes** | A teacher publishes a quiz to a class (`CLASSROOM_PUBLISH_QUIZ`, `QuizPublished`), made by hand or generated from notes; students take it and see their score; attempts are stored (`QuizAttempt`) for Phase 6's performance views | all three |
| **P5h Exit** | RAG leakage 0/1,000; the budget breaker tripping and resetting; artifacts separate from notes (a note's versions are never changed by AI); live web and Maestro flows; `docs/releases/phase-5.md` | all three |

## Decisions to record before the slice that needs them

| ADR | Question | Leaning |
| --- | --- | --- |
| The AI gateway (P5a) | §10.1 lists OpenAI, Anthropic and Ollama, with model routing, accounting, quotas and a budget breaker; the owner wants a local model now | *ADR-0058.* Provider adapters behind one interface; Ollama first, the others off without keys. Models and prices per task in the database. Quotas before the call (the plan's), usage after. A self-hosted model costs 0, so the budget breaker trips locally only when a route has a price (the test sets one) |
| AI tasks and artifacts (P5b) | Where results live, who sees them, how made cards become one's own | `ai.NoteArtifact` owned by the requester for user tasks, and by the note for the public pipeline (P5d); card-making tasks keep a preview until the person keeps cards |
| Ask AI (P5c) | Where chunks live; streaming over the ids-only live channel (ADR-0042) | `NoteChunk` in `notes` beside the read predicate; the `ai` context retrieves through a facade; answers stream to the asker's own socket |
| Transcription (P5e) | gemma4's audio input or a Whisper service | Measure both on the evaluation recordings; prefer one model for everything if it is good enough |

## Needed from the owner (not blocking)

- **For AWS later:** a provider for production (keys) and the monthly AI budget. Until then everything is local.
- **The FREE plan's AI quota:** §10.1's numbers apply until the owner sets others.
- **Telugu OCR and the PDF evaluation set** (carried from Phase 2).

## Progress

| Slice | State | Evidence |
| --- | --- | --- |
| P5a AI gateway | In progress | |
| P5b AI tasks | | |
| P5c Ask AI | | |
| P5d Public-note pipeline | | |
| P5e Quick notes, voice notes, transcription | | |
| P5f PDF escalation and clean-up | | |
| P5g Classroom quizzes | | |
| P5h Exit | | |

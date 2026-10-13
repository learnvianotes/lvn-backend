# Phase 5 — AI (closed on the local environment; AWS still deferred by the owner)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §10 and §18. Plan:
[phase-5.md](../plans/phase-5.md).

Scope:
- the `AiGateway`, usage and quotas;
- AI tasks, quick notes and voice notes with transcription;
- Ask AI with sources, also on workspace doubts;
- the public-note pipeline;
- the PDF engine's escalation to a vision model, and AI clean-up;
- classroom quizzes.

The owner asked for a **local model**: Ollama on the dev machine's GPU, with `gemma4` for text, pictures and sound,
and `embeddinggemma` for embeddings. No note content leaves the machine. On the owner's later ask, platform admins
can now choose other providers (Claude, ChatGPT, Gemini, or a custom OpenAI-compatible server such as a LiteLLM
proxy) on one page; until they do, the local model answers.

Everything below runs and is tested on the dev machine and on the **local environment** (ADR-0036), the stand-in for
the AWS sandbox, which the owner has deferred.

## Shipped

### lvn-backend

| Slice | What | ADR |
| --- | --- | --- |
| P5a AI gateway | The `ai` context. Every AI call goes through `AiGateway`: the plan's daily tokens (`AI_TOKENS_DAILY`), a monthly budget breaker (`AiBudgetThreshold` at 80 % and 100 %), a circuit breaker, versioned prompts with people's text fenced, answers checked against a schema with one repair, and an `AiUsage` row per call. `aiStatus` and `myAiAllowance`; `ErrorCode.UNAVAILABLE` | 0058 |
| P5b AI tasks | Twelve tasks on any note the person can read: summarise, key concepts, explain simply, practice questions, translate (English, Hindi, Telugu), find mistakes, explain code, and the card-making tasks (flashcards, quiz, revision sheet, create notes, outline → note). Results are the maker's own `ai.NoteArtifact`, beside the note; made cards are kept in one tap, into the note's draft or a new private note. A note's versions are never touched | 0059 |
| P5c Ask AI | `notes.NoteChunk` (about 500 tokens, `vector(768)`, HNSW) per published version. `askAi` over this note, my notes, my places or public notes, and on a workspace doubt: candidates from the read predicate, nearest chunks, a rerank, and an answer streamed with numbered sources. `SEMANTIC_SEARCH` bound to the same embeddings | 0060 |
| P5d Public-note pipeline | A PUBLIC publish that passed moderation gets a summary, key concepts, practice questions, a quiz and flashcards, made as the platform's work; readers see them beside the note and on its public page, and the owner can hide any | 0061 |
| P5e Quick notes, voice notes, transcription | Transcription is gemma4's audio input, in 30-second pieces (30 minutes at most). `QUICK_NOTE` turns rough words and up to four photos into a structured note | 0062 |
| P5f PDF escalation and clean-up | Unsure and formula pages (at most 15 % of a document) are read again by the vision model, unless its reading disagrees sharply with the OCR. `CLEAN_UP` proposes repairs of words a conversion broke, checked to be repairs, applied by the person | 0063 |
| P5g Classroom quizzes | Class staff publish a quiz made with the AI quiz task or by hand; members answer without seeing the answers, the server scores, and the first attempt is the score | 0064 |
| P5h Exit | The AI artifacts security test; the budget breaker tripping and resetting on the local environment; this note | — |
| AI providers (owner's ask) | Connections to Claude, ChatGPT, Gemini, a custom OpenAI-compatible server or an Ollama, with keys sealed under `AI_KEYS_SECRET` and never shown again; the default for chats and for embeddings; tasks sent elsewhere; a one-click test; a circuit breaker per connection. Nothing changes until an admin adds one | 0065 |

Infrastructure:
- **The local environment** reaches the host's Ollama at `http://10.0.2.2:11434` (QEMU's address for the host), has a
  monthly AI budget of $5 to show the breaker, and generates `AI_KEYS_SECRET`.
- **The PDF engine** renders unsure pages for the vision model.
- **Configuration:** `AI_PROVIDER`, `OLLAMA_URL`, `AI_CHAT_MODEL`, `AI_EMBED_MODEL`, `AI_TIMEOUT_MS`,
  `AI_MONTHLY_BUDGET_MICRO_USD`, `AI_PUBLIC_PIPELINE` and `AI_KEYS_SECRET`.
- **Migrations:** `20261016090000_ai_gateway` and the six after it, to `20261020090000_ai_providers`.

### lvn-web

- **The AI panel** on the editor and the reader: the tasks, translation, today's allowance, results as Markdown, card
  previews kept in one tap, clean-up changes shown before and after.
- **Ask AI** at `/ask`, in the AI panel and on a workspace doubt, with citations linking to their sources.
- **Study aids** as tabs on public notes, in the reader and on the server-rendered public page.
- **Voice notes** recorded in the editor and transcribed; **Tidy into notes** for rough notes and photos.
- **Class quizzes:** a Quizzes tab, a builder (AI or by hand) and the quiz page.
- **AI providers** at `/admin/ai`, for platform admins.

### lvn-mobile

- An **AI tasks screen** from a note's header, with the same tasks, translation, keeping cards and clean-up.
- **Ask AI** from My notes, on a note and on a doubt.
- **Study aids** under a published note.
- **Voice note** and **Photo** in the Create sheet, and a voice note in a note's Add menu, transcribed.
- **Class quizzes:** the tab, the builder and the quiz screen.
- Today's AI allowance on the account screen.

## Bugs found and fixed

- **A quiz showed the first question's choices under every question.** Apollo's cache kept quiz choices by their id,
  which is unique only within a question, and AI quizzes number them `c1`, `c2`… in each. Maestro's quiz flow found
  it. Both apps now keep choices inside their question, and their tests use repeating ids (P5g).
- **The phone asked the API for 200 cards** where it serves 100, and cached the refusal, blanking the AI screen after
  a sync (P5b).
- **The phone lost its microphone permission:** `expo-image-picker`'s `microphonePermission: false` removed
  `RECORD_AUDIO` for every plugin (P5e).
- **Voice notes failed to upload on Android,** which sent a blob with the type it guessed from the file name rather
  than the one declared (P5e).
- **The AI providers page overflowed on phones:** a long provider name in a button that could not wrap pushed the page
  sideways and the dialog's Save button off screen. Its Playwright test on a phone found it (AI providers).

## Test evidence (2026-10-13)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck | clean; dependency boundaries clean | clean | clean; `expo-doctor` 21/21 |
| Unit / integration / e2e | 781 passing + 3 todo across 17 packages: API 383 + 3 todo, contracts 174, notes 51, users 41, ai 39 (and 23 live tests against the real model, run on their own), storage 19, communication 15, and the libraries | 99 unit (Vitest) | 258 (Jest: unit and components) |
| Browser / device E2E | — | Playwright 325 on desktop and phone (mocked API) | Maestro 22/22 against the VM (see below) |
| `pnpm audit --prod --audit-level high` | clean (one advisory ignored with its reason) | clean | clean |
| Contract | `graphql:check`; `env:check` (65 variables) | codegen against the current schema; the contracts copy synced | the contracts copy synced |
| Migrations | applied to an empty database, no drift | — | — |

The AI tests:
- **Gateway** (`gateway.test.ts`, 9 tests) against Postgres and a stand-in Ollama: answers in the asked shape, one
  repair, streaming, embeddings, the plan's daily tokens, the budget breaker, the circuit breaker, AI off, private
  material refused.
- **Providers** (`providers.test.ts`, 11 tests) against stand-ins of OpenAI's API (as OpenAI, Gemini and a LiteLLM
  proxy speak it) and Anthropic's:
  - who answers (route, default, environment);
  - structured answers and streaming in each dialect;
  - pictures and recordings;
  - 768-number embeddings;
  - prices;
  - the data-processing flag;
  - a circuit per connection;
  - unreadable keys.
- **API:** AI tasks, Ask AI, the pipeline, voice and quick notes, PDF AI, clean-up, class quizzes, and the AI
  providers page (6 tests: admins only, keys never returned or audited, keys refused without `AI_KEYS_SECRET`, the
  connection test, defaults and routes, deletion).
- **Security:**
  - the RAG leakage suite (1,000 questions);
  - the AI artifacts suite;
  - the permission matrix with the class-quiz cases.
- **Live, against the real model:** the 12 tasks, transcription of real speech, a photo of notes, Ask AI, a page
  read again, clean-up.

### On the local environment (2026-10-13)

Deployed with `infra/scripts/deploy-local.sh` to `http://100.70.234.41:8080`:
- `lvn-backend:b0dff7226576` (api ×2, worker);
- `lvn-web:f99aa4d8e113`;
- `lvn-pdf-engine:35833b87f347`.

Both reach the dev machine's Ollama (gemma4, embeddinggemma) at `10.0.2.2:11434`.

| Check | Result |
| --- | --- |
| `pnpm smoke` | 13/13 |
| `pnpm lifecycle` | 78/78. Since Phase 4 it adds a reader's flashcards from the real model kept as their own note, Ask AI citing a published note, a public note's five study aids, Hindi pages read again by gemma4, a real clean-up applied, a class quiz, and the budget breaker tripping over the $5 budget and resetting |
| Playwright, live | 45/45 on desktop and phone (a run of 46 with one desktop-only test): AI tasks, Ask AI, study aids, tidy and clean-up with the real model, a class quiz, and the AI providers page adding Ollama's OpenAI-compatible API as a custom provider, testing it and answering a summary through it. That test first failed: a task run at once was answered by the environment's model, because the worker had read the settings less than 30 s before. Settings now carry a version every process checks before a call |
| Maestro | 22/22 on this deploy (20 min 37 s), with `quiz.yaml` (a learner takes a class quiz) and the AI flows against the real model. The first P5g run found the quiz-choices bug below |
| RAG leakage | 1,000 questions, 0 leaks (`rag-leakage.security.test.ts`) |

The latest development build (with the quiz fix) is installed by adb on the owner's Samsung (SM-S918B) and talks
to the local environment.

## Exit criteria (§18)

- [x] **A RAG leakage test with 0 leaks in 1,000 questions.** `rag-leakage.security.test.ts` asks 1,000 random
  questions:
  - over private notes, notes shared with a person, a group or a class, public notes and trashed notes;
  - many of them name another note's marker to pull it in;
  - over random scopes, through the real retrieval, rerank and answer.

  It finds no leak. With the read rule broken it reports leaks at once.
- [x] **The budget breaker verified.**
  - In tests: `gateway.test.ts` trips it at the cap, tells the platform at 80 % and 100 %, and a new month starts
    from nothing.
  - On the local environment: the lifecycle check writes a month's spend over its $5 budget. AI pauses, saying why,
    and once that spend is moved to last month AI answers again on both API instances.
- [x] **Every artifact stored separately from the notes.** `ai-artifacts.security.test.ts` runs every AI task the API
  offers (but transcription), Ask AI and a public note's study aids on a published note, as its owner and as a reader.
  - Every result is READY.
  - The note's versions and draft are exactly as before.
  - Only keeping cards changes a note: its draft (never a version), or a new note of the person's own.

## Needed from the owner

- **AI in production, when it is wanted.** Either:
  - add a provider on `/admin/ai` (Claude, ChatGPT, Gemini, or a LiteLLM proxy) with its key and prices, and tick
    "private notes may go to it" only with a zero-retention agreement; or
  - give a GPU host for the local models.

  Plus the monthly AI budget.
- **Still open from earlier phases:**
  - the Firebase service account and `google-services.json`, for real push;
  - the FREE plan's limits;
  - optionally, a GitHub token;
  - confirmations of follower counts and TA admission;
  - the legal texts;
  - the PDF page limit and evaluation set, and Telugu OCR;
  - the AWS sandbox.

## Known gaps carried forward

**AI:**
- **Telugu:** the PDF engine reads Hindi through the vision model, and Telugu waits for the owner's evaluation set.
- **Class performance:** per-student results and class performance wait for Phase 6's learning events. Staff see how
  many submitted.
- **Hybrid search ranking** has its semantic source but stays off. Turning it on is a ranking decision for Phase 6's
  recommendations.
- **Cloud providers are unproven end to end.** They are tested against stand-ins of their APIs; only the local model
  and Ollama's OpenAI-compatible API answered for real. The first real key should be tried with the page's Test
  button.

**AWS:** the sandbox's Terraform has `AI_KEYS_SECRET` but no GPU host; production AI needs one or a provider (above).

**From Phase 4**, unchanged ([release notes](phase-4.md#known-gaps-carried-forward)):
- resources join search in Phase 7;
- `SEARCH_PERFORMED` waits for Phase 6's `trackEvents`;
- k6 load is Phase 9's.

**From Phase 3**, still open:
- no people picker for mentions;
- repeated suspensions do not escalate on their own;
- PDFs need a connection on the phone;
- the pipelines have never run;
- feeds are read at request time.

Voice notes and quizzes came in this phase.

GraphQL schema: `contracts/graphql/schema.graphql` as of `@lvn/contracts` 0.40.0.

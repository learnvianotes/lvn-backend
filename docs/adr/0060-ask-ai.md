# ADR-0060: Ask AI — answers from the notes a person may read, with sources

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P5c)
- Spec sections: §10.1, §10.2, §11, §18 (Phase 5); ADR-0015, ADR-0042, ADR-0057, ADR-0058, ADR-0059

## Context

§10.2 describes permission-aware RAG:
1. A question has a scope: this note, my notes, my groups and classes, or public notes.
2. The candidates are `visibleNotesWhere(userId)` ∩ the scope, decided in Postgres before retrieval.
3. pgvector finds the nearest `NoteChunk`s among them (40).
4. A reranker keeps 8.
5. The model answers with citations, and the answer carries its sources.

Further requirements from §10.2:
- Chunks are built per published version: about 500 tokens with 50 of overlap.
- The visibility filter is applied in the SQL query, never after retrieval.
- A test asks 1,000 random questions and must find no leak.
- A source the asker cannot open is a bug.

Other inputs:
- **ADR-0015:** Ask AI on a workspace doubt, over the workspace's shared notes and the doubt's thread.
- **ADR-0057:** the semantic side of hybrid search is the `SEMANTIC_SEARCH` binding, waiting for this slice.
- **ADR-0042:** the live channel carries ids only.
- **ADR-0058:** the local model is `gemma4`, and `embeddinggemma` gives 768 dimensions. The ERD's 1,536 was written for
  another model.
- **The phase plan:** chunks live in `notes`, beside the read predicate, rather than in `ai` as §3's table had it.

## Decision

1. **Chunks.** `notes.NoteChunk` holds:
   - the note, the published version, its position, the card ids it covers, its text, an approximate token count, and
     the embedding model;
   - `embedding vector(768)`, with an HNSW cosine index.

   How chunks are built:
   - They come from the version's cards as plain text, in order: about 2,000 characters (≈500 tokens) with about 200
     of overlap.
   - The note's title is embedded with each chunk, but not stored in the chunk's text.
   - A new published version replaces the note's chunks.
   - Chunks go with the note: a foreign key cascades on delete, so purging trash and deleting an account remove them.
   - A change of embedding model is a migration plus re-embedding. Rows record their model, so the nightly sweep
     finds stale ones.
2. **When chunks are made.**
   - `NotePublished` queues `notes.chunks`, run by the worker one at a time.
   - A nightly sweep queues published notes whose current version has no chunks for the current model. This also
     backfills existing notes and retries after an outage.
   - Embeddings come through a new `EMBEDDINGS` facade bound to the AI gateway. It counts as the platform's work: no
     quota.
   - The data-processing flag applies as everywhere (ADR-0058).
   - With AI off, nothing is embedded and nothing fails.
3. **Who may read a chunk** is decided when it is retrieved, by the read predicate itself. When a note leaves PUBLIC,
   loses a share, is trashed or is hidden, that takes effect on the next question, with no 60-second window. A new
   `NOTE_RETRIEVAL` facade in `notes` does retrieval:
   - **Candidates:** the notes passing `visibleNotesWhere(asker)`, the scope, and the asker's blocks.
   - **Bounded scopes** (my notes, my groups and classes, a workspace): the candidates are read with the Prisma
     predicate, then the nearest chunks are searched among those ids in SQL.
   - **Public notes:** the public branch of the predicate is written into the vector query itself, as a join on
     `Note`. The leakage test (decision 9) holds it to the predicate.
   - **A final check:** the predicate is applied once more to the few notes found, before anything is returned.
   - The search uses `hnsw.iterative_scan` so that filtering does not empty the result.
4. **Asking.** `askAi(question, scope)` stores an `ai.AiAnswer` (QUEUED) after these checks: AI is on, the scope's
   right (the note is readable; the asker belongs to the workspace), and the day's allowance. The worker then runs it on
   the GPU's one lane, `ai.tasks`:
   1. It embeds the question, on the asker's allowance.
   2. It retrieves 40 chunks and reranks them.
   3. It sends the 8 best, numbered and fenced, to the versioned `ask` prompt.
   4. The text streams into `AiAnswer.text`, flushed at most every 400 ms. Each flush is announced to the asker's own
      sockets as a live `AI_ANSWER` event with the answer's id. The client refetches `aiAnswer(id)`; the content
      never travels on the live channel.
   5. When done, the answer is READY. Its sources are the ones it cites (or the first three if it cites none): note,
      title, version, cards and a snippet.

   When nothing readable matches, the answer says so and no model is called.

   **Rerank:** a blend of the vector similarity and the question's words in the chunk, at most three chunks per note.
   A cross-encoder or a model-scored reranker can replace it behind the same function.
5. **This note** is read as the asker reads it, through `NOTE_AI`: the draft for its owner and editors, the published
   version for readers. It is chunked in memory and its best 8 chunks are used, so people can ask about notes they have
   not published.
6. **Doubts.** `askAiAboutDoubt(doubtId)` asks with the doubt's title, body and answers as the question, over the
   notes shared with the workspace that the asker may read.
   - A new `DOUBTS` facade in `core` answers whether the asker may read the doubt, and with what.
   - The answer is the asker's own, shown beside the doubt. Posting it to the thread is their choice, through the
     usual answer.
7. **Hybrid search.** `SEMANTIC_SEARCH` is bound to `PgvectorSemanticSearch`:
   - It embeds the query as the platform's work and takes the nearest chunks.
   - It returns their notes best first, and an empty list with AI off.
   - Search applies the read predicate before fusing, as ADR-0057 says.
   - `SEARCH_HYBRID` stays off by default.
8. **API.**
   - Queries: `aiAnswer(id)` and `myAiAnswers(first)`.
   - Mutations: `askAi(input)`, `askAiAboutDoubt(doubtId)` and `deleteAiAnswer(id)`.
   - Types: `AiAnswer { id question scope status text sources error noteId doubtId createdAt }` and
     `AiSource { n noteId title versionId cardIds snippet }`.
   - `AskAiScope` is THIS_NOTE, MY_NOTES, MY_PLACES, PUBLIC or WORKSPACE.
   - `LiveEventKind` gains `AI_ANSWER`.
   - The data export gains `data/ai/answers.json`.
9. **Leakage test.** Learners A and B, a teacher T, a group G and a class C hold private, shared and public notes on
   one topic. Each unreadable note carries a marker. 1,000 random questions go from random askers over random scopes,
   through the real retrieval and prompt path with the stand-in model. The test asserts two things:
   - every source is a note the asker may read;
   - no unreadable note's marker ever reaches the model.

## Consequences

- RAG covers published versions; only "this note" reaches a draft. A student who never publishes their private notes
  finds nothing in "My notes". The clients say so. Embedding drafts is an owner decision for later, since drafts
  change on every keystroke.
- **Production:** the HNSW index serves the public scope until about 20 M chunks, where §16 plans partitioning.
  Bounded scopes pass their candidate ids, which stay small (a person's notes, their places' shares).
- **Rerank quality** is the weakest step. The leakage test does not depend on it, and a better reranker is a
  contained change.
- **One GPU lane** keeps answers and tasks in arrival order. A long queue shows as "Waiting its turn…".

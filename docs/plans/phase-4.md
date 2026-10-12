# Phase 4 — Search: plan

Spec §18: the Typesense provider, Cmd/K, phone search, filters, a re-index job and a hybrid ranking flag (§11).

**Exit criteria:**
- an index parity test against the Postgres provider;
- a permission filter test;
- p95 under 150 ms.

These are shown on the local environment (ADR-0036), which stands in for the sandbox until the owner sets up AWS.

Started 2026-10-13. The way of working is the same as in Phases 2 and 3:
- each slice lands backend first: the schema, any migration and an `api-changes/` note;
- then web and mobile, built against the generated types;
- it is merged to `main` in every repo it touches, then deployed to the local environment and checked there before
  the next slice starts.

Nothing is pushed until the owner says so.

## Where search stands

Phase 2 (P2e) built search on Postgres: one `search(query, scopes, first)` field over notes, people and topics.

Notes:
- They are matched on their published version: `NoteSearchDocument`, a `tsvector` with English stemming, plus
  trigram similarity on titles.
- The document is filled by the `notes.search` queue: on publish, and in full every night.
- Results are filtered by `visibleNotesWhere`, and every hit is opened as the viewer before it is returned.

People and topics:
- They are read live from their tables.
- People never include minors or anyone across a block (ADR-0043).

Clients:
- The web already has the Ctrl/⌘+K palette, with grouped results and keyboard navigation, and a `/search` page.
- The phone's Explore tab searches notes and people.

What §11 adds:
- a `SearchProvider` with a Typesense implementation;
- a permission filter on Typesense that matches the read predicate;
- re-indexing on every change that affects who may read a note;
- the remaining collections (groups, classrooms; resources wait for Phase 7);
- filters;
- recent queries on the phone;
- a hybrid ranking flag.

## A correction to the Phase 3 notes

The Phase 3 release notes and the permission-matrix test said that classroom quizzes and class performance "arrive in
Phase 4". That is wrong: §18's Phase 4 is search only.

Where they belong:
- **Classroom quizzes:** the closest phase is Phase 5, whose quiz generation is what the owner's note asks for
  ("the quiz should be AI generated from the notes and people can add easily", ADR-0025).
- **Class performance:** Phase 6, whose learning events and quiz attempts it needs.

No phase changes. The matrix test and the Phase 3 notes now name those phases.

## Slices

| Slice | What | Repos |
| --- | --- | --- |
| **P4a Typesense provider** | `SearchProvider` with the Postgres provider (the Phase 2 code) and a Typesense provider, chosen by `SEARCH_PROVIDER`. Collections `notes`, `users` and `topics`, each versioned behind an alias, created by the worker and rebuilt when their schema changes. The notes document carries the fields of the read predicate. `visibleNotesFilter` (Typesense `filter_by`) is built from the viewer's shares, groups, classes and blocks on every request. Every change to who may read a note re-indexes it, with a version check: write, re-read, write again if it moved. A lag log warns past 60 s. `reindex-all` runs in batches of 500, removes orphans and sets the alias. Both indexes are written, so Postgres answers when Typesense fails or is slow. Typesense 30.2 runs in compose and on the local environment; the sandbox's Terraform gets it with the PDF engine when AWS is set up. Tests: index parity, permission filter parity (§5), query parity, fallback, rebuild. Clients unchanged | backend |
| **P4b Search everywhere** | Scopes GROUPS (public groups, and private ones the viewer is in) and CLASSROOMS (members only). `filters`: kinds, subject, topic, author, and where a note comes from (mine, shared with me, public). More notes with a cursor. Web: the palette shows groups and classes; `/search` gains filters and "More results". Phone: Explore searches everything, with filter chips, recent queries kept on the phone, groups, classes and topics, and more results | all three |
| **P4c Ranking and speed** | The hybrid ranking flag (`SEARCH_HYBRID`): reciprocal rank fusion of keyword ranks with a semantic source. The semantic source is pgvector over the embeddings that Phase 5's `embed` job writes, so until then the flag changes nothing, and the fusion is tested on its own. Spans and a latency log for `search`. A benchmark (`pnpm search:bench`) seeds a corpus on the local environment, measures the `search` query through the entrance, and fails above a p95 of 150 ms. Tuning from what it shows | backend |
| **P4d Exit** | The leakage and matrix suites run search on both providers. End to end: live web searches with filters; Maestro `search.yaml` on the phone. p95 on the local environment. `docs/releases/phase-4.md` | all three |

## Decisions to record before the slice that needs them

| ADR | Question | Leaning |
| --- | --- | --- |
| Search on Typesense (P4a) | §11 keeps permission fields on each note document and re-indexes on membership changes. §5 wants the Typesense filter to match `visibleNotesWhere`. Typesense is a second store that can drift or go down | *ADR-0055.* Postgres stays the truth and the fallback; Typesense holds derived documents that can be rebuilt at any time. The filter is built from the viewer's live groups, classes and blocks, so membership changes need no re-index; only the note's own shares do. Every hit is still opened as the viewer, so a stale document can rank a note but never show one. A parity test holds the two predicates together. The HTTP API is called with `fetch`, without a client library |
| Search API additions (P4b) | §11 asks for a union result type; P2e shipped grouped results, which the palette shows grouped anyway | Keep the grouped `SearchResults` (no breaking change). Add the scopes, `filters` and a notes cursor |
| Hybrid ranking (P4c) | §11 says pgvector similarity, but embeddings come with Phase 5's AI gateway | The flag and the fusion are built now. The semantic source arrives with the embeddings; nothing from Phase 5 is pulled forward |

## Needed from the owner (not blocking)

Nothing for the local environment: Typesense is self-hosted, and its key is generated like every other secret.

For AWS (deferred): the sandbox's Typesense runs on ECS (§16.2) without a disk, and rebuilds from Postgres when it
starts. Production sizing waits for real numbers.

## Progress

| Slice | State | Evidence |
| --- | --- | --- |
| P4a Typesense provider | Done 2026-10-13 | ADR-0055. `SEARCH_PROVIDER`, `TYPESENSE_*`, `SEARCH_TIMEOUT_MS` (contracts 0.30.0). `notes.SearchChange` filled by seven triggers (notes, shares, group and class shares, topics) and by `UserRegistered`, the new `PersonChanged`, `RoleChanged` and `UserDeleted`; the worker drains it under an advisory lock and writes `NoteSearchDocument` and Typesense from the current state, and keeps the Postgres index moving while Typesense is unreachable (`postgresAt`). Collections `notes`, `users`, `topics` versioned behind aliases (`notes.SearchCollection`); reindex-all marks everything and removes orphans. `visibleNotesFilter`, people past the consent age (`adultFrom`, never the date of birth), topics a viewer may use. No GraphQL change. Tests: filter parity on 192 notes × 9 viewers (a broken filter fails 4 of them), the search suite on both providers (12), a Typesense suite (7: index parity through every kind of change, query parity, orphans and stale documents, a version rebuild, people and blocks, fallback and outage), the worker's drainer. Backend 680 + 3 todo (API 322 + 3 todo). Fixed: sharp 0.35.4 in the API (high advisory). Local environment: Typesense 30.2 container, collections built and aliased within a second of the worker starting; smoke 13/13, lifecycle 60/60 (a typo in a note's words finds it: Typesense answers), live 30/30. The sandbox's Terraform gets Typesense with the PDF engine when AWS is set up |
| P4b Search everywhere | | |
| P4c Ranking and speed | | |
| P4d Exit | | |

# ADR-0057: Search ranking and speed — the hybrid flag, spans, and the p95 benchmark

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend agent (P4c)
- Spec sections: §11 (hybrid ranking behind a flag), §16.5, §18 (Phase 4 exit: p95 < 150 ms); ADR-0055, ADR-0056

## Context

§11 asks for "hybrid ranking combining Typesense keyword score with pgvector similarity (reciprocal rank fusion)
behind a feature flag". §18 closes Phase 4 on a p95 under 150 ms. The embeddings that pgvector would compare are
written by Phase 5's `embed` job, through the AI gateway, which does not exist yet.

## Decision

1. **The flag.**
   - `SEARCH_HYBRID` (default `false`) turns hybrid ranking on.
   - The semantic side is a `SemanticSearch` interface, bound to the `SEMANTIC_SEARCH` token. Phase 5 binds it to
     pgvector over published versions' embeddings. Until then nothing is bound, and with the flag on, ranking is
     unchanged.
   - Nothing of Phase 5 is pulled forward: no embeddings table, no model.
2. **Fusion.**
   - Reciprocal rank fusion with k = 60 orders notes by Σ 1 / (60 + rank) over the keyword list and the semantic list;
     ties keep the keyword order.
   - It covers the first 50 keyword candidates and the first 50 semantic ones. A hybrid search pages through those 50
     and stops there.
   - Semantic candidates pass the read predicate (`visibleNotesWhere`, with the filters) before they are fused.
   - Every hit is still opened as the viewer. A note found by meaning alone shows how it begins.
3. **Seeing it work.**
   - Every search runs in an OpenTelemetry span, `search`, with these attributes:
     - `search.provider`, `search.fallback`, `search.hybrid`;
     - the kinds asked for;
     - whether filters and a cursor were used;
     - the number of each kind found.

     Never the words.
   - The histogram `lvn.search.duration` (ms) records each search with its provider.
   - A debug log line repeats the counts and the time.
4. **The benchmark.** `pnpm search:bench <url> --vm <vm.sh>` works in four steps:
   1. It seeds a corpus straight into the environment's database: a bench owner and N notes (default 10,000), with
      words from a fixed vocabulary, a mix of public, shared and private notes, and topics.
   2. It waits until the search outbox is empty.
   3. It times Q `search` requests (default 500) through the environment's entrance, from 4 clients at once. The
      requests mix anonymous and signed-in searches, one and two words, prefixes, a typo, and filters.
   4. It prints p50, p95 and p99, fails above a p95 of 150 ms, and removes the corpus.

## Consequences

- When Phase 5 writes embeddings, it binds `SEMANTIC_SEARCH` and turns the flag on in the sandbox. That makes it a
  one-line change, tested by the fusion's own tests.
- The benchmark measures the whole request (entrance, gateway, notes, Typesense, Postgres), not Typesense alone. It
  runs on demand against the local environment, and later the sandbox, not in CI.

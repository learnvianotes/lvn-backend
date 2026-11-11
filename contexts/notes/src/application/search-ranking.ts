/**
 * Hybrid ranking (§11, ADR-0057): keyword ranks and semantic ranks fused by reciprocal rank fusion (Cormack, Clarke and
 * Büttcher, 2009). The semantic side is Phase 5's: until something is bound to SEMANTIC_SEARCH, ranking is keyword only.
 */

/** RRF's k: dampens how much the very first places outweigh the rest. */
export const RRF_K = 60
/** How deep each list is fused; a hybrid search reaches at most this many notes. */
export const HYBRID_DEPTH = 50

/** Notes semantically close to a query, best first, before any read rule: the caller applies the read predicate. */
export interface SemanticSearch {
  similarNotes(text: string, limit: number, subjectId?: string | null): Promise<string[]>
}

/** Bound by Phase 5 (pgvector over published versions' embeddings); null until then. */
export const SEMANTIC_SEARCH = Symbol('SEMANTIC_SEARCH')

/** One order from several: each id scores Σ 1 / (k + rank) over the lists it is in; ties keep the first list's order. */
export function fuse(lists: string[][], k = RRF_K): string[] {
  const scores = new Map<string, { score: number; first: number }>()
  let seen = 0
  for (const list of lists) {
    list.forEach((id, rank) => {
      const entry = scores.get(id) ?? { score: 0, first: seen++ }
      entry.score += 1 / (k + rank + 1)
      scores.set(id, entry)
    })
  }
  return [...scores].sort(([, a], [, b]) => b.score - a.score || a.first - b.first).map(([id]) => id)
}

/**
 * Resources for search (ADR-0075): implemented by `core`, read by notes' search as groups are through PLACES. Only
 * approved resources are ever found; anything else is left out, and so removed from the index.
 */
export const RESOURCE_SEARCH = Symbol('RESOURCE_SEARCH')

export interface ResourceForSearch {
  id: string
  type: string
  title: string
  author: string | null
  description: string | null
  /** Its curated topics' titles */
  topics: string[]
  saveCount: number
  submittedById: string
  createdAt: Date
}

export interface ResourceSearch {
  /** The Postgres provider's search: approved resources with every word in the title, author or description, most saved first */
  find(terms: string[], hiddenSubmitterIds: string[], size: number): Promise<string[]>
  /** Search's documents for the approved resources among these ids */
  forSearch(ids: string[]): Promise<ResourceForSearch[]>
  /** Resource ids after `after`, in id order, `take` at a time: for re-indexing everything */
  idsAfter(after: string | null, take: number): Promise<string[]>
}

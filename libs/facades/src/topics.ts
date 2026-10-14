/**
 * Notes topics for other contexts (ADR-0070): exams are set on them, and Readiness finds the cards of their notes.
 * Implemented by `notes`. A topic a viewer may use is a curated one or their own proposal.
 */
export const TOPICS = Symbol('TOPICS')

export interface TopicRef {
  id: string
  /** `topic:<id>`, as learning events name it */
  key: string
  title: string
  subjectTitle: string
  /**
   * `core:<subject>/<topic>` when the topic is a /core page (curated topics came from the /core catalog): time on the
   * page counts for the topic too. Null for proposed topics and topic groups.
   */
  coreKey: string | null
  /** LVN's own topic, public to everyone; false for a person's proposal, which only they use (ADR-0074) */
  curated: boolean
}

export interface Topics {
  /** The topics among these ids that the viewer may use, in the order given */
  usable(viewerId: string, ids: string[]): Promise<TopicRef[]>
  /** Topics the viewer may use with every word of the query in their title, at most 20 */
  find(viewerId: string, query: string): Promise<TopicRef[]>
  /** Each note's topic ids, for the notes that have any */
  ofNotes(noteIds: string[]): Promise<Map<string, string[]>>
  /** Each note's subject: the subject of its first topic, for the notes that have one (ADR-0080: contributor achievements) */
  subjectsOfNotes(noteIds: string[]): Promise<Map<string, { id: string; title: string }>>
  /** A notes subject by id (ADR-0082: a contest's subject), or null */
  subject(id: string): Promise<{ id: string; title: string } | null>
}

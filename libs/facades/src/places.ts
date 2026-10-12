/**
 * Groups and classes as other contexts need them: names for messages (ADR-0050; `communication` names the class in an
 * announcement email), and what search indexes and finds (ADR-0056). Answered by `core`.
 */
export const PLACES = Symbol('PLACES')

/** A group as search holds it (ADR-0056); deleted and removed groups have none. */
export interface GroupForSearch {
  id: string
  name: string
  description: string | null
  type: 'COMMUNITY' | 'PROJECT'
  privacy: 'PUBLIC' | 'PRIVATE'
  memberCount: number
}

/** A class as search holds it; deleted classes have none. */
export interface ClassroomForSearch {
  id: string
  name: string
  description: string | null
  memberCount: number
}

export interface Places {
  classroomNames(ids: string[]): Promise<Record<string, string>>
  /** A class announcement as its email shows it: the class, the author and the plain text; null when it is gone. */
  announcement(postId: string): Promise<{ classroomId: string; classroomName: string; authorId: string; text: string } | null>
  /** Search's documents for these groups and classes (ADR-0056); gone ones are left out. */
  groupsForSearch(ids: string[]): Promise<GroupForSearch[]>
  classroomsForSearch(ids: string[]): Promise<ClassroomForSearch[]>
  /** Group or class ids after `after`, in id order, `take` at a time: for re-indexing everything. */
  placeIdsAfter(kind: 'GROUP' | 'CLASSROOM', after: string | null, take: number): Promise<string[]>
  /**
   * The Postgres provider's group search (ADR-0056): PUBLIC groups, and PRIVATE ones among `memberOf`, whose name or
   * description holds every word; most members first.
   */
  findGroups(words: string[], memberOf: string[], take: number): Promise<string[]>
  /** Classes among `memberOf` whose name or description holds every word. */
  findClassrooms(words: string[], memberOf: string[], take: number): Promise<string[]>
}

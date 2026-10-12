/**
 * Names of groups and classes for other contexts' messages (ADR-0050): `communication` names the class in an
 * announcement email. Answered by `core`.
 */
export const PLACES = Symbol('PLACES')

export interface Places {
  classroomNames(ids: string[]): Promise<Record<string, string>>
  /** A class announcement as its email shows it: the class, the author and the plain text; null when it is gone. */
  announcement(postId: string): Promise<{ classroomId: string; classroomName: string; authorId: string; text: string } | null>
}

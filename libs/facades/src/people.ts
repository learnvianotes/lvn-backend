import type { GlobalRole } from '@lvn/contracts/domain'

/**
 * People, as other contexts need them: finding the person a note is shared with, by handle or email. Answered by the
 * `users` context; nothing private (no email, no date of birth) comes back.
 */
export const PEOPLE = Symbol('PEOPLE')

export interface Person {
  id: string
  handle: string
  displayName: string
  globalRole: GlobalRole
}

export interface People {
  /** The account with this handle (with or without @) or email address, or null; deleted accounts are not found. */
  find(handleOrEmail: string): Promise<Person | null>
  /** People whose handle starts with, or whose name contains, the words — for search. Minors are never listed. */
  search(query: string, limit: number): Promise<Person[]>
}

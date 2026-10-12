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
  /**
   * People whose handle starts with, or whose name contains, the words — for search. Minors are never listed, and
   * neither is anyone the viewer blocked or who blocked the viewer (ADR-0043).
   */
  search(query: string, limit: number, viewerId?: string | null): Promise<Person[]>
  /** Everyone `userId` blocked or was blocked by (ADR-0043): their content is left out of what `userId` sees. */
  blockedIds(userId: string): Promise<string[]>
  /** Either of the two blocked the other: no new interaction between them (ADR-0016). */
  blockedBetween(a: string, b: string): Promise<boolean>
  /** The teachers `userId` is connected with (ADR-0013, ADR-0044). */
  connectionIds(userId: string): Promise<string[]>
  /** The two are connected. */
  connected(a: string, b: string): Promise<boolean>
}

import type { Actor } from '@lvn/contracts/domain'

/**
 * Authorization has one implementation (§6.1): the `users` context turns a user id into the Actor that
 * `@lvn/contracts` `can()` evaluates. Other contexts inject POLICY; they never read users' tables.
 */
export const POLICY = Symbol('POLICY')

export interface Policy {
  /** The actor for a signed-in user; null for a deleted or unknown account. */
  actor(userId: string): Promise<Actor | null>
}

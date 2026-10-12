import type { Actor } from '@lvn/contracts/domain'

/**
 * Authorization has one implementation (§6.1): the `users` context turns a user id into the Actor that
 * `@lvn/contracts` `can()` evaluates. Other contexts inject POLICY; they never read users' tables.
 */
export const POLICY = Symbol('POLICY')

export interface Policy {
  /** The actor for a signed-in user; null for a deleted or unknown account. */
  actor(userId: string): Promise<Actor | null>
  /** Suspends the account until `until` (ADR-0053): its actor is `suspended` meanwhile. Platform moderators decide. */
  suspend(userId: string, until: Date, reason: string): Promise<void>
  /** Ends a suspension early (an appeal granted, or a moderator's change of mind). */
  lift(userId: string): Promise<void>
  /** The account's suspension while it lasts, with the reason for its owner; null otherwise. */
  suspension(userId: string): Promise<{ until: Date; reason: string | null } | null>
}

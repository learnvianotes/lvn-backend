import type { LimitKey } from '@lvn/contracts/domain'

/**
 * Plan limits (ADR-0024), answered by the `users` context from Plan/Entitlement data. A context asks before creating
 * something limited and reports its own usage — users never reads other contexts' tables.
 */
export const ENTITLEMENTS = Symbol('ENTITLEMENTS')

export interface Entitlements {
  /** The user's limit for a key; null means unlimited. */
  limit(userId: string, key: LimitKey): Promise<bigint | null>
}

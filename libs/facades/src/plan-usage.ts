import type { LimitKey } from '@lvn/contracts/domain'

/**
 * How much of each plan limit a person has used, answered by the context that owns the rows.
 * `users` merges these for `myPlan` and never reads another context's tables.
 */
export interface PlanUsageSource {
  used(userId: string): Promise<Partial<Record<LimitKey, bigint>>>
}

/** Notes, storage bytes, PDF pages this month, and imports today. */
export const NOTES_PLAN_USAGE = Symbol('NOTES_PLAN_USAGE')

/** AI tokens and AI asks today. */
export const AI_PLAN_USAGE = Symbol('AI_PLAN_USAGE')

/** Groups, classes, their fullest membership, and project workspaces. */
export const CORE_PLAN_USAGE = Symbol('CORE_PLAN_USAGE')

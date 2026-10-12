// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

/** The viewer's AI tokens today (UTC) against their plan's daily limit (§10.1, ADR-0024) */
export interface AiAllowance {
  usedToday: number
  /** null: the plan sets no limit */
  limitToday: number | null
  resetsAt: Date
}

export interface AiStatus {
  available: boolean
  reason: AiUnavailableReason | null
}

/** Why AI is not answering */
export type AiUnavailableReason = 'NOT_CONFIGURED' | 'BUDGET' | 'PROVIDER_DOWN'

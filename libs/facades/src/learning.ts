import type { LearningEventType } from '@lvn/contracts/domain'

/**
 * Learning events the server records itself (ADR-0067): what it already knows a person did, such as a note created,
 * published or forked, an AI request, a search. Implemented by `core`; other contexts call it after their own work.
 */
export const LEARNING = Symbol('LEARNING')

export interface ServerLearningEvent {
  type: LearningEventType
  entityType?: string
  entityId?: string
  topicKeys?: string[]
  durationMs?: number
  metadata?: Record<string, string | number | boolean | null>
  /** When it happened; now by default */
  at?: Date
}

export interface Learning {
  /** Never throws: a lost learning event must not fail the work that caused it (it is logged). */
  record(userId: string, event: ServerLearningEvent): Promise<void>
}

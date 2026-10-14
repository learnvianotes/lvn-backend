/**
 * Weekly tasks and cooperative goals (ADR-0081): the rules, as data and pure functions.
 */

export type WeeklyTaskKindName = 'REVIEWS' | 'QUIZ_ANSWERS' | 'TOPIC_MINUTES'

export const TASK_LIMITS = {
  perWeek: 3,
  planChars: 140,
  /** The targets a person may set, by kind */
  target: { REVIEWS: { min: 5, max: 500 }, QUIZ_ANSWERS: { min: 5, max: 300 }, TOPIC_MINUTES: { min: 10, max: 600 } } satisfies Record<WeeklyTaskKindName, { min: number; max: number }>,
} as const

/** Kinds that need a topic, and kinds that may have one */
export const NEEDS_TOPIC: ReadonlySet<WeeklyTaskKindName> = new Set(['TOPIC_MINUTES'])
export const TAKES_TOPIC: ReadonlySet<WeeklyTaskKindName> = new Set(['QUIZ_ANSWERS', 'TOPIC_MINUTES'])

/** What a suggestion asks for, by kind */
export const SUGGESTED = { examTopicMinutes: 60, weakTopicAnswers: 20, reviewsCap: 200, fallbackReviews: 50 } as const

/** A class goal's target in counted days: set by staff, or sized from the class's last closed weeks (ADR-0081). */
export function classGoalTarget(input: { students: number; recentTotals: number[]; plannedDays: number; set: number | null }): number {
  const floor = Math.max(1, input.students)
  if (input.set !== null) return Math.max(1, input.set)
  if (input.recentTotals.length) return Math.max(floor, Math.round(median(input.recentTotals) * 1.1))
  return Math.max(floor, Math.round(input.plannedDays * 0.6))
}

/** The most one student's counted days add to a class goal: no one carries it, no one holds it back. */
export function shareCap(target: number, students: number): number {
  return Math.max(1, Math.ceil((1.5 * target) / Math.max(1, students)))
}

/** The pooled progress: each student's counted days, up to their share. */
export function pooled(countedDays: number[], cap: number): number {
  return countedDays.reduce((s, d) => s + Math.min(d, cap), 0)
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

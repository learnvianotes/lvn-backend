import { addDays, daysBetween } from './rhythm'

/**
 * Exams' rules (ADR-0070), pure so they can be tested: the revision plan spread back from the exam, a topic's mastery
 * and an exam's Readiness, the target line, and when a topic is weak.
 */

/** Readiness the target line reaches on the exam's day, in % */
export const READINESS_TARGET = 80
/** A topic is weak below this accuracy over its last results */
export const WEAK_ACCURACY = 0.6
/** Results a topic's accuracy is taken over */
export const RECENT_RESULTS = 3
/** Days before an exam in which an unvisited topic of it is weak, and since when a visit counts */
export const REVISIT_DAYS = 14
/** Days before an exam from which Rhythm suggests one more planned day a week */
export const SUGGEST_DAYS = 21
/** Learning or reading on a task's topics that does the task (ADR-0030's bar) */
export const TASK_SECONDS = 600

export interface PlanTopic {
  key: string
  weak: boolean
}

export interface PlannedSession {
  day: string
  topicKeys: string[]
}

/**
 * Revision sessions from `today` to the day before the exam: one per topic and two per weak topic, weak topics first,
 * spread evenly back from the exam so the last is the day before it; at most one session a day, so when there are
 * more sessions than days a session takes several topics.
 */
export function planSessions(input: { today: string; examDate: string; topics: PlanTopic[] }): PlannedSession[] {
  if (input.examDate <= input.today || !input.topics.length) return []
  const days = daysBetween(input.today, addDays(input.examDate, -1))
  const weak = input.topics.filter((t) => t.weak).map((t) => t.key)
  const rest = input.topics.filter((t) => !t.weak).map((t) => t.key)
  // The second session of a weak topic comes after every topic has had its first.
  const sessions = [...weak, ...rest, ...weak]
  const n = sessions.length
  const d = days.length
  if (n <= d) {
    // Session i on day round((i + 1) · d / n) − 1: evenly spaced, the last on the day before the exam.
    return sessions.map((key, i) => ({ day: days[Math.round(((i + 1) * d) / n) - 1]!, topicKeys: [key] }))
  }
  return days.map((day, j) => ({ day, topicKeys: [...new Set(sessions.slice(Math.floor((j * n) / d), Math.floor(((j + 1) * n) / d)))] }))
}

/** Right answers over answers in a topic's most recent results (newest first); null without results. */
export function accuracyOf(results: { answered: number; correct: number }[]): number | null {
  const recent = results.slice(0, RECENT_RESULTS)
  const answered = recent.reduce((s, r) => s + r.answered, 0)
  return answered ? recent.reduce((s, r) => s + r.correct, 0) / answered : null
}

/** 0.6 × recall + 0.4 × accuracy; a topic with only one of them takes it whole, and with neither counts 0. */
export function masteryOf(recall: number | null, accuracy: number | null): number {
  if (recall !== null && accuracy !== null) return 0.6 * recall + 0.4 * accuracy
  return recall ?? accuracy ?? 0
}

/** An exam's Readiness in whole %: the mean mastery of its topics. */
export function readinessOf(masteries: number[]): number {
  return masteries.length ? Math.round((masteries.reduce((s, m) => s + m, 0) / masteries.length) * 100) : 0
}

/** Where the target line is on `today`: from 0 on the day the exam was added to the target on its day, in whole %. */
export function targetOn(input: { added: string; examDate: string; today: string }): number {
  if (input.today >= input.examDate) return READINESS_TARGET
  const span = daysBetween(input.added, input.examDate).length - 1
  if (span <= 0) return READINESS_TARGET
  const gone = Math.max(daysBetween(input.added, input.today).length - 1, 0)
  return Math.round((READINESS_TARGET * gone) / span)
}

/** Days from `today` to the exam: 0 on its day. */
export const daysLeft = (today: string, examDate: string) => Math.max(daysBetween(today, examDate).length - 1, 0)

import { LEARNING_ACTIVITIES, LearningEventType, type TimeSpentActivity } from '@lvn/contracts/domain'

/** The hour a learning day ends (ADR-0030): a session at 01:30 belongs to the day before. */
export const DAY_ROLLOVER_HOUR = 4

const formatters = new Map<string, Intl.DateTimeFormat>()
const formatter = (timeZone: string) => {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    formatters.set(timeZone, f)
  }
  return f
}

/**
 * The learning day an instant belongs to in a time zone, as YYYY-MM-DD: the local calendar date, or the one before
 * when the local wall clock reads before 04:00. Wall-clock based, so a daylight-saving change does not move the
 * boundary.
 */
export function learningDay(at: Date, timeZone: string): string {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(at).map((p) => [p.type, p.value]))
  const date = `${parts.year}-${parts.month}-${parts.day}`
  if (Number(parts.hour) >= DAY_ROLLOVER_HOUR) return date
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export interface DayContribution {
  learningSeconds: number
  readingSeconds: number
  reviews: number
  quizAnswers: number
}

const seconds = (ms: number | null | undefined) => Math.round((ms ?? 0) / 1000)

/**
 * What one event adds to its day (ADR-0067, ADR-0030). Only learning actions add learning time: focus sessions,
 * reviews and quizzes. Time with a note or a /core topic open is reading, which history shows and Rhythm does not count.
 */
export function contributionOf(e: { type: string; durationMs: number | null; metadata: Record<string, unknown> | null }): DayContribution {
  const c: DayContribution = { learningSeconds: 0, readingSeconds: 0, reviews: 0, quizAnswers: 0 }
  switch (e.type) {
    case LearningEventType.TIME_SPENT:
      if (LEARNING_ACTIVITIES.has(e.metadata?.activity as TimeSpentActivity)) c.learningSeconds = seconds(e.durationMs)
      else c.readingSeconds = seconds(e.durationMs)
      break
    case LearningEventType.FLASHCARD_REVIEWED:
      c.reviews = 1
      c.learningSeconds = seconds(e.durationMs)
      break
    case LearningEventType.QUIZ_COMPLETED: {
      const answered = Number(e.metadata?.answered)
      c.quizAnswers = Number.isInteger(answered) ? Math.min(Math.max(answered, 0), 500) : 0
      c.learningSeconds = seconds(e.durationMs)
      break
    }
  }
  return c
}

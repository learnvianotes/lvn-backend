/**
 * Weekly contests (ADR-0082): the rules, as data and pure functions.
 */

export const CONTEST_LIMITS = {
  title: 120,
  prompt: 500,
  choice: 200,
  explanation: 1000,
  minutes: { min: 5, max: 60, default: 20 },
  questions: { min: 3, max: 30, default: 10 },
  choices: { min: 2, max: 6 },
  /** Questions a contest's pool may hold */
  pool: 200,
  /** How long a window may be */
  windowDays: 7,
} as const

/** How long past contests stay listed */
export const LISTED_DAYS = 28

export type ContestBandName = 'TOP_10' | 'TOP_25' | 'TOP_50'
export type ContestStateName = 'UPCOMING' | 'OPEN' | 'CLOSED'

export function stateOf(c: { opensAt: Date; closesAt: Date }, now: Date): ContestStateName {
  if (now < c.opensAt) return 'UPCOMING'
  return now < c.closesAt ? 'OPEN' : 'CLOSED'
}

/** India is UTC+05:30 all year: the default window is next Saturday 10:00 to Sunday 22:00 there. */
const IST_MS = 330 * 60_000
export function defaultWindow(now: Date): { opensAt: Date; closesAt: Date } {
  const ist = new Date(now.getTime() + IST_MS)
  const daysToSaturday = (6 - ist.getUTCDay() + 7) % 7 || 7
  const saturday = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysToSaturday)
  return { opensAt: new Date(saturday + 10 * 3_600_000 - IST_MS), closesAt: new Date(saturday + (24 + 22) * 3_600_000 - IST_MS) }
}

/** A Fisher–Yates shuffle with the given source of randomness. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * A person's band among a contest's finished adult attempts: by score, then by the time taken. Ties share the better
 * place. Null outside the top half.
 */
export function bandOf(mine: { score: number; seconds: number }, all: { score: number; seconds: number }[]): ContestBandName | null {
  if (!all.length) return null
  const ahead = all.filter((a) => a.score > mine.score || (a.score === mine.score && a.seconds < mine.seconds)).length
  const place = (ahead + 1) / all.length
  if (place <= 0.1) return 'TOP_10'
  if (place <= 0.25) return 'TOP_25'
  if (place <= 0.5) return 'TOP_50'
  return null
}

/**
 * Rhythm's rules (ADR-0030, ADR-0069), pure so they can be tested in any time zone: weeks run Monday to Sunday by
 * learning day (ADR-0067's 04:00 rollover), planned days are ISO weekdays (1 Monday … 7 Sunday), a planned day that ended
 * uncounted and unpaused is a miss, the day after a miss is a comeback, and a term is a half-year.
 */

export const DEFAULT_PLANNED_DAYS = [1, 2, 4, 6] as const
export const PAUSE_DAYS_PER_TERM = 14

export type RhythmDayStatus = 'COUNTED' | 'MISSED' | 'REST' | 'PAUSED' | 'TODAY' | 'AHEAD'

const DAY_MS = 86_400_000
const toDate = (day: string) => new Date(`${day}T00:00:00Z`)
const fromDate = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (day: string, n: number) => fromDate(new Date(toDate(day).getTime() + n * DAY_MS))
/** ISO weekday of a YYYY-MM-DD date: 1 Monday … 7 Sunday. */
export const weekday = (day: string) => ((toDate(day).getUTCDay() + 6) % 7) + 1
/** The Monday of the week a day is in. */
export const weekStart = (day: string) => addDays(day, 1 - weekday(day))
/** The half-year term a day is in: its first day. */
export const termStart = (day: string) => `${day.slice(0, 4)}-${Number(day.slice(5, 7)) <= 6 ? '01' : '07'}-01`

/** Days in [from, to] inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export interface Pause {
  from: string
  to: string
}
export const pausedOn = (day: string, pauses: Pause[]) => pauses.some((p) => p.from <= day && day <= p.to)

/** A planned weekday set: 3–6 distinct ISO weekdays. */
export function validPlan(days: number[]): boolean {
  const set = new Set(days)
  return set.size === days.length && set.size >= 3 && set.size <= 6 && days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
}

export interface WeekInput {
  /** The person's learning day today */
  today: string
  plannedDays: readonly number[]
  /** Learning days that counted (ADR-0030's bar) */
  counted: ReadonlySet<string>
  pauses: Pause[]
}

export interface WeekDay {
  day: string
  weekday: number
  planned: boolean
  counted: boolean
  status: RhythmDayStatus
}

export interface WeekState {
  weekStart: string
  days: WeekDay[]
  /** Planned days, less the planned days paused; never below 1 */
  target: number
  countedDays: number
  met: boolean
  pausedDays: number
  /** Counted days that came right after a miss (never miss twice) */
  comebacks: number
  /** Today follows a miss and has not counted yet */
  comebackToday: boolean
  /** Today followed a miss and counted: back on rhythm */
  cameBackToday: boolean
}

/** One week as Rhythm shows it, for the week `today` is in (or a past week, with `today` after it). */
export function weekState(input: WeekInput, start = weekStart(input.today)): WeekState {
  const days = daysBetween(start, addDays(start, 6)).map((day): WeekDay => {
    const planned = input.plannedDays.includes(weekday(day))
    const counted = input.counted.has(day)
    const paused = pausedOn(day, input.pauses)
    let status: RhythmDayStatus
    if (counted) status = 'COUNTED'
    else if (day === input.today) status = 'TODAY'
    else if (day > input.today) status = 'AHEAD'
    else if (paused) status = 'PAUSED'
    else status = planned ? 'MISSED' : 'REST'
    return { day, weekday: weekday(day), planned, counted, status }
  })
  const pausedPlanned = days.filter((d) => d.planned && pausedOn(d.day, input.pauses)).length
  const target = Math.max(input.plannedDays.length - pausedPlanned, 1)
  const countedDays = days.filter((d) => d.counted).length
  return {
    weekStart: start,
    days,
    target,
    countedDays,
    met: countedDays >= target,
    pausedDays: days.filter((d) => pausedOn(d.day, input.pauses)).length,
    comebacks: days.filter((d) => d.counted && missedBefore(d.day, input)).length,
    comebackToday: !input.counted.has(input.today) && missedBefore(input.today, input),
    cameBackToday: input.counted.has(input.today) && missedBefore(input.today, input),
  }
}

/**
 * Whether the last planned, unpaused day before `day` (looking back at most a week, past rest days) ended uncounted:
 * the day after a miss. A day counted since then ends it.
 */
export function missedBefore(day: string, input: Pick<WeekInput, 'plannedDays' | 'counted' | 'pauses'>): boolean {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(day, -i)
    if (input.counted.has(d)) return false
    if (pausedOn(d, input.pauses)) continue
    if (input.plannedDays.includes(weekday(d))) return true
  }
  return false
}

/** Pause days used in a term: days of pauses that fall inside it. */
export function pauseDaysUsed(term: string, pauses: Pause[]): number {
  const end = addDays(termStart(addDays(term, 200)), -1)
  return pauses.reduce((n, p) => {
    const from = p.from > term ? p.from : term
    const to = p.to < end ? p.to : end
    return from <= to ? n + daysBetween(from, to).length : n
  }, 0)
}

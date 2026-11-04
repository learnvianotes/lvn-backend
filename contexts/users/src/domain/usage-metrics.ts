import { Errors } from '@lvn-backend/errors'
import { K_ANONYMITY_THRESHOLD } from './terms'

/**
 * Admin usage metrics (ADR-0105): windows of whole days, buckets, and the small-group rule. Pure functions.
 *
 * Days are calendar days in ADMIN_METRICS_TIME_ZONE, India Standard Time (UTC+05:30, no daylight saving): most people
 * using LVN are in India and the owner reads the dashboard there. Change it here; every query takes it as a parameter.
 */
export const ADMIN_METRICS_TIME_ZONE = 'Asia/Kolkata'
/** A window is at most a year, including a leap year. */
export const ADMIN_METRICS_MAX_DAYS = 366
/** Without `from`, the window is the last 30 days, today included. */
export const ADMIN_METRICS_DEFAULT_DAYS = 30
/** Each API process keeps a result this long. */
export const ADMIN_METRICS_CACHE_MS = 5 * 60_000

export type MetricsInterval = 'DAY' | 'WEEK'

/** Whole days `fromDay`..`toDay` (inclusive); `from` and `to` are the midnights around them, `to` exclusive. */
export interface MetricsWindow {
  from: Date
  to: Date
  fromDay: string
  toDay: string
  timeZone: string
}

const DAY_MS = 86_400_000
const DAY = /^\d{4}-\d{2}-\d{2}$/

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    formatters.set(timeZone, f)
  }
  return f
}

function wallClock(at: Date, timeZone: string): { day: string; utcOfWallClock: number } {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(at).map((part) => [part.type, part.value]))
  const day = `${p.year}-${p.month}-${p.day}`
  return { day, utcOfWallClock: Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) }
}

/** The calendar day (YYYY-MM-DD) an instant falls on in a time zone. */
export function dayIn(at: Date, timeZone: string = ADMIN_METRICS_TIME_ZONE): string {
  return wallClock(at, timeZone).day
}

/** The instant a day starts (local midnight) in a time zone. */
export function midnightIn(day: string, timeZone: string = ADMIN_METRICS_TIME_ZONE): Date {
  const wanted = Date.parse(`${day}T00:00:00Z`)
  let guess = wanted
  // The zone's offset at the guess, then at the corrected guess, settles a daylight-saving change too.
  for (let i = 0; i < 2; i++) {
    const seen = wallClock(new Date(guess), timeZone).utcOfWallClock
    guess += wanted - seen
  }
  return new Date(guess)
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

/** The Monday on or before a day (ISO weeks). */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay() // 0 is Sunday
  return addDays(day, -((weekday + 6) % 7))
}

function parseInstant(value: Date | string, field: string): Date {
  // Schema-first DateTime arguments can arrive as the ISO string the client sent.
  const at = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(at.getTime())) throw Errors.validation('Use an ISO-8601 date-time.', [field])
  return at
}

/**
 * The days an admin asked for. `from` and `to` are any instants on the first and last day (IST); `to` defaults to now,
 * `from` to 29 days before `to`. A last day after today becomes today. VALIDATION when `from` is after `to` or the
 * window is longer than 366 days.
 */
export function metricsWindow(from?: Date | string | null, to?: Date | string | null, now: Date = new Date(), timeZone: string = ADMIN_METRICS_TIME_ZONE): MetricsWindow {
  const today = dayIn(now, timeZone)
  const asked = to == null || to === '' ? today : dayIn(parseInstant(to, 'to'), timeZone)
  const toDay = asked > today ? today : asked
  const fromDay = from == null || from === '' ? addDays(toDay, -(ADMIN_METRICS_DEFAULT_DAYS - 1)) : dayIn(parseInstant(from, 'from'), timeZone)
  if (fromDay > toDay) throw Errors.validation('The start of the window has to be on or before the end, and not after today.', ['from'])
  if (daysBetween(fromDay, toDay) + 1 > ADMIN_METRICS_MAX_DAYS) throw Errors.validation(`The window can be at most ${ADMIN_METRICS_MAX_DAYS} days.`, ['from'])
  return { from: midnightIn(fromDay, timeZone), to: midnightIn(addDays(toDay, 1), timeZone), fromDay, toDay, timeZone }
}

/** The last `days` days ending on the window's last day. They can reach before the window's first day. */
export function trailingDays(window: Pick<MetricsWindow, 'toDay'>, days: number): { fromDay: string; toDay: string } {
  return { fromDay: addDays(window.toDay, -(days - 1)), toDay: window.toDay }
}

/** The first day of each bucket. A WEEK starts on Monday; the first one starts on `fromDay` and can be shorter. */
export function bucketStarts(window: Pick<MetricsWindow, 'fromDay' | 'toDay'>, interval: MetricsInterval): string[] {
  const out: string[] = []
  if (interval === 'DAY') {
    for (let day = window.fromDay; day <= window.toDay; day = addDays(day, 1)) out.push(day)
    return out
  }
  out.push(window.fromDay)
  for (let day = addDays(mondayOf(window.fromDay), 7); day <= window.toDay; day = addDays(day, 7)) out.push(day)
  return out
}

/** The bucket a day falls in, or null outside the window. */
export function bucketOf(day: string, window: Pick<MetricsWindow, 'fromDay' | 'toDay'>, interval: MetricsInterval): string | null {
  if (!DAY.test(day) || day < window.fromDay || day > window.toDay) return null
  if (interval === 'DAY') return day
  const monday = mondayOf(day)
  return monday < window.fromDay ? window.fromDay : monday
}

/**
 * Sums per-day counts into buckets, with a zero row for every bucket that had none. Days outside the window are
 * dropped.
 */
export function rollUp<K extends string>(window: Pick<MetricsWindow, 'fromDay' | 'toDay'>, interval: MetricsInterval, keys: readonly K[], rows: Iterable<{ day: string } & Partial<Record<K, number>>>): ({ date: string } & Record<K, number>)[] {
  const buckets = new Map<string, { date: string } & Record<K, number>>()
  for (const date of bucketStarts(window, interval)) {
    const zero = { date } as { date: string } & Record<K, number>
    for (const key of keys) (zero as Record<K, number>)[key] = 0
    buckets.set(date, zero)
  }
  for (const row of rows) {
    const bucket = bucketOf(row.day, window, interval)
    if (!bucket) continue
    const into = buckets.get(bucket)!
    for (const key of keys) (into as Record<K, number>)[key] += Number(row[key] ?? 0)
  }
  return [...buckets.values()]
}

/** Who was active on which day: day → distinct account ids. */
export type ActiveDays = Map<string, Set<string>>

export function addActive(days: ActiveDays, day: string, userId: string): void {
  let set = days.get(day)
  if (!set) days.set(day, (set = new Set()))
  set.add(userId)
}

/** Distinct people per bucket. Someone active on two days of one week counts once in that week. */
export function activePerBucket(window: Pick<MetricsWindow, 'fromDay' | 'toDay'>, interval: MetricsInterval, days: ActiveDays): Map<string, number> {
  const people = new Map<string, Set<string>>(bucketStarts(window, interval).map((date) => [date, new Set<string>()]))
  for (const [day, ids] of days) {
    const bucket = bucketOf(day, window, interval)
    if (!bucket) continue
    const into = people.get(bucket)!
    for (const id of ids) into.add(id)
  }
  return new Map([...people].map(([date, ids]) => [date, ids.size]))
}

function distinctIn(days: ActiveDays, fromDay: string, toDay: string): number {
  const ids = new Set<string>()
  for (const [day, set] of days) if (day >= fromDay && day <= toDay) for (const id of set) ids.add(id)
  return ids.size
}

/**
 * DAU: people active on the window's last day. WAU and MAU: in its last 7 and 30 days (they may reach before `from`).
 * Stickiness: the average DAU over those 30 days divided by MAU, 0 to 1, three decimals; 0 when MAU is 0. Averaging
 * keeps a partly-over today from dragging it down.
 */
export function activeSummary(window: Pick<MetricsWindow, 'toDay'>, days: ActiveDays): { dau: number; wau: number; mau: number; stickiness: number } {
  const dau = days.get(window.toDay)?.size ?? 0
  const week = trailingDays(window, 7)
  const month = trailingDays(window, 30)
  const wau = distinctIn(days, week.fromDay, week.toDay)
  const mau = distinctIn(days, month.fromDay, month.toDay)
  let daily = 0
  for (let day = month.fromDay; day <= month.toDay; day = addDays(day, 1)) daily += days.get(day)?.size ?? 0
  const stickiness = mau ? Math.round((daily / 30 / mau) * 1000) / 1000 : 0
  return { dau, wau, mau, stickiness }
}

/**
 * The k-anonymity rule for breakdowns (threshold 5, as ADR-0103): a group with fewer distinct people is left out, and
 * how many were left out is returned.
 */
export function withoutSmallGroups<T extends { users: number }>(rows: readonly T[], threshold: number = K_ANONYMITY_THRESHOLD): { shown: T[]; hidden: number } {
  const shown = rows.filter((row) => row.users >= threshold)
  return { shown, hidden: rows.length - shown.length }
}

/** The middle value (the mean of the two middle ones for an even count), or null for none. */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Hours to one decimal, or null. */
export function roundHours(hours: number | null | undefined): number | null {
  return hours == null || !Number.isFinite(hours) ? null : Math.round(hours * 10) / 10
}

/** Steps adminFunnel reads from the database rather than usage events (ADR-0105). */
export const DB_FUNNEL_STEPS = ['signed_up', 'email_verified', 'first_note', 'returned_d7'] as const
export type DbFunnelStep = (typeof DB_FUNNEL_STEPS)[number]
const DB_STEPS = new Set<string>(DB_FUNNEL_STEPS)
export const isDbFunnelStep = (step: string): step is DbFunnelStep => DB_STEPS.has(step)

/** returned_d7: active again at least this long after signing up. */
export const RETURN_AFTER_MS = 7 * DAY_MS

/**
 * An ordered funnel over each person's step times: a person counts at a step when they reached every earlier step and
 * each happened no later than the next. Times are those already chosen per step (first occurrence, or the first after
 * the previous step for returned_d7).
 */
export function funnelCounts(steps: readonly string[], times: readonly Map<string, Date>[]): number[] {
  const counts = steps.map(() => 0)
  const first = times[0] ?? new Map<string, Date>()
  for (const [userId, start] of first) {
    counts[0]! += 1
    let prev = start
    for (let i = 1; i < steps.length; i++) {
      const at = times[i]?.get(userId)
      if (!at || at.getTime() < prev.getTime()) break
      counts[i]! += 1
      prev = at
    }
  }
  return counts
}

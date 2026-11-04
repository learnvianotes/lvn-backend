import type { AdminDailyCount } from '@lvn-backend/facades'
import { K_ANONYMITY_THRESHOLD } from './terms'
import { addDays, daysBetween, distinctIn, mondayOf, type ActiveDays } from './usage-metrics'

/**
 * The daily rollup behind the admin usage metrics (ADR-0106): names of the rows in users.daily_metrics, and the pure
 * arithmetic that turns rows (stored or computed now) into results. Counts only: a row never holds an account id.
 */

/** One row of users.daily_metrics, as the facades return them. */
export type MetricRow = AdminDailyCount

/** Days `fromDay`..`toDay`, inclusive. */
export interface DaySpan {
  fromDay: string
  toDay: string
}

/** The users context's own daily metrics. notes and core name theirs in libs/facades (NOTES_/CORE_DAILY_METRICS). */
export const USERS_DAILY_METRICS = {
  /** Accounts created (people: not deleted, not the study publisher). */
  signUps: 'sign_ups',
  /** The same accounts by how they signed up: `dimension` is EMAIL, GOOGLE, GITHUB or LINKEDIN. */
  signUpMethod: 'sign_up_method',
  emailsVerified: 'emails_verified',
  registrationsCompleted: 'registrations_completed',
  /** Accounts that became verified students or teachers. */
  verifications: 'verifications',
  /** Verification requests made, and decisions made, that day. */
  verificationRequests: 'verification_requests',
  verificationApproved: 'verification_approved',
  verificationRejected: 'verification_rejected',
  /** The decisions of that day by milliseconds from request to decision: `dimension` is the duration. */
  decisionMs: 'verification_decision_ms',
  /** Distinct active people (ADR-0105) that day, and over the 7 and 30 days ending that day. */
  activeUsers: 'active_users',
  activeUsers7d: 'active_users_7d',
  activeUsers30d: 'active_users_30d',
} as const

/**
 * Retention cohorts, one set per complete activity week. `day` is the activity week's Monday and `dimension` a sign-up
 * week's Monday: cohort_active counts that cohort's people active in the week, cohort_size the cohort's people at the
 * time the week was computed (so a share is always over the people it was counted among).
 */
export const COHORT_METRICS = { active: 'cohort_active', size: 'cohort_size' } as const

/** A marker row: the day's daily rows (dimension `day`), or the week's cohort rows (dimension `week`), are complete. */
export const ROLLUP_MARKER = '_rollup'
export const DAY_MARKER = 'day'
export const WEEK_MARKER = 'week'
/**
 * A second day marker for the usage-event counts (ADR-0107), which came after the first rollups: a day rolled up
 * before them has `day` but not this, and its usage counts are computed live until the day is rolled up again.
 */
export const USAGE_MARKER = 'day:usage'

/** The nightly job recomputes this many days before today unless METRICS_ROLLUP_DAYS says otherwise. */
export const ROLLUP_DEFAULT_DAYS = 3
export const ROLLUP_MAX_DAYS = 31
/** Rollup rows are counts with no personal data; they are kept two years, past what any admin query can ask for. */
export const DAILY_METRICS_RETENTION_DAYS = 730
/** Retention cohorts: at most a year of sign-up weeks, 12 when not asked. */
export const RETENTION_MAX_WEEKS = 52
export const RETENTION_DEFAULT_WEEKS = 12
/** A backfill computes this many days at a time, so a long range never holds months of activity in memory. */
export const BACKFILL_CHUNK_DAYS = 31

/** Every day of a span. */
export function daysOf(span: DaySpan): string[] {
  const out: string[] = []
  for (let day = span.fromDay; day <= span.toDay; day = addDays(day, 1)) out.push(day)
  return out
}

/** Days grouped into the fewest spans of consecutive days. */
export function contiguous(days: Iterable<string>): DaySpan[] {
  const sorted = [...new Set(days)].sort()
  const out: DaySpan[] = []
  for (const day of sorted) {
    const last = out[out.length - 1]
    if (last && addDays(last.toDay, 1) === day) last.toDay = day
    else out.push({ fromDay: day, toDay: day })
  }
  return out
}

/** A span cut into pieces of at most `size` days, in order. */
export function chunks(span: DaySpan, size: number): DaySpan[] {
  const out: DaySpan[] = []
  for (let from = span.fromDay; from <= span.toDay; from = addDays(from, size)) {
    const to = addDays(from, size - 1)
    out.push({ fromDay: from, toDay: to < span.toDay ? to : span.toDay })
  }
  return out
}

/** The Mondays of the complete weeks (Monday to Sunday) whose Sunday falls in the span. */
export function weeksEndingIn(span: DaySpan): string[] {
  const out: string[] = []
  for (const day of daysOf(span)) if (new Date(`${day}T00:00:00Z`).getUTCDay() === 0) out.push(addDays(day, -6))
  return out
}

/** Rows indexed by metric, day and dimension. */
export class MetricRows {
  private readonly values = new Map<string, number>()
  private readonly dimensions = new Map<string, Map<string, number>>()

  constructor(rows: Iterable<MetricRow>) {
    for (const row of rows) {
      const key = `${row.metric}|${row.day}|${row.dimension}`
      this.values.set(key, (this.values.get(key) ?? 0) + row.value)
      let byDimension = this.dimensions.get(row.metric)
      if (!byDimension) this.dimensions.set(row.metric, (byDimension = new Map()))
      byDimension.set(row.dimension, (byDimension.get(row.dimension) ?? 0) + row.value)
    }
  }

  get(metric: string, day: string, dimension = ''): number {
    return this.values.get(`${metric}|${day}|${dimension}`) ?? 0
  }

  /** Every day's value of a metric, summed per dimension. */
  byDimension(metric: string): Map<string, number> {
    return new Map(this.dimensions.get(metric) ?? [])
  }

  /** Per dimension, the largest value a metric had on any one day. */
  maxPerDay(metric: string): Map<string, number> {
    const out = new Map<string, number>()
    const prefix = `${metric}|`
    for (const [key, value] of this.values) {
      if (!key.startsWith(prefix)) continue
      // The key is metric|day|dimension; a day has no `|`, a dimension may.
      const dimension = key.slice(key.indexOf('|', prefix.length) + 1)
      if (value > (out.get(dimension) ?? 0)) out.set(dimension, value)
    }
    return out
  }

  /** Every day's value of a metric, all dimensions together. */
  total(metric: string): number {
    let sum = 0
    for (const value of this.dimensions.get(metric)?.values() ?? []) sum += value
    return sum
  }
}

/**
 * Per-day objects for rollUp (ADR-0105): `{ day, key: value }` with each key's metric summed over its dimensions. Days
 * without any of the metrics are left out.
 */
export function perDay<K extends string>(rows: Iterable<MetricRow>, metrics: Record<K, string>): ({ day: string } & Record<K, number>)[] {
  const keyOf = new Map<string, K[]>()
  for (const key of Object.keys(metrics) as K[]) keyOf.set(metrics[key], [...(keyOf.get(metrics[key]) ?? []), key])
  const days = new Map<string, { day: string } & Record<K, number>>()
  for (const row of rows) {
    const keys = keyOf.get(row.metric)
    if (!keys) continue
    let point = days.get(row.day)
    if (!point) {
      point = { day: row.day } as { day: string } & Record<K, number>
      for (const key of Object.keys(metrics) as K[]) (point as Record<K, number>)[key] = 0
      days.set(row.day, point)
    }
    for (const key of keys) (point as Record<K, number>)[key] += row.value
  }
  return [...days.values()]
}

/**
 * The median of a distribution kept as `dimension` = a value in milliseconds and `value` = how many had it, in hours
 * (not rounded). The mean of the two middle values for an even count, as percentile_cont(0.5). Null when empty.
 */
export function medianHoursOf(distribution: Map<string, number>): number | null {
  const points = [...distribution].map(([ms, n]) => [Number(ms), n] as const).filter(([ms, n]) => Number.isFinite(ms) && n > 0).sort((a, b) => a[0] - b[0])
  const count = points.reduce((sum, [, n]) => sum + n, 0)
  if (!count) return null
  // The values at 0-based positions lo and hi of the sorted list (equal for an odd count).
  const lo = (count - 1) >> 1
  const hi = count >> 1
  let seen = 0
  let low: number | null = null
  let high: number | null = null
  for (const [ms, n] of points) {
    if (low == null && lo < seen + n) low = ms
    if (hi < seen + n) {
      high = ms
      break
    }
    seen += n
  }
  return (low! + high!) / 2 / 3_600_000
}

/** The rollup metric that holds distinct active people over a span this long, if any. */
export function activeMetricFor(span: DaySpan): string | null {
  const length = daysBetween(span.fromDay, span.toDay) + 1
  if (length === 1) return USERS_DAILY_METRICS.activeUsers
  if (length === 7) return USERS_DAILY_METRICS.activeUsers7d
  if (length === 30) return USERS_DAILY_METRICS.activeUsers30d
  return null
}

/** Distinct active people over a span from the rollup, when its last day is rolled up and a stored metric fits it. */
export function rolledActive(span: DaySpan, rolledDays: ReadonlySet<string>, rows: MetricRows): number | null {
  const metric = activeMetricFor(span)
  if (!metric || !rolledDays.has(span.toDay)) return null
  return rows.get(metric, span.toDay)
}

/** Distinct people active on any day of a span. */
export function distinctActive(days: ActiveDays, span: DaySpan): number {
  return distinctIn(days, span.fromDay, span.toDay)
}

/**
 * Daily active-people rows for each day of `span` (one day, trailing 7 and 30 days), from activity that has to reach
 * 29 days before the span. Zeros are left out.
 */
export function activeRows(span: DaySpan, days: ActiveDays): MetricRow[] {
  const out: MetricRow[] = []
  for (const day of daysOf(span)) {
    const values: [string, number][] = [
      [USERS_DAILY_METRICS.activeUsers, days.get(day)?.size ?? 0],
      [USERS_DAILY_METRICS.activeUsers7d, distinctActive(days, { fromDay: addDays(day, -6), toDay: day })],
      [USERS_DAILY_METRICS.activeUsers30d, distinctActive(days, { fromDay: addDays(day, -29), toDay: day })],
    ]
    for (const [metric, value] of values) if (value > 0) out.push({ day, metric, dimension: '', value })
  }
  return out
}

/**
 * Cohort rows for one activity week: people active in it per sign-up week, and each cohort's size now. `signUpWeek`
 * maps each countable person to their sign-up week's Monday; people not in it (signed up before the first cohort, or
 * not countable) are left out. Zeros are left out.
 */
export function cohortRows(week: string, active: ReadonlySet<string>, signUpWeek: ReadonlyMap<string, string>, sizes: ReadonlyMap<string, number>): MetricRow[] {
  const counts = new Map<string, number>()
  for (const id of active) {
    const cohort = signUpWeek.get(id)
    if (cohort && cohort <= week) counts.set(cohort, (counts.get(cohort) ?? 0) + 1)
  }
  const out: MetricRow[] = []
  for (const [cohort, value] of counts) out.push({ day: week, metric: COHORT_METRICS.active, dimension: cohort, value })
  for (const [cohort, value] of sizes) if (cohort <= week && value > 0) out.push({ day: week, metric: COHORT_METRICS.size, dimension: cohort, value })
  return out
}

/** The first cohort a week's rollup covers: RETENTION_MAX_WEEKS sign-up weeks, ending with the week itself. */
export function oldestCohortFor(week: string): string {
  return addDays(week, -7 * (RETENTION_MAX_WEEKS - 1))
}

/** The sign-up weeks of a retention table: `weeks` Mondays, oldest first, the last one this week's. */
export function cohortStarts(today: string, weeks: number): string[] {
  const current = mondayOf(today)
  return Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)))
}

export interface RetentionCohort {
  start: string
  size: number
  returned: number[]
}

/**
 * Retention cohorts from cohort rows (stored or live): for each sign-up week, the share of its people active in each
 * week since, the sign-up week first and this week last. A share is over the cohort's size when that week was counted;
 * `size` is the latest. A cohort that was ever below the k-anonymity threshold is left out and counted in `hidden`; a
 * week nobody (countable) signed up in is not a group and is left out without being counted.
 */
export function retentionCohorts(starts: readonly string[], currentWeek: string, rows: MetricRows, threshold: number = K_ANONYMITY_THRESHOLD): { cohorts: RetentionCohort[]; hidden: number } {
  const cohorts: RetentionCohort[] = []
  let hidden = 0
  for (const start of starts) {
    const sizes: number[] = []
    const returned: number[] = []
    for (let week = start; week <= currentWeek; week = addDays(week, 7)) {
      const size = rows.get(COHORT_METRICS.size, week, start)
      sizes.push(size)
      returned.push(size ? Math.round((rows.get(COHORT_METRICS.active, week, start) / size) * 1000) / 1000 : 0)
    }
    if (sizes.every((size) => size === 0)) continue
    if (Math.min(...sizes) < threshold) {
      hidden += 1
      continue
    }
    cohorts.push({ start, size: sizes[sizes.length - 1]!, returned })
  }
  return { cohorts, hidden }
}

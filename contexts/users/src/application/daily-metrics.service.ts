import { Inject, Injectable, Logger } from '@nestjs/common'
import { CORE_ADMIN_STATS, CORE_DAILY_METRICS, NOTES_ADMIN_STATS, NOTES_DAILY_METRICS, type AdminDayWindow, type CoreAdminStats, type NotesAdminStats } from '@lvn-backend/facades'
import { Errors } from '@lvn-backend/errors'
import { Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { QUIZ_START_KINDS, USAGE_FEATURES, USAGE_SEARCH_SCOPES, UsageEventName } from '@lvn/contracts/domain'
import { APP_VERSION_PATTERN } from '@lvn/contracts/validation'
import {
  activeRows,
  BACKFILL_CHUNK_DAYS,
  chunks,
  COHORT_METRICS,
  cohortRows,
  contiguous,
  DAILY_METRICS_RETENTION_DAYS,
  DAY_MARKER,
  daysOf,
  distinctActive,
  MetricRows,
  oldestCohortFor,
  rolledActive,
  ROLLUP_DEFAULT_DAYS,
  ROLLUP_MARKER,
  ROLLUP_MAX_DAYS,
  USAGE_MARKER,
  USERS_DAILY_METRICS,
  WEEK_MARKER,
  weeksEndingIn,
  type DaySpan,
  type MetricRow,
} from '../domain/daily-metrics'
import { STUDY_PUBLISHER_ID } from '../domain/study-publisher'
import { USAGE_DAILY_METRICS, usageRows, type UsageGroup } from '../domain/usage-event-metrics'
import { addActive, addDays, ADMIN_METRICS_TIME_ZONE, dayIn, daysBetween, midnightIn, type ActiveDays } from '../domain/usage-metrics'

/**
 * Where a daily count comes from. Each is computed by its own queries; active people and cohorts are apart. `usage` is
 * the ADR-0107 usage events: feature use, quiz starts, searches and app versions.
 */
export type CountSource = 'growth' | 'verification' | 'notes' | 'core' | 'usage'

const U = USERS_DAILY_METRICS
const SOURCE_METRICS: Record<CountSource, readonly string[]> = {
  growth: [U.signUps, U.signUpMethod, U.emailsVerified, U.registrationsCompleted, U.verifications],
  verification: [U.verificationRequests, U.verificationApproved, U.verificationRejected, U.decisionMs],
  notes: Object.values(NOTES_DAILY_METRICS),
  core: Object.values(CORE_DAILY_METRICS),
  usage: Object.values(USAGE_DAILY_METRICS),
}
const ALL_SOURCES: readonly CountSource[] = ['growth', 'verification', 'notes', 'core', 'usage']
const ACTIVE_METRICS = [U.activeUsers, U.activeUsers7d, U.activeUsers30d]
const COHORT_KINDS = [COHORT_METRICS.active, COHORT_METRICS.size]

/** One rollup writer at a time across workers and backfills (a transaction-scoped advisory lock on this key). */
const WRITE_LOCK = 'users.daily_metrics'
const INSERT_BATCH = 5_000
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** People counted by their activity: not deleted, not opted out of analytics. `u` is the User alias. */
const COUNTABLE = Prisma.sql`u."deletedAt" IS NULL AND NOT u."analyticsOptOut"`
/** Accounts that are people: not deleted, not the study publisher (ADR-0098). */
const PEOPLE = Prisma.sql`u."deletedAt" IS NULL AND u.id <> ${STUDY_PUBLISHER_ID}::uuid`

export interface RollupReport {
  fromDay: string
  toDay: string
  days: number
  weeks: number
  rows: number
}

/**
 * The daily rollup behind the admin usage metrics (ADR-0106). The worker stores, for each IST day before today, the
 * counts the admin queries need in users.daily_metrics; the queries read stored days and compute the others (today
 * always) from the tables, with the same code, so a stored day and a live one give the same numbers. Counts only:
 * who was active is held in memory while counting and never stored.
 */
@Injectable()
export class DailyMetricsService {
  private readonly log = new Logger('DailyMetrics')

  constructor(
    private readonly db: PrismaService,
    @Inject(NOTES_ADMIN_STATS) private readonly notes: NotesAdminStats,
    @Inject(CORE_ADMIN_STATS) private readonly core: CoreAdminStats,
  ) {}

  // ── Reading ───────────────────────────────────────────────────────────────────────────────────────────────────

  /** Per-day counts for the days of a span: stored for the days rolled up, computed now for the rest. */
  async counts(span: DaySpan, sources: readonly CountSource[], today: string = dayIn(new Date())): Promise<MetricRow[]> {
    const stored = await this.stored(span, sources.flatMap((source) => SOURCE_METRICS[source]), today, sources.includes('usage'))
    const missing = contiguous(daysOf(span).filter((day) => !stored.days.has(day)))
    const live = await Promise.all(missing.map((piece) => this.liveCounts(piece, sources)))
    return [...stored.rows.filter((row) => row.metric !== ROLLUP_MARKER && stored.days.has(row.day)), ...live.flat()]
  }

  /**
   * Distinct active people over each span. A span of 1, 7 or 30 days ending on a day rolled up is read from the rollup;
   * every other span is counted now from the activity of its days.
   */
  async activeCounts(spans: readonly DaySpan[], today: string = dayIn(new Date())): Promise<number[]> {
    if (!spans.length) return []
    const covering = { fromDay: spans.reduce((min, s) => (s.fromDay < min ? s.fromDay : min), spans[0]!.fromDay), toDay: spans.reduce((max, s) => (s.toDay > max ? s.toDay : max), spans[0]!.toDay) }
    const stored = await this.stored(covering, ACTIVE_METRICS, today)
    const rows = new MetricRows(stored.rows)
    const out = spans.map((span) => rolledActive(span, stored.days, rows))
    const live = spans.filter((_, i) => out[i] == null)
    if (live.length) {
      const days = await this.activeDays(contiguous(live.flatMap(daysOf)))
      spans.forEach((span, i) => {
        if (out[i] == null) out[i] = distinctActive(days, span)
      })
    }
    return out as number[]
  }

  /**
   * Cohort rows for activity weeks (Mondays) and sign-up weeks from `firstCohort` on: stored for complete weeks rolled
   * up, counted now for the rest (this week always).
   */
  async cohorts(weeks: readonly string[], firstCohort: string, today: string = dayIn(new Date())): Promise<MetricRow[]> {
    if (!weeks.length) return []
    const sorted = [...weeks].sort()
    const stored = await this.stored({ fromDay: sorted[0]!, toDay: sorted[sorted.length - 1]! }, COHORT_KINDS, today)
    const rows = stored.rows.filter((row) => row.metric !== ROLLUP_MARKER && stored.weeks.has(row.day) && row.dimension >= firstCohort)
    const missing = sorted.filter((week) => !stored.weeks.has(week))
    if (missing.length) rows.push(...(await this.liveCohorts(missing, firstCohort, today)))
    return rows
  }

  /**
   * Stored rows of these metrics in a span, and which days and weeks are complete. Only days before today count as
   * rolled up, and only weeks that ended before today. With `usage`, a day also needs its USAGE_MARKER.
   */
  private async stored(span: DaySpan, metrics: readonly string[], today: string, usage = false): Promise<{ rows: MetricRow[]; days: Set<string>; weeks: Set<string> }> {
    const found = await this.db.$queryRaw<{ day: string; metric: string; dimension: string; value: bigint }[]>`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, metric, dimension, value
      FROM "users"."daily_metrics"
      WHERE day >= ${span.fromDay}::date AND day <= ${span.toDay}::date AND (metric = ANY(${[...metrics]}::text[]) OR metric = ${ROLLUP_MARKER})`
    const rows = found.map((row) => ({ day: row.day, metric: row.metric, dimension: row.dimension, value: Number(row.value) }))
    const days = new Set<string>()
    const weeks = new Set<string>()
    const usageDays = new Set<string>()
    for (const row of rows) {
      if (row.metric !== ROLLUP_MARKER) continue
      if (row.dimension === DAY_MARKER && row.day < today) days.add(row.day)
      if (row.dimension === USAGE_MARKER) usageDays.add(row.day)
      if (row.dimension === WEEK_MARKER && addDays(row.day, 6) < today) weeks.add(row.day)
    }
    if (usage) for (const day of days) if (!usageDays.has(day)) days.delete(day)
    return { rows, days, weeks }
  }

  // ── Counting now ──────────────────────────────────────────────────────────────────────────────────────────────

  /** Per-day counts for the days of a span, from the tables now. */
  async liveCounts(span: DaySpan, sources: readonly CountSource[]): Promise<MetricRow[]> {
    const w = windowOf(span)
    const parts = await Promise.all(
      sources.map((source) => {
        if (source === 'growth') return this.growthCounts(w)
        if (source === 'verification') return this.verificationCounts(w)
        if (source === 'notes') return this.notes.dailyCounts(w)
        if (source === 'usage') return this.usageGroups(w, true).then(usageRows)
        return this.core.dailyCounts(w)
      }),
    )
    return parts.flat()
  }

  /**
   * Who was active on each day of these spans (ADR-0105): a session started or refreshed, a usage event, or a learning
   * day with events. Opted-out and deleted accounts are left out. Held in memory only.
   */
  async activeDays(spans: readonly DaySpan[]): Promise<ActiveDays> {
    const parts = await Promise.all(
      spans.map(async (span) => {
        const w = windowOf(span)
        const [own, learners] = await Promise.all([
          this.db.$queryRaw<{ day: string; userId: string }[]>`
            SELECT DISTINCT a.day, a."userId"::text AS "userId"
            FROM (
              SELECT to_char(e."occurredAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD') AS day, e."userId"
              FROM "users"."usage_events" e WHERE e."occurredAt" >= ${w.from} AND e."occurredAt" < ${w.to}
              UNION ALL
              SELECT to_char(s."createdAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD'), s."userId"
              FROM "users"."Session" s WHERE s."createdAt" >= ${w.from} AND s."createdAt" < ${w.to}
            ) a
            JOIN "users"."User" u ON u.id = a."userId"
            WHERE ${COUNTABLE}`,
          this.core.learnerDays(span.fromDay, span.toDay),
        ])
        return { own, learners }
      }),
    )
    const countable = await this.countable([...new Set(parts.flatMap((part) => part.learners.flatMap((row) => row.userIds)))])
    const days: ActiveDays = new Map()
    for (const { own, learners } of parts) {
      for (const row of own) addActive(days, row.day, row.userId)
      for (const row of learners) for (const id of row.userIds) if (countable.has(id)) addActive(days, row.day, id)
    }
    return days
  }

  /**
   * Cohort rows for activity weeks, counted now: per sign-up week from max(`firstCohort`, the week's oldest cohort),
   * the people active in the week (up to today) and the cohort's size now. Countable people only.
   */
  async liveCohorts(weeks: readonly string[], firstCohort: string, today: string): Promise<MetricRow[]> {
    if (!weeks.length) return []
    const spans = weeks.map((week) => ({ week, span: { fromDay: week, toDay: addDays(week, 6) < today ? addDays(week, 6) : today } }))
    const days = await this.activeDays(contiguous(spans.flatMap(({ span }) => (span.fromDay <= span.toDay ? daysOf(span) : []))))
    const oldest = weeks.reduce((min, week) => {
      const first = firstCohort > oldestCohortFor(week) ? firstCohort : oldestCohortFor(week)
      return first < min ? first : min
    }, '9999-12-31')
    const latest = weeks.reduce((max, week) => (week > max ? week : max), weeks[0]!)
    const from = midnightIn(oldest)
    const to = midnightIn(addDays(latest, 7))
    const ids = [...new Set([...days.values()].flatMap((set) => [...set]))]
    const week = Prisma.sql`to_char(date_trunc('week', u."createdAt" AT TIME ZONE ${ADMIN_METRICS_TIME_ZONE}), 'YYYY-MM-DD')`
    const [people, sizes] = await Promise.all([
      ids.length
        ? this.db.$queryRaw<{ id: string; week: string }[]>`
            SELECT u.id::text AS id, ${week} AS week FROM "users"."User" u
            WHERE u.id = ANY(${ids}::uuid[]) AND ${PEOPLE} AND ${COUNTABLE} AND u."createdAt" >= ${from} AND u."createdAt" < ${to}`
        : Promise.resolve([]),
      this.db.$queryRaw<{ week: string; people: number }[]>`
        SELECT ${week} AS week, count(*)::int AS people FROM "users"."User" u
        WHERE ${PEOPLE} AND ${COUNTABLE} AND u."createdAt" >= ${from} AND u."createdAt" < ${to}
        GROUP BY 1`,
    ])
    const signUpWeek = new Map(people.map((p) => [p.id, p.week]))
    const out: MetricRow[] = []
    for (const { week: activity, span } of spans) {
      const first = firstCohort > oldestCohortFor(activity) ? firstCohort : oldestCohortFor(activity)
      const active = new Set<string>()
      for (const [day, set] of days) if (day >= span.fromDay && day <= span.toDay) for (const id of set) active.add(id)
      const inRange = new Map([...signUpWeek].filter(([, cohort]) => cohort >= first))
      const cohortSizes = new Map(sizes.filter((s) => s.week >= first).map((s) => [s.week, s.people]))
      out.push(...cohortRows(activity, active, inRange, cohortSizes))
    }
    return out
  }

  private async growthCounts(w: AdminDayWindow): Promise<MetricRow[]> {
    const day = (column: Prisma.Sql) => Prisma.sql`to_char(${column} AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD')`
    const [counts, methods] = await Promise.all([
      this.db.$queryRaw<{ day: string; metric: string; value: number }[]>`
        SELECT day, metric, count(*)::int AS value FROM (
          SELECT ${day(Prisma.sql`u."createdAt"`)} AS day, ${U.signUps}::text AS metric
          FROM "users"."User" u WHERE u."createdAt" >= ${w.from} AND u."createdAt" < ${w.to} AND ${PEOPLE}
          UNION ALL
          SELECT ${day(Prisma.sql`u."emailVerifiedAt"`)}, ${U.emailsVerified}::text
          FROM "users"."User" u WHERE u."emailVerifiedAt" >= ${w.from} AND u."emailVerifiedAt" < ${w.to} AND ${PEOPLE}
          UNION ALL
          SELECT ${day(Prisma.sql`u."registrationCompletedAt"`)}, ${U.registrationsCompleted}::text
          FROM "users"."User" u WHERE u."registrationCompletedAt" >= ${w.from} AND u."registrationCompletedAt" < ${w.to} AND ${PEOPLE}
          UNION ALL
          SELECT ${day(Prisma.sql`u."verifiedAt"`)}, ${U.verifications}::text
          FROM "users"."User" u WHERE u."verifiedAt" >= ${w.from} AND u."verifiedAt" < ${w.to} AND ${PEOPLE}
        ) x
        GROUP BY 1, 2`,
      // The provider linked in the sign-up transaction (ADR-0100); a provider linked later is not how they signed up.
      this.db.$queryRaw<{ day: string; method: string; users: number }[]>`
        SELECT ${day(Prisma.sql`u."createdAt"`)} AS day, coalesce(m.provider::text, 'EMAIL') AS method, count(*)::int AS users
        FROM "users"."User" u
        LEFT JOIN LATERAL (
          SELECT o.provider FROM "users"."OAuthAccount" o
          WHERE o."userId" = u.id AND o."createdAt" <= u."createdAt" + interval '1 minute'
          ORDER BY o."createdAt", o.id LIMIT 1
        ) m ON true
        WHERE u."createdAt" >= ${w.from} AND u."createdAt" < ${w.to} AND ${PEOPLE}
        GROUP BY 1, 2`,
    ])
    return [
      ...counts.map((row) => ({ day: row.day, metric: row.metric, dimension: '', value: row.value })),
      ...methods.map((row) => ({ day: row.day, metric: U.signUpMethod, dimension: row.method, value: row.users })),
    ]
  }

  private async verificationCounts(w: AdminDayWindow): Promise<MetricRow[]> {
    const day = (column: Prisma.Sql) => Prisma.sql`to_char(${column} AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD')`
    const decided = Prisma.sql`status IN ('APPROVED', 'REJECTED') AND "decidedAt" >= ${w.from} AND "decidedAt" < ${w.to}`
    const [counts, durations] = await Promise.all([
      this.db.$queryRaw<{ day: string; metric: string; value: number }[]>`
        SELECT day, metric, count(*)::int AS value FROM (
          SELECT ${day(Prisma.sql`"createdAt"`)} AS day, ${U.verificationRequests}::text AS metric
          FROM "users"."VerificationRequest" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to}
          UNION ALL
          SELECT ${day(Prisma.sql`"decidedAt"`)}, CASE WHEN status = 'APPROVED' THEN ${U.verificationApproved}::text ELSE ${U.verificationRejected}::text END
          FROM "users"."VerificationRequest" WHERE ${decided}
        ) x
        GROUP BY 1, 2`,
      // To the millisecond, so the median over any days is the median over the requests themselves.
      this.db.$queryRaw<{ day: string; ms: string; decisions: number }[]>`
        SELECT ${day(Prisma.sql`"decidedAt"`)} AS day, round(extract(epoch FROM "decidedAt" - "createdAt") * 1000)::bigint::text AS ms, count(*)::int AS decisions
        FROM "users"."VerificationRequest" WHERE ${decided}
        GROUP BY 1, 2`,
    ])
    return [
      ...counts.map((row) => ({ day: row.day, metric: row.metric, dimension: '', value: row.value })),
      ...durations.map((row) => ({ day: row.day, metric: U.decisionMs, dimension: row.ms, value: row.decisions })),
    ]
  }

  /**
   * Usage events (ADR-0107) grouped by breakdown: feature, quiz kind, search scope (with and without results), app
   * version per platform, and platform. Per IST day, or over the whole window (`day` '') when `perDay` is false. Events
   * of opted-out and deleted accounts are left out. Only known ids count: a scope that is not one is ''
   * (none sent), and an app version that does not match APP_VERSION_PATTERN (from before it was checked) is ''.
   */
  async usageGroups(w: AdminDayWindow, perDay: boolean): Promise<UsageGroup[]> {
    const day = perDay ? Prisma.sql`to_char(e."occurredAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD')` : Prisma.sql`''`
    const scope = Prisma.sql`CASE WHEN props->>'scope' = ANY(${[...USAGE_SEARCH_SCOPES]}::text[]) THEN props->>'scope' ELSE '' END`
    const rows = await this.db.$queryRaw<{ day: string; kind: UsageGroup['kind']; dimension: string; events: number; users: number }[]>`
      WITH ev AS (
        SELECT ${day} AS day, e."userId", e.name, e.props, e.platform::text AS platform,
               CASE WHEN e."appVersion" ~ ${APP_VERSION_PATTERN.source} THEN e."appVersion" ELSE '' END AS version
        FROM "users"."usage_events" e
        JOIN "users"."User" u ON u.id = e."userId"
        WHERE e."occurredAt" >= ${w.from} AND e."occurredAt" < ${w.to} AND ${COUNTABLE}
      ), g AS (
        SELECT day, "userId", 'feature' AS kind, props->>'feature' AS dimension FROM ev
        WHERE name = ${UsageEventName.FEATURE_USE} AND props->>'feature' = ANY(${[...USAGE_FEATURES]}::text[])
        UNION ALL
        SELECT day, "userId", 'quiz', props->>'kind' FROM ev
        WHERE name = ${UsageEventName.QUIZ_START} AND props->>'kind' = ANY(${[...QUIZ_START_KINDS]}::text[])
        UNION ALL
        SELECT day, "userId", CASE WHEN name = ${UsageEventName.SEARCH} THEN 'search' ELSE 'no_results' END, ${scope} FROM ev
        WHERE name IN (${UsageEventName.SEARCH}, ${UsageEventName.SEARCH_NO_RESULTS})
        UNION ALL
        SELECT day, "userId", 'version', platform || '|' || version FROM ev
        UNION ALL
        SELECT day, "userId", 'platform', platform FROM ev
      )
      SELECT day, kind, dimension, count(*)::int AS events, count(DISTINCT "userId")::int AS users FROM g GROUP BY 1, 2, 3
      UNION ALL
      SELECT day, 'search_any', dimension, count(*)::int, count(DISTINCT "userId")::int FROM g WHERE kind IN ('search', 'no_results') GROUP BY 1, 3`
    return rows.map((row) => ({ day: row.day, kind: row.kind, dimension: row.dimension, events: Number(row.events), users: Number(row.users) }))
  }

  /** The ids among these that may be counted by their activity. */
  private async countable(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set()
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      SELECT u.id::text AS id FROM "users"."User" u WHERE u.id = ANY(${ids}::uuid[]) AND ${COUNTABLE}`
    return new Set(rows.map((row) => row.id))
  }

  // ── Writing ───────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Computes and stores the rollup for the days of a span (all before today) and the cohorts of each complete week
   * whose Sunday is in it. Idempotent: each day's and week's rows are upserted, and rows of those days and weeks that
   * the computation no longer has are deleted, in one transaction under an advisory lock.
   */
  async rollUp(span: DaySpan, now: Date = new Date()): Promise<RollupReport> {
    const today = dayIn(now)
    assertSpan(span, today)
    const weeks = weeksEndingIn(span)
    const [counts, active, cohorts] = await Promise.all([
      this.liveCounts(span, ALL_SOURCES),
      this.activeDays([{ fromDay: addDays(span.fromDay, -29), toDay: span.toDay }]).then((days) => activeRows(span, days)),
      weeks.length ? this.liveCohorts(weeks, oldestCohortFor(weeks[0]!), today) : Promise.resolve([]),
    ])
    const days = daysOf(span)
    const rows: MetricRow[] = [
      ...counts.filter((row) => row.value !== 0),
      ...active,
      ...cohorts,
      ...days.flatMap((day) => [DAY_MARKER, USAGE_MARKER].map((dimension) => ({ day, metric: ROLLUP_MARKER, dimension, value: 1 }))),
      ...weeks.map((day) => ({ day, metric: ROLLUP_MARKER, dimension: WEEK_MARKER, value: 1 })),
    ]
    await this.write(days, weeks, rows)
    return { fromDay: span.fromDay, toDay: span.toDay, days: days.length, weeks: weeks.length, rows: rows.length }
  }

  /** The nightly job: the `days` days before today (IST), today never. */
  async rollUpRecent(days: number = ROLLUP_DEFAULT_DAYS, now: Date = new Date()): Promise<RollupReport> {
    if (!Number.isInteger(days) || days < 1 || days > ROLLUP_MAX_DAYS) throw Errors.validation(`Roll up 1 to ${ROLLUP_MAX_DAYS} days.`, ['days'])
    const today = dayIn(now)
    return this.rollUp({ fromDay: addDays(today, -days), toDay: addDays(today, -1) }, now)
  }

  /**
   * Rolls up a range of past days (YYYY-MM-DD, inclusive), BACKFILL_CHUNK_DAYS at a time, oldest first. The range ends
   * before today and starts at most DAILY_METRICS_RETENTION_DAYS ago. Re-running it rewrites the same rows.
   */
  async backfill(fromDay: string, toDay: string, now: Date = new Date(), onChunk?: (report: RollupReport) => void): Promise<RollupReport> {
    const today = dayIn(now)
    const span = { fromDay, toDay }
    assertSpan(span, today)
    if (daysBetween(fromDay, today) > DAILY_METRICS_RETENTION_DAYS) throw Errors.validation(`Backfill at most ${DAILY_METRICS_RETENTION_DAYS} days back; older rows would be purged.`, ['from'])
    const total: RollupReport = { fromDay, toDay, days: 0, weeks: 0, rows: 0 }
    for (const piece of chunks(span, BACKFILL_CHUNK_DAYS)) {
      const report = await this.rollUp(piece, now)
      onChunk?.(report)
      total.days += report.days
      total.weeks += report.weeks
      total.rows += report.rows
    }
    return total
  }

  /** Rollup rows older than DAILY_METRICS_RETENTION_DAYS (ADR-0106). */
  async purge(now: Date = new Date()): Promise<number> {
    const before = addDays(dayIn(now), -DAILY_METRICS_RETENTION_DAYS)
    return this.db.$executeRaw`DELETE FROM "users"."daily_metrics" WHERE day < ${before}::date`
  }

  private async write(days: string[], weeks: string[], rows: MetricRow[]): Promise<void> {
    const runAt = new Date()
    const weekly = Prisma.sql`(metric = ANY(${COHORT_KINDS}::text[]) OR (metric = ${ROLLUP_MARKER} AND dimension = ${WEEK_MARKER}))`
    await this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${WRITE_LOCK}))`
        for (let i = 0; i < rows.length; i += INSERT_BATCH) {
          const batch = rows.slice(i, i + INSERT_BATCH)
          await tx.$executeRaw`
            INSERT INTO "users"."daily_metrics" (day, metric, dimension, value, "computedAt")
            SELECT r.day, r.metric, r.dimension, r.value, ${runAt}
            FROM unnest(${batch.map((r) => r.day)}::date[], ${batch.map((r) => r.metric)}::text[], ${batch.map((r) => r.dimension)}::text[], ${batch.map((r) => String(r.value))}::bigint[]) AS r(day, metric, dimension, value)
            ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value, "computedAt" = EXCLUDED."computedAt"`
        }
        // What this run no longer has: a deleted doubt's duration, a visibility nobody has now, a count gone to zero.
        await tx.$executeRaw`DELETE FROM "users"."daily_metrics" WHERE day = ANY(${days}::date[]) AND NOT ${weekly} AND "computedAt" <> ${runAt}`
        if (weeks.length) await tx.$executeRaw`DELETE FROM "users"."daily_metrics" WHERE day = ANY(${weeks}::date[]) AND ${weekly} AND "computedAt" <> ${runAt}`
      },
      { maxWait: 30_000, timeout: 120_000 },
    )
    this.log.log(`rolled up ${days.length} days and ${weeks.length} weeks: ${rows.length} rows`)
  }
}

/** The whole IST days of a span as a window. */
export function windowOf(span: DaySpan): AdminDayWindow {
  return { from: midnightIn(span.fromDay), to: midnightIn(addDays(span.toDay, 1)), fromDay: span.fromDay, toDay: span.toDay, timeZone: ADMIN_METRICS_TIME_ZONE }
}

function assertSpan(span: DaySpan, today: string): void {
  for (const [field, day] of [['from', span.fromDay], ['to', span.toDay]] as const) {
    if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw Errors.validation('Use a YYYY-MM-DD day.', [field])
  }
  if (span.fromDay > span.toDay) throw Errors.validation('The first day has to be on or before the last.', ['from'])
  if (span.toDay >= today) throw Errors.validation(`Only days before today (${today}, IST) are rolled up; today is always counted live.`, ['to'])
}

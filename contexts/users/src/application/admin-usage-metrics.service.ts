import { Inject, Injectable } from '@nestjs/common'
import { CORE_ADMIN_STATS, CORE_DAILY_METRICS, NOTES_ADMIN_STATS, NOTES_DAILY_METRICS, type CoreAdminStats, type NotesAdminStats, type SubjectActivity } from '@lvn-backend/facades'
import { Errors } from '@lvn-backend/errors'
import { Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { STUDY_PUBLISHER_ID } from '../domain/study-publisher'
import {
  addDays,
  ADMIN_METRICS_CACHE_MS,
  ADMIN_METRICS_TIME_ZONE,
  bucketStarts,
  dayIn,
  DB_FUNNEL_STEPS,
  funnelCounts,
  isDbFunnelStep,
  metricsWindow,
  midnightIn,
  mondayOf,
  RETURN_AFTER_MS,
  rollUp,
  roundHours,
  trailingDays,
  withoutSmallGroups,
  type MetricsInterval,
  type MetricsWindow,
} from '../domain/usage-metrics'
import { cohortStarts, medianHoursOf, MetricRows, perDay, RETENTION_DEFAULT_WEEKS, RETENTION_MAX_WEEKS, retentionCohorts, USERS_DAILY_METRICS, type DaySpan } from '../domain/daily-metrics'
import { isUsageEventName, USAGE_EVENT_NAMES } from '../domain/usage-events'
import { summarizeFeatureUsage, summarizeSearchQuality, summarizeVersionAdoption, windowUsersOf, type WindowUsers } from '../domain/usage-event-metrics'
import type {
  AdminContentStats,
  AdminEngagement,
  AdminFeatureUsage,
  AdminGrowth,
  AdminMetricsRange,
  AdminRetention,
  AdminSearchQuality,
  AdminVersionAdoption,
  ClientPlatform,
  QuizStartKind,
  UsageFeature,
  UsageSearchScope,
  AdminSubjectMetric,
  AdminTopSubjects,
  AdminVerificationMethod,
  AdminVerificationStats,
  CohortInterval,
  SignUpMethod,
} from '../graphql/schema.types'
import { DailyMetricsService } from './daily-metrics.service'
import { PolicyService } from './policy.service'

const DAY_MS = 86_400_000
const MAX_CACHED = 200
const MAX_SUBJECTS = 50
const U = USERS_DAILY_METRICS
const N = NOTES_DAILY_METRICS
const C = CORE_DAILY_METRICS

type Window = MetricsWindow

/** People counted by their activity: not deleted, not opted out of analytics. `u` is the User alias. */
const COUNTABLE = Prisma.sql`u."deletedAt" IS NULL AND NOT u."analyticsOptOut"`

/**
 * Usage metrics for the admin dashboard (ADR-0105), from tables the product already keeps. Platform admins only.
 * Aggregates only, and a breakdown group with fewer than 5 distinct people is left out. Each API process keeps a result
 * for about 5 minutes; the key is the query, its days and its options, so refreshing the same view reuses it.
 * `notes` and `core` count their own tables through their facades.
 *
 * Past days come from the nightly rollup (ADR-0106) when it has them; today, and any day it lacks, are counted from
 * the tables with the same code. What a day cannot hold stays live: distinct people over several days that include
 * one not rolled up, distinct people per breakdown group over the window (the small-group rule needs the exact
 * number), the verification queue now, uploads and top subjects.
 */
@Injectable()
export class AdminUsageMetricsService {
  private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>()

  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly daily: DailyMetricsService,
    @Inject(NOTES_ADMIN_STATS) private readonly notes: NotesAdminStats,
    @Inject(CORE_ADMIN_STATS) private readonly core: CoreAdminStats,
  ) {}

  async growth(adminId: string, from?: Date | string | null, to?: Date | string | null, interval?: MetricsInterval | null): Promise<AdminGrowth> {
    await this.assertAdmin(adminId)
    const window = metricsWindow(from, to)
    const iv = interval ?? 'DAY'
    return this.cached(`growth:${iv}:${window.fromDay}:${window.toDay}`, () => this.computeGrowth(window, iv))
  }

  async engagement(adminId: string, from?: Date | string | null, to?: Date | string | null, interval?: MetricsInterval | null): Promise<AdminEngagement> {
    await this.assertAdmin(adminId)
    const window = metricsWindow(from, to)
    const iv = interval ?? 'DAY'
    return this.cached(`engagement:${iv}:${window.fromDay}:${window.toDay}`, () => this.computeEngagement(window, iv))
  }

  async content(adminId: string, from?: Date | string | null, to?: Date | string | null): Promise<AdminContentStats> {
    await this.assertAdmin(adminId)
    const window = metricsWindow(from, to)
    return this.cached(`content:${window.fromDay}:${window.toDay}`, () => this.computeContent(window))
  }

  async topSubjects(adminId: string, from: Date | string | null | undefined, to: Date | string | null | undefined, by: AdminSubjectMetric, first?: number | null): Promise<AdminTopSubjects> {
    await this.assertAdmin(adminId)
    if (first != null && (!Number.isInteger(first) || first < 1 || first > MAX_SUBJECTS)) throw Errors.validation(`first is 1 to ${MAX_SUBJECTS}.`, ['first'])
    const window = metricsWindow(from, to)
    const n = first ?? 10
    return this.cached(`subjects:${by}:${n}:${window.fromDay}:${window.toDay}`, () => this.computeTopSubjects(window, by, n))
  }

  async verification(adminId: string, from?: Date | string | null, to?: Date | string | null): Promise<AdminVerificationStats> {
    await this.assertAdmin(adminId)
    const window = metricsWindow(from, to)
    return this.cached(`verification:${window.fromDay}:${window.toDay}`, () => this.computeVerification(window))
  }

  /**
   * Weekly retention cohorts (ADR-0106): the people who signed up each IST week (Monday to Sunday), the last `weeks`
   * weeks including this one, and the share of them active in each week since. Small cohorts are left out.
   */
  async retention(adminId: string, cohortInterval?: CohortInterval | null, weeks?: number | null): Promise<AdminRetention> {
    await this.assertAdmin(adminId)
    if (cohortInterval != null && cohortInterval !== 'WEEK') throw Errors.validation('Cohorts are weekly.', ['cohortInterval'])
    if (weeks != null && (!Number.isInteger(weeks) || weeks < 1 || weeks > RETENTION_MAX_WEEKS)) throw Errors.validation(`weeks is 1 to ${RETENTION_MAX_WEEKS}.`, ['weeks'])
    const n = weeks ?? RETENTION_DEFAULT_WEEKS
    const today = dayIn(new Date())
    return this.cached(`retention:${n}:${today}`, () => this.computeRetention(today, n))
  }

  /**
   * Feature use and quiz starts from the ADR-0107 usage events: per feature and quiz kind, distinct people and events.
   * Groups under the k-anonymity threshold are left out and counted.
   */
  async featureUsage(adminId: string, from?: Date | string | null, to?: Date | string | null): Promise<AdminFeatureUsage> {
    await this.assertAdmin(adminId)
    const window = metricsWindow(from, to)
    const usage = await this.usageEvents(window)
    return { range: range(window), generatedAt: usage.generatedAt, ...summarizeFeatureUsage<UsageFeature, QuizStartKind>(usage.rows, usage.users) }
  }

  /** Searches and zero-result searches in all and per scope (ADR-0107). Small scopes are left out and counted. */
  async searchQuality(adminId: string, from?: Date | string | null, to?: Date | string | null): Promise<AdminSearchQuality> {
    await this.assertAdmin(adminId)
    const window = metricsWindow(from, to)
    const usage = await this.usageEvents(window)
    return { range: range(window), generatedAt: usage.generatedAt, ...summarizeSearchQuality<UsageSearchScope>(usage.rows, usage.users) }
  }

  /** Distinct people per platform and app version (ADR-0107). Small platforms and versions are left out and counted. */
  async versionAdoption(adminId: string, from?: Date | string | null, to?: Date | string | null): Promise<AdminVersionAdoption> {
    await this.assertAdmin(adminId)
    const window = metricsWindow(from, to)
    const usage = await this.usageEvents(window)
    return { range: range(window), generatedAt: usage.generatedAt, ...summarizeVersionAdoption<ClientPlatform>(usage.rows, usage.users) }
  }

  /**
   * Ordered funnel over usage events and database steps (ADR-0105). Each step's time is its first occurrence since
   * `since`; returned_d7 is the first activity at least 7 days after sign-up and not before the previous step. Only
   * people who reached every earlier step are looked up for the next one.
   */
  async funnel(adminId: string, steps: string[], since?: Date | string | null): Promise<{ name: string; users: number }[]> {
    await this.assertAdmin(adminId)
    if (steps.length < 1 || steps.length > 5) throw Errors.validation('A funnel has 1 to 5 steps.', ['steps'])
    if (new Set(steps).size !== steps.length) throw Errors.validation('Use each step once.', ['steps'])
    if (steps.some((step) => !isUsageEventName(step) && !isDbFunnelStep(step))) throw Errors.validation(`Steps must be one of: ${[...USAGE_EVENT_NAMES, ...DB_FUNNEL_STEPS].join(', ')}.`, ['steps'])
    const from = since == null || since === '' ? new Date(Date.now() - 30 * DAY_MS) : new Date(since)
    if (Number.isNaN(from.getTime())) throw Errors.validation('Use an ISO-8601 date-time.', ['since'])
    const times: Map<string, Date>[] = []
    // People who reached every step so far, in order, with the time of the latest. Null before the first step.
    let reached: Map<string, Date> | null = null
    for (const step of steps) {
      const at = reached && !reached.size ? new Map<string, Date>() : await this.stepTimes(step, from, reached)
      times.push(at)
      const next = new Map<string, Date>()
      for (const [userId, time] of at) {
        const prev: Date | undefined = reached?.get(userId)
        if (reached && (!prev || time.getTime() < prev.getTime())) continue
        next.set(userId, time)
      }
      reached = next
    }
    const counts = funnelCounts(steps, times)
    return steps.map((name, i) => ({ name, users: counts[i]! }))
  }

  private async computeGrowth(w: Window, interval: MetricsInterval): Promise<AdminGrowth> {
    const rows = await this.daily.counts(w, ['growth'], dayIn(new Date()))
    const keys = ['signUps', 'emailVerified', 'registrationsCompleted', 'verifications'] as const
    const series = rollUp(w, interval, keys, perDay(rows, { signUps: U.signUps, emailVerified: U.emailsVerified, registrationsCompleted: U.registrationsCompleted, verifications: U.verifications }))
    const totals = { signUps: 0, emailVerified: 0, registrationsCompleted: 0, verifications: 0 }
    for (const point of series) for (const key of keys) totals[key] += point[key]
    // An account is created on one day, so the accounts per method in the window are the sum of its days.
    const methods = [...new MetricRows(rows).byDimension(U.signUpMethod)].map(([method, users]) => ({ method: method as SignUpMethod, users }))
    const { shown, hidden } = withoutSmallGroups(methods)
    return {
      range: range(w),
      interval,
      generatedAt: new Date(),
      totals,
      series,
      signUpMethods: [...shown].sort((a, b) => b.users - a.users || a.method.localeCompare(b.method)),
      hiddenSmallGroups: hidden,
    }
  }

  private async computeEngagement(w: Window, interval: MetricsInterval): Promise<AdminEngagement> {
    const today = dayIn(new Date())
    // Distinct people per bucket, then DAU, WAU, MAU and the 30 days of DAU behind stickiness (they can start before
    // the window). Each is a span of days; the rollup answers the ones it can.
    const starts = bucketStarts(w, interval)
    const buckets: DaySpan[] = starts.map((start, i) => ({ fromDay: start, toDay: i + 1 < starts.length ? addDays(starts[i + 1]!, -1) : w.toDay }))
    const month = trailingDays(w, 30)
    const week = trailingDays(w, 7)
    const monthDays: DaySpan[] = Array.from({ length: 30 }, (_, i) => ({ fromDay: addDays(month.fromDay, i), toDay: addDays(month.fromDay, i) }))
    const spans = [...buckets, { fromDay: w.toDay, toDay: w.toDay }, week, month, ...monthDays]
    const [rows, active] = await Promise.all([this.daily.counts(w, ['core', 'notes'], today), this.daily.activeCounts(spans, today)])
    const [dau, wau, mau] = [active[buckets.length]!, active[buckets.length + 1]!, active[buckets.length + 2]!]
    const daily = active.slice(buckets.length + 3).reduce((sum, n) => sum + n, 0)
    const keys = ['learningSeconds', 'doubtsAsked', 'doubtsAnswered', 'quizAttempts', 'notes'] as const
    const series = rollUp(w, interval, keys, perDay(rows, { learningSeconds: C.learningSeconds, doubtsAsked: C.doubtsAsked, doubtsAnswered: C.doubtsAnswered, quizAttempts: C.quizAttempts, notes: N.notesCreated }))
    return {
      range: range(w),
      interval,
      generatedAt: new Date(),
      dau,
      wau,
      mau,
      stickiness: mau ? Math.round((daily / 30 / mau) * 1000) / 1000 : 0,
      series: series.map((point, i) => ({
        date: point.date,
        activeUsers: active[i] ?? 0,
        learningMinutes: Math.round(point.learningSeconds / 60),
        notesCreated: point.notes,
        doubtsAsked: point.doubtsAsked,
        doubtsAnswered: point.doubtsAnswered,
        quizAttempts: point.quizAttempts,
      })),
    }
  }

  private async computeContent(w: Window): Promise<AdminContentStats> {
    const [rows, uploads] = await Promise.all([this.daily.counts(w, ['notes', 'core'], dayIn(new Date())), this.notes.uploads(w)])
    const m = new MetricRows(rows)
    const visibility = m.byDimension(N.notesCreated)
    const scans = m.byDimension(N.uploadScans)
    const purposes = withoutSmallGroups(uploads.byPurpose)
    return {
      range: range(w),
      generatedAt: new Date(),
      notes: { created: m.total(N.notesCreated), public: visibility.get('PUBLIC') ?? 0, unlisted: visibility.get('UNLISTED') ?? 0, shared: visibility.get('SHARED') ?? 0, private: visibility.get('PRIVATE') ?? 0 },
      uploads: {
        files: uploads.files,
        bytes: uploads.bytes.toString(),
        byPurpose: purposes.shown.map((row) => ({ purpose: row.purpose, files: row.files, bytes: row.bytes.toString() })),
        hiddenSmallGroups: purposes.hidden,
      },
      scans: { clean: scans.get('clean') ?? 0, infected: scans.get('infected') ?? 0, failed: scans.get('failed') ?? 0, pending: scans.get('pending') ?? 0 },
      doubts: {
        asked: m.total(C.doubtsAsked),
        answered: m.total(C.doubtsAnswered),
        resolved: m.total(C.doubtsResolved),
        answers: m.total(C.doubtAnswers),
        medianHoursToFirstAnswer: roundHours(medianHoursOf(m.byDimension(C.firstAnswerMs))),
      },
      places: { groups: m.total(C.groups), classrooms: m.total(C.classrooms), groupPosts: m.total(C.groupPosts), classroomPosts: m.total(C.classroomPosts) },
      sharing: { noteShares: m.total(N.noteShares), placeShares: m.total(N.placeShares), saves: m.total(N.saves) },
    }
  }

  private async computeTopSubjects(w: Window, by: AdminSubjectMetric, first: number): Promise<AdminTopSubjects> {
    let rows: SubjectActivity[]
    if (by === 'LEARNING_TIME') {
      // core knows the time per topic key, notes which subject a key belongs to; neither reads the other's tables.
      const keys = await this.core.learningTopicKeys(w.fromDay, w.toDay)
      const subjects = keys.length ? await this.notes.subjectsOfTopicKeys(keys) : []
      const titles = new Map(subjects.map((s) => [s.subjectId, s.title]))
      const grouped = await this.core.learningByGroup(w.fromDay, w.toDay, subjects.map((s) => ({ key: s.key, group: s.subjectId })))
      rows = grouped.map((g) => ({ subjectId: g.group, title: titles.get(g.group) ?? '', value: Math.round(g.seconds / 60), users: g.users }))
    } else {
      rows = await this.notes.subjectActivity(w, by)
    }
    const { shown, hidden } = withoutSmallGroups(rows)
    return {
      range: range(w),
      by,
      generatedAt: new Date(),
      subjects: [...shown].sort((a, b) => b.value - a.value || a.title.localeCompare(b.title)).slice(0, first),
      hiddenSmallGroups: hidden,
    }
  }

  private async computeVerification(w: Window): Promise<AdminVerificationStats> {
    const decided = Prisma.sql`status IN ('APPROVED', 'REJECTED') AND "decidedAt" >= ${w.from} AND "decidedAt" < ${w.to}`
    const requested = Prisma.sql`"createdAt" >= ${w.from} AND "createdAt" < ${w.to}`
    const [rows, queue, methods] = await Promise.all([
      this.daily.counts(w, ['verification'], dayIn(new Date())),
      this.db.$queryRaw<{ pending: number; oldest: Date | null }[]>`
        SELECT count(*)::int AS pending, min("createdAt") AS oldest FROM "users"."VerificationRequest" WHERE status = 'PENDING'`,
      // Distinct requesters per method over the whole window decide what is shown, so this stays live.
      this.db.$queryRaw<{ method: AdminVerificationMethod; requested: number; approved: number; rejected: number; users: number }[]>`
        SELECT CASE WHEN "collegeIdCard" THEN 'COLLEGE_ID' ELSE method::text END AS method,
               count(*) FILTER (WHERE ${requested})::int AS requested,
               count(*) FILTER (WHERE status = 'APPROVED' AND "decidedAt" >= ${w.from} AND "decidedAt" < ${w.to})::int AS approved,
               count(*) FILTER (WHERE status = 'REJECTED' AND "decidedAt" >= ${w.from} AND "decidedAt" < ${w.to})::int AS rejected,
               count(DISTINCT "userId")::int AS users
        FROM "users"."VerificationRequest"
        WHERE (${requested}) OR (${decided})
        GROUP BY 1`,
    ])
    const m = new MetricRows(rows)
    const q = queue[0] ?? { pending: 0, oldest: null }
    const { shown, hidden } = withoutSmallGroups(methods)
    return {
      range: range(w),
      generatedAt: new Date(),
      requested: m.total(U.verificationRequests),
      approved: m.total(U.verificationApproved),
      rejected: m.total(U.verificationRejected),
      pending: q.pending,
      medianHoursToDecision: roundHours(medianHoursOf(m.byDimension(U.decisionMs))),
      oldestPendingHours: q.oldest ? roundHours((Date.now() - q.oldest.getTime()) / 3_600_000) : null,
      byMethod: [...shown].sort((a, b) => b.requested - a.requested || a.method.localeCompare(b.method)).map(({ method, requested, approved, rejected }) => ({ method, requested, approved, rejected })),
      hiddenSmallGroups: hidden,
    }
  }

  private async computeRetention(today: string, weeks: number): Promise<AdminRetention> {
    const starts = cohortStarts(today, weeks)
    const current = mondayOf(today)
    const rows = await this.daily.cohorts(starts, starts[0]!, today)
    const { cohorts, hidden } = retentionCohorts(starts, current, new MetricRows(rows))
    return { cohortInterval: 'WEEK', timeZone: ADMIN_METRICS_TIME_ZONE, firstWeek: starts[0]!, lastWeek: current, generatedAt: new Date(), cohorts, hiddenSmallGroups: hidden }
  }

  /**
   * What the three ADR-0107 queries read, shared by them for a window: per-day event counts (the rollup for past days,
   * live for the rest) and distinct people per group over the whole window, counted live (the small-group rule needs
   * the exact number, which days cannot be added up to).
   */
  private usageEvents(w: Window): Promise<{ rows: MetricRows; users: WindowUsers; generatedAt: Date }> {
    return this.cached(`usage-events:${w.fromDay}:${w.toDay}`, async () => {
      const [rows, groups] = await Promise.all([this.daily.counts(w, ['usage'], dayIn(new Date())), this.daily.usageGroups(w, false)])
      return { rows: new MetricRows(rows), users: windowUsersOf(groups), generatedAt: new Date() }
    })
  }

  /** Each person's time for one funnel step since `since`, among `among` when given. */
  private async stepTimes(step: string, since: Date, among: Map<string, Date> | null): Promise<Map<string, Date>> {
    const ids = among ? [...among.keys()] : null
    const only = (column: Prisma.Sql) => (ids ? Prisma.sql`AND ${column} = ANY(${ids}::uuid[])` : Prisma.empty)
    if (!isDbFunnelStep(step)) {
      const rows = await this.db.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT e."userId"::text AS "userId", min(e."occurredAt") AS at
        FROM "users"."usage_events" e
        WHERE e.name = ${step} AND e."occurredAt" >= ${since} ${only(Prisma.sql`e."userId"`)}
        GROUP BY e."userId"`
      return new Map(rows.map((row) => [row.userId, row.at]))
    }
    if (step === 'signed_up' || step === 'email_verified') {
      // Verifying cannot come before signing up, whatever the two clocks said.
      // GREATEST skips a null, so an unverified email is ruled out first.
      const at = step === 'signed_up' ? Prisma.sql`u."createdAt"` : Prisma.sql`GREATEST(u."emailVerifiedAt", u."createdAt")`
      const verified = step === 'email_verified' ? Prisma.sql`AND u."emailVerifiedAt" IS NOT NULL` : Prisma.empty
      const rows = await this.db.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT u.id::text AS "userId", ${at} AS at
        FROM "users"."User" u
        WHERE ${COUNTABLE} AND u.id <> ${STUDY_PUBLISHER_ID}::uuid ${verified} AND ${at} >= ${since} ${only(Prisma.sql`u.id`)}`
      return new Map(rows.map((row) => [row.userId, row.at]))
    }
    const accounts = await this.db.$queryRaw<{ userId: string; createdAt: Date }[]>`
      SELECT u.id::text AS "userId", u."createdAt" FROM "users"."User" u
      WHERE ${COUNTABLE} AND u.id <> ${STUDY_PUBLISHER_ID}::uuid ${only(Prisma.sql`u.id`)}`
    if (!accounts.length) return new Map()
    if (step === 'first_note') {
      const firsts = await this.notes.firstNotes(accounts.map((a) => a.userId))
      return new Map(firsts.filter((row) => row.at.getTime() >= since.getTime()).map((row) => [row.userId, row.at]))
    }
    return this.returnedAfterAWeek(accounts, since, among)
  }

  /**
   * returned_d7: the first activity (session start or refresh, usage event, or learning day) at least 7 days after
   * sign-up, not before `since` and not before the person's previous step.
   */
  private async returnedAfterAWeek(accounts: { userId: string; createdAt: Date }[], since: Date, among: Map<string, Date> | null): Promise<Map<string, Date>> {
    const thresholds = accounts.map((a) => ({
      userId: a.userId,
      after: new Date(Math.max(a.createdAt.getTime() + RETURN_AFTER_MS, since.getTime(), among?.get(a.userId)?.getTime() ?? 0)),
    }))
    const [own, learning] = await Promise.all([
      this.db.$queryRaw<{ userId: string; at: Date }[]>`
        SELECT q.id::text AS "userId", min(x.at) AS at
        FROM unnest(${thresholds.map((t) => t.userId)}::uuid[], ${thresholds.map((t) => t.after)}::timestamptz[]) AS q(id, after)
        JOIN (
          SELECT "userId", "occurredAt" AS at FROM "users"."usage_events"
          UNION ALL
          SELECT "userId", "createdAt" FROM "users"."Session"
        ) x ON x."userId" = q.id AND x.at >= q.after
        GROUP BY q.id`,
      this.core.firstLearningDays(thresholds.map((t) => ({ userId: t.userId, onOrAfter: dayIn(t.after) }))),
    ])
    const after = new Map(thresholds.map((t) => [t.userId, t.after]))
    const out = new Map(own.map((row) => [row.userId, row.at]))
    for (const row of learning) {
      // A learning day is a day, not a moment: it counts from its midnight, never before the threshold.
      const threshold = after.get(row.userId)
      if (!threshold) continue
      const at = new Date(Math.max(midnightIn(row.day).getTime(), threshold.getTime()))
      const known = out.get(row.userId)
      if (!known || at.getTime() < known.getTime()) out.set(row.userId, at)
    }
    return out
  }

  /** One computation per key for about 5 minutes; concurrent requests share it, and a failure is not kept. */
  private cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const hit = this.cache.get(key)
    if (hit && now - hit.at < ADMIN_METRICS_CACHE_MS) return hit.value as Promise<T>
    if (this.cache.size >= MAX_CACHED) for (const [k, v] of this.cache) if (now - v.at >= ADMIN_METRICS_CACHE_MS) this.cache.delete(k)
    if (this.cache.size >= MAX_CACHED) this.cache.delete(this.cache.keys().next().value!)
    const value = compute()
    this.cache.set(key, { at: now, value })
    value.catch(() => {
      if (this.cache.get(key)?.value === value) this.cache.delete(key)
    })
    return value
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden()
  }
}

function range(w: Window): AdminMetricsRange {
  return { from: w.from, to: w.to, firstDay: w.fromDay, lastDay: w.toDay, timeZone: w.timeZone }
}

import { Inject, Injectable } from '@nestjs/common'
import { CORE_ADMIN_STATS, NOTES_ADMIN_STATS, type CoreAdminStats, type NotesAdminStats, type SubjectActivity } from '@lvn-backend/facades'
import { Errors } from '@lvn-backend/errors'
import { Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { STUDY_PUBLISHER_ID } from '../domain/study-publisher'
import {
  activePerBucket,
  activeSummary,
  addActive,
  ADMIN_METRICS_CACHE_MS,
  dayIn,
  DB_FUNNEL_STEPS,
  funnelCounts,
  isDbFunnelStep,
  metricsWindow,
  midnightIn,
  RETURN_AFTER_MS,
  rollUp,
  roundHours,
  trailingDays,
  withoutSmallGroups,
  type ActiveDays,
  type MetricsInterval,
  type MetricsWindow,
} from '../domain/usage-metrics'
import { isUsageEventName, USAGE_EVENT_NAMES } from '../domain/usage-events'
import type {
  AdminContentStats,
  AdminEngagement,
  AdminGrowth,
  AdminMetricsRange,
  AdminSubjectMetric,
  AdminTopSubjects,
  AdminVerificationMethod,
  AdminVerificationStats,
  SignUpMethod,
} from '../graphql/schema.types'
import { PolicyService } from './policy.service'

const DAY_MS = 86_400_000
const MAX_CACHED = 200
const MAX_SUBJECTS = 50

type Window = MetricsWindow

/** People counted by their activity: not deleted, not opted out of analytics. `u` is the User alias. */
const COUNTABLE = Prisma.sql`u."deletedAt" IS NULL AND NOT u."analyticsOptOut"`
/** Accounts that are people: not deleted, not the study publisher (ADR-0098). */
const PEOPLE = Prisma.sql`u."deletedAt" IS NULL AND u.id <> ${STUDY_PUBLISHER_ID}::uuid`

/**
 * Usage metrics for the admin dashboard (ADR-0105), from tables the product already keeps. Platform admins only.
 * Aggregates only, and a breakdown group with fewer than 5 distinct people is left out. Each API process keeps a result
 * for about 5 minutes; the key is the query, its days and its options, so refreshing the same view reuses it.
 * `notes` and `core` count their own tables through their facades.
 */
@Injectable()
export class AdminUsageMetricsService {
  private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>()

  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
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
    const [perDay, methods] = await Promise.all([
      this.db.$queryRaw<{ day: string; signUps: number; emailVerified: number; registrationsCompleted: number; verifications: number }[]>`
        SELECT day, sum(s)::int AS "signUps", sum(e)::int AS "emailVerified", sum(r)::int AS "registrationsCompleted", sum(v)::int AS verifications
        FROM (
          SELECT to_char(u."createdAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD') AS day, 1 AS s, 0 AS e, 0 AS r, 0 AS v
          FROM "users"."User" u WHERE u."createdAt" >= ${w.from} AND u."createdAt" < ${w.to} AND ${PEOPLE}
          UNION ALL
          SELECT to_char(u."emailVerifiedAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD'), 0, 1, 0, 0
          FROM "users"."User" u WHERE u."emailVerifiedAt" >= ${w.from} AND u."emailVerifiedAt" < ${w.to} AND ${PEOPLE}
          UNION ALL
          SELECT to_char(u."registrationCompletedAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD'), 0, 0, 1, 0
          FROM "users"."User" u WHERE u."registrationCompletedAt" >= ${w.from} AND u."registrationCompletedAt" < ${w.to} AND ${PEOPLE}
          UNION ALL
          SELECT to_char(u."verifiedAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD'), 0, 0, 0, 1
          FROM "users"."User" u WHERE u."verifiedAt" >= ${w.from} AND u."verifiedAt" < ${w.to} AND ${PEOPLE}
        ) x
        GROUP BY day`,
      // The provider linked in the sign-up transaction (ADR-0100); a provider linked later is not how they signed up.
      this.db.$queryRaw<{ method: SignUpMethod; users: number }[]>`
        SELECT coalesce(m.provider::text, 'EMAIL') AS method, count(*)::int AS users
        FROM "users"."User" u
        LEFT JOIN LATERAL (
          SELECT o.provider FROM "users"."OAuthAccount" o
          WHERE o."userId" = u.id AND o."createdAt" <= u."createdAt" + interval '1 minute'
          ORDER BY o."createdAt", o.id LIMIT 1
        ) m ON true
        WHERE u."createdAt" >= ${w.from} AND u."createdAt" < ${w.to} AND ${PEOPLE}
        GROUP BY 1`,
    ])
    const keys = ['signUps', 'emailVerified', 'registrationsCompleted', 'verifications'] as const
    const series = rollUp(w, interval, keys, perDay)
    const totals = { signUps: 0, emailVerified: 0, registrationsCompleted: 0, verifications: 0 }
    for (const point of series) for (const key of keys) totals[key] += point[key]
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
    // MAU needs the 30 days before the last day, which can start before the window.
    const month = trailingDays(w, 30)
    const spanFromDay = month.fromDay < w.fromDay ? month.fromDay : w.fromDay
    const span = { from: midnightIn(spanFromDay, w.timeZone), to: w.to }
    const [own, learners, activity, notes] = await Promise.all([
      this.db.$queryRaw<{ day: string; userId: string }[]>`
        SELECT DISTINCT a.day, a."userId"::text AS "userId"
        FROM (
          SELECT to_char(e."occurredAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD') AS day, e."userId"
          FROM "users"."usage_events" e WHERE e."occurredAt" >= ${span.from} AND e."occurredAt" < ${span.to}
          UNION ALL
          SELECT to_char(s."createdAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD'), s."userId"
          FROM "users"."Session" s WHERE s."createdAt" >= ${span.from} AND s."createdAt" < ${span.to}
        ) a
        JOIN "users"."User" u ON u.id = a."userId"
        WHERE ${COUNTABLE}`,
      this.core.learnerDays(spanFromDay, w.toDay),
      this.core.activityPerDay(w),
      this.notes.notesPerDay(w),
    ])
    const countable = await this.countable([...new Set(learners.flatMap((row) => row.userIds))])
    const days: ActiveDays = new Map()
    for (const row of own) addActive(days, row.day, row.userId)
    for (const row of learners) for (const id of row.userIds) if (countable.has(id)) addActive(days, row.day, id)
    const active = activePerBucket(w, interval, days)
    const keys = ['learningSeconds', 'doubtsAsked', 'doubtsAnswered', 'quizAttempts', 'notes'] as const
    const series = rollUp(w, interval, keys, [...activity, ...notes])
    return {
      range: range(w),
      interval,
      generatedAt: new Date(),
      ...activeSummary(w, days),
      series: series.map((point) => ({
        date: point.date,
        activeUsers: active.get(point.date) ?? 0,
        learningMinutes: Math.round(point.learningSeconds / 60),
        notesCreated: point.notes,
        doubtsAsked: point.doubtsAsked,
        doubtsAnswered: point.doubtsAnswered,
        quizAttempts: point.quizAttempts,
      })),
    }
  }

  private async computeContent(w: Window): Promise<AdminContentStats> {
    const [notes, core] = await Promise.all([this.notes.content(w), this.core.content(w)])
    const purposes = withoutSmallGroups(notes.uploads.byPurpose)
    return {
      range: range(w),
      generatedAt: new Date(),
      notes: notes.notes,
      uploads: {
        files: notes.uploads.files,
        bytes: notes.uploads.bytes.toString(),
        byPurpose: purposes.shown.map((row) => ({ purpose: row.purpose, files: row.files, bytes: row.bytes.toString() })),
        hiddenSmallGroups: purposes.hidden,
      },
      scans: notes.scans,
      doubts: { ...core.doubts, medianHoursToFirstAnswer: roundHours(core.doubts.medianHoursToFirstAnswer) },
      places: core.places,
      sharing: notes.sharing,
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
    const [totals, queue, methods] = await Promise.all([
      this.db.$queryRaw<{ requested: number; approved: number; rejected: number; medianHours: number | null }[]>`
        SELECT (SELECT count(*) FROM "users"."VerificationRequest" WHERE ${requested})::int AS requested,
               (SELECT count(*) FROM "users"."VerificationRequest" WHERE status = 'APPROVED' AND "decidedAt" >= ${w.from} AND "decidedAt" < ${w.to})::int AS approved,
               (SELECT count(*) FROM "users"."VerificationRequest" WHERE status = 'REJECTED' AND "decidedAt" >= ${w.from} AND "decidedAt" < ${w.to})::int AS rejected,
               (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "decidedAt" - "createdAt") / 3600)
                  FROM "users"."VerificationRequest" WHERE ${decided})::float8 AS "medianHours"`,
      this.db.$queryRaw<{ pending: number; oldest: Date | null }[]>`
        SELECT count(*)::int AS pending, min("createdAt") AS oldest FROM "users"."VerificationRequest" WHERE status = 'PENDING'`,
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
    const t = totals[0] ?? { requested: 0, approved: 0, rejected: 0, medianHours: null }
    const q = queue[0] ?? { pending: 0, oldest: null }
    const { shown, hidden } = withoutSmallGroups(methods)
    return {
      range: range(w),
      generatedAt: new Date(),
      requested: t.requested,
      approved: t.approved,
      rejected: t.rejected,
      pending: q.pending,
      medianHoursToDecision: roundHours(t.medianHours == null ? null : Number(t.medianHours)),
      oldestPendingHours: q.oldest ? roundHours((Date.now() - q.oldest.getTime()) / 3_600_000) : null,
      byMethod: [...shown].sort((a, b) => b.requested - a.requested || a.method.localeCompare(b.method)).map(({ method, requested, approved, rejected }) => ({ method, requested, approved, rejected })),
      hiddenSmallGroups: hidden,
    }
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

  /** The ids among these that may be counted by their activity. */
  private async countable(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set()
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      SELECT u.id::text AS id FROM "users"."User" u WHERE u.id = ANY(${ids}::uuid[]) AND ${COUNTABLE}`
    return new Set(rows.map((row) => row.id))
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

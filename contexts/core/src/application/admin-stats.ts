import { Injectable } from '@nestjs/common'
import { CORE_DAILY_METRICS, type AdminDailyCount, type AdminDayWindow, type CoreAdminStats as CoreAdminStatsPort } from '@lvn-backend/facades'
import { Prisma, PrismaService } from '@lvn-backend/prisma-base'

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The first answer to each doubt by someone other than the asker, among answers and doubts that are not deleted.
 * `first_answers(doubtId, askedAt, answeredAt)`.
 */
const FIRST_ANSWERS = Prisma.sql`
  SELECT d.id AS "doubtId", d."createdAt" AS "askedAt", min(a."createdAt") AS "answeredAt"
  FROM "core"."Doubt" d
  JOIN "core"."DoubtAnswer" a ON a."doubtId" = d.id AND a."deletedAt" IS NULL AND a."authorId" <> d."authorId"
  WHERE d."deletedAt" IS NULL
  GROUP BY d.id, d."createdAt"`

/** Moderation queue, place and learning totals for the admin dashboard (ADR-0101, ADR-0105, ADR-0106). Counts only. */
@Injectable()
export class CoreAdminStats implements CoreAdminStatsPort {
  constructor(private readonly db: PrismaService) {}

  async counts(): Promise<{ openReports: number; openAppeals: number; groups: number; classrooms: number }> {
    const [openReports, openAppeals, groups, classrooms] = await Promise.all([
      this.db.report.count({ where: { status: 'OPEN' } }),
      this.db.moderationAppeal.count({ where: { status: 'OPEN' } }),
      this.db.group.count({ where: { deletedAt: null } }),
      this.db.classroom.count({ where: { deletedAt: null } }),
    ])
    return { openReports, openAppeals, groups, classrooms }
  }

  async dailyCounts(w: AdminDayWindow): Promise<AdminDailyCount[]> {
    assertDays(w.fromDay, w.toDay)
    // LearningDay is already a day: the learner's own (ADR-0030, 04:00 in their zone). Imported legacy time is left out.
    const { from, to, fromDay, toDay, timeZone } = w
    const day = (column: Prisma.Sql) => Prisma.sql`to_char(${column} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`
    const m = CORE_DAILY_METRICS
    const [counts, firstAnswers] = await Promise.all([
      this.db.$queryRaw<{ day: string; metric: string; value: number }[]>`
        WITH first_answers AS (${FIRST_ANSWERS})
        SELECT to_char(day, 'YYYY-MM-DD') AS day, ${m.learningSeconds}::text AS metric, sum("learningSeconds")::int AS value
        FROM "core"."LearningDay" WHERE day >= ${fromDay}::date AND day <= ${toDay}::date GROUP BY 1
        UNION ALL
        SELECT ${day(Prisma.sql`"createdAt"`)}, ${m.doubtsAsked}::text, count(*)::int
        FROM "core"."Doubt" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "deletedAt" IS NULL GROUP BY 1
        UNION ALL
        SELECT ${day(Prisma.sql`"answeredAt"`)}, ${m.doubtsAnswered}::text, count(*)::int
        FROM first_answers WHERE "answeredAt" >= ${from} AND "answeredAt" < ${to} GROUP BY 1
        UNION ALL
        SELECT ${day(Prisma.sql`"resolvedAt"`)}, ${m.doubtsResolved}::text, count(*)::int
        FROM "core"."Doubt" WHERE "resolvedAt" >= ${from} AND "resolvedAt" < ${to} AND "deletedAt" IS NULL GROUP BY 1
        UNION ALL
        SELECT ${day(Prisma.sql`a."createdAt"`)}, ${m.doubtAnswers}::text, count(*)::int
        FROM "core"."DoubtAnswer" a JOIN "core"."Doubt" d ON d.id = a."doubtId"
        WHERE a."createdAt" >= ${from} AND a."createdAt" < ${to} AND a."deletedAt" IS NULL AND d."deletedAt" IS NULL GROUP BY 1
        UNION ALL
        SELECT day, ${m.quizAttempts}::text, count(*)::int FROM (
          SELECT ${day(Prisma.sql`"submittedAt"`)} AS day FROM "core"."QuizAttempt" WHERE "submittedAt" >= ${from} AND "submittedAt" < ${to}
          UNION ALL
          SELECT ${day(Prisma.sql`"submittedAt"`)} FROM "core"."SharedQuizAttempt" WHERE "submittedAt" >= ${from} AND "submittedAt" < ${to}
        ) q GROUP BY 1
        UNION ALL
        SELECT ${day(Prisma.sql`"createdAt"`)}, ${m.groups}::text, count(*)::int
        FROM "core"."Group" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "deletedAt" IS NULL GROUP BY 1
        UNION ALL
        SELECT ${day(Prisma.sql`"createdAt"`)}, ${m.classrooms}::text, count(*)::int
        FROM "core"."Classroom" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "deletedAt" IS NULL GROUP BY 1
        UNION ALL
        SELECT ${day(Prisma.sql`"createdAt"`)}, ${m.groupPosts}::text, count(*)::int
        FROM "core"."GroupPost" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "deletedAt" IS NULL GROUP BY 1
        UNION ALL
        SELECT ${day(Prisma.sql`"createdAt"`)}, ${m.classroomPosts}::text, count(*)::int
        FROM "core"."ClassroomPost" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "deletedAt" IS NULL GROUP BY 1`,
      // How long each doubt answered in the window waited, to the millisecond (timestamps keep milliseconds): the
      // median over any set of days comes out exactly as one over the rows themselves.
      this.db.$queryRaw<{ day: string; ms: string; doubts: number }[]>`
        WITH first_answers AS (${FIRST_ANSWERS})
        SELECT ${day(Prisma.sql`"answeredAt"`)} AS day, round(extract(epoch FROM "answeredAt" - "askedAt") * 1000)::bigint::text AS ms, count(*)::int AS doubts
        FROM first_answers WHERE "answeredAt" >= ${from} AND "answeredAt" < ${to}
        GROUP BY 1, 2`,
    ])
    return [
      ...counts.filter((row) => row.value > 0).map((row) => ({ day: row.day, metric: row.metric, dimension: '', value: row.value })),
      ...firstAnswers.map((row) => ({ day: row.day, metric: m.firstAnswerMs, dimension: row.ms, value: row.doubts })),
    ]
  }

  async learnerDays(fromDay: string, toDay: string): Promise<{ day: string; userIds: string[] }[]> {
    assertDays(fromDay, toDay)
    // A row with no events holds only time imported from the old site: nobody did anything that day.
    return this.db.$queryRaw<{ day: string; userIds: string[] }[]>`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, array_agg("userId"::text) AS "userIds"
      FROM "core"."LearningDay"
      WHERE day >= ${fromDay}::date AND day <= ${toDay}::date AND events > 0
      GROUP BY day`
  }

  async learningTopicKeys(fromDay: string, toDay: string): Promise<string[]> {
    assertDays(fromDay, toDay)
    const rows = await this.db.$queryRaw<{ topicKey: string }[]>`
      SELECT DISTINCT "topicKey" FROM "core"."LearningDayTopic"
      WHERE day >= ${fromDay}::date AND day <= ${toDay}::date AND seconds > 0`
    return rows.map((row) => row.topicKey)
  }

  async learningByGroup(fromDay: string, toDay: string, groups: { key: string; group: string }[]): Promise<{ group: string; seconds: number; users: number }[]> {
    assertDays(fromDay, toDay)
    if (!groups.length) return []
    // Time with the topic open: studying and reading (ADR-0067). Imported legacy seconds are left out.
    const rows = await this.db.$queryRaw<{ group: string; seconds: bigint; users: number }[]>`
      SELECT m."group", sum(t.seconds)::bigint AS seconds, count(DISTINCT t."userId")::int AS users
      FROM "core"."LearningDayTopic" t
      JOIN unnest(${groups.map((g) => g.key)}::text[], ${groups.map((g) => g.group)}::text[]) AS m(key, "group") ON m.key = t."topicKey"
      WHERE t.day >= ${fromDay}::date AND t.day <= ${toDay}::date AND t.seconds > 0
      GROUP BY m."group"`
    return rows.map((row) => ({ group: row.group, seconds: Number(row.seconds), users: row.users }))
  }

  async firstLearningDays(after: { userId: string; onOrAfter: string }[]): Promise<{ userId: string; day: string }[]> {
    if (!after.length) return []
    for (const a of after) assertDays(a.onOrAfter, a.onOrAfter)
    return this.db.$queryRaw<{ userId: string; day: string }[]>`
      SELECT q."userId"::text AS "userId", to_char(min(ld.day), 'YYYY-MM-DD') AS day
      FROM unnest(${after.map((a) => a.userId)}::uuid[], ${after.map((a) => a.onOrAfter)}::date[]) AS q("userId", "onOrAfter")
      JOIN "core"."LearningDay" ld ON ld."userId" = q."userId" AND ld.day >= q."onOrAfter" AND ld.events > 0
      GROUP BY q."userId"`
  }
}

function assertDays(...days: string[]): void {
  for (const day of days) if (!DAY.test(day)) throw new Error(`Not a YYYY-MM-DD day: ${day}`)
}

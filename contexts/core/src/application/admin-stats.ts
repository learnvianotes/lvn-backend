import { Injectable } from '@nestjs/common'
import type { AdminDayWindow, CoreAdminStats as CoreAdminStatsPort, CoreContentStats } from '@lvn-backend/facades'
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

/** Moderation queue, place and learning totals for the admin dashboard (ADR-0101, ADR-0105). Counts only. */
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

  async activityPerDay(w: AdminDayWindow): Promise<{ day: string; learningSeconds: number; doubtsAsked: number; doubtsAnswered: number; quizAttempts: number }[]> {
    assertDays(w.fromDay, w.toDay)
    // LearningDay is already a day: the learner's own (ADR-0030, 04:00 in their zone). Imported legacy time is left out.
    const { from, to, fromDay, toDay, timeZone } = w
    return this.db.$queryRaw<{ day: string; learningSeconds: number; doubtsAsked: number; doubtsAnswered: number; quizAttempts: number }[]>`
      WITH first_answers AS (${FIRST_ANSWERS}),
      rows AS (
        SELECT to_char(day, 'YYYY-MM-DD') AS day, sum("learningSeconds")::bigint AS learning, 0::bigint AS asked, 0::bigint AS answered, 0::bigint AS attempts
        FROM "core"."LearningDay" WHERE day >= ${fromDay}::date AND day <= ${toDay}::date GROUP BY 1
        UNION ALL
        SELECT to_char("createdAt" AT TIME ZONE ${timeZone}, 'YYYY-MM-DD'), 0, count(*), 0, 0
        FROM "core"."Doubt" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "deletedAt" IS NULL GROUP BY 1
        UNION ALL
        SELECT to_char("answeredAt" AT TIME ZONE ${timeZone}, 'YYYY-MM-DD'), 0, 0, count(*), 0
        FROM first_answers WHERE "answeredAt" >= ${from} AND "answeredAt" < ${to} GROUP BY 1
        UNION ALL
        SELECT to_char("submittedAt" AT TIME ZONE ${timeZone}, 'YYYY-MM-DD'), 0, 0, 0, count(*)
        FROM "core"."QuizAttempt" WHERE "submittedAt" >= ${from} AND "submittedAt" < ${to} GROUP BY 1
        UNION ALL
        SELECT to_char("submittedAt" AT TIME ZONE ${timeZone}, 'YYYY-MM-DD'), 0, 0, 0, count(*)
        FROM "core"."SharedQuizAttempt" WHERE "submittedAt" >= ${from} AND "submittedAt" < ${to} GROUP BY 1
      )
      SELECT day, sum(learning)::int AS "learningSeconds", sum(asked)::int AS "doubtsAsked", sum(answered)::int AS "doubtsAnswered", sum(attempts)::int AS "quizAttempts"
      FROM rows GROUP BY day`
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

  async content(w: AdminDayWindow): Promise<CoreContentStats> {
    const [doubts, places] = await Promise.all([
      this.db.$queryRaw<{ asked: number; answered: number; resolved: number; answers: number; medianHours: number | null }[]>`
        WITH first_answers AS (${FIRST_ANSWERS})
        SELECT (SELECT count(*) FROM "core"."Doubt" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to} AND "deletedAt" IS NULL)::int AS asked,
               (SELECT count(*) FROM first_answers WHERE "answeredAt" >= ${w.from} AND "answeredAt" < ${w.to})::int AS answered,
               (SELECT count(*) FROM "core"."Doubt" WHERE "resolvedAt" >= ${w.from} AND "resolvedAt" < ${w.to} AND "deletedAt" IS NULL)::int AS resolved,
               (SELECT count(*) FROM "core"."DoubtAnswer" a JOIN "core"."Doubt" d ON d.id = a."doubtId"
                 WHERE a."createdAt" >= ${w.from} AND a."createdAt" < ${w.to} AND a."deletedAt" IS NULL AND d."deletedAt" IS NULL)::int AS answers,
               (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "answeredAt" - "askedAt") / 3600)
                 FROM first_answers WHERE "answeredAt" >= ${w.from} AND "answeredAt" < ${w.to})::float8 AS "medianHours"`,
      this.db.$queryRaw<{ groups: number; classrooms: number; groupPosts: number; classroomPosts: number }[]>`
        SELECT (SELECT count(*) FROM "core"."Group" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to} AND "deletedAt" IS NULL)::int AS groups,
               (SELECT count(*) FROM "core"."Classroom" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to} AND "deletedAt" IS NULL)::int AS classrooms,
               (SELECT count(*) FROM "core"."GroupPost" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to} AND "deletedAt" IS NULL)::int AS "groupPosts",
               (SELECT count(*) FROM "core"."ClassroomPost" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to} AND "deletedAt" IS NULL)::int AS "classroomPosts"`,
    ])
    const d = doubts[0] ?? { asked: 0, answered: 0, resolved: 0, answers: 0, medianHours: null }
    return {
      doubts: { asked: d.asked, answered: d.answered, resolved: d.resolved, answers: d.answers, medianHoursToFirstAnswer: d.medianHours == null ? null : Number(d.medianHours) },
      places: places[0] ?? { groups: 0, classrooms: 0, groupPosts: 0, classroomPosts: 0 },
    }
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

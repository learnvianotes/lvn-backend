import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { LearningEventType } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PrismaService } from '@lvn-backend/prisma-base'
import { countsForRhythm, dayBounds, learningDay } from '../domain/learning-day'
import { LearningEventsService } from './learning-events.service'

export interface HistoryDay {
  day: string
  learningSeconds: number
  readingSeconds: number
  reviews: number
  quizAnswers: number
  counted: boolean
  topics: { key: string; seconds: number }[]
  noteIds: string[]
}

/** Days per page, and the notes listed per day. */
const DAYS = 14
const NOTES_PER_DAY = 20
const CORE_TOPIC = /^core:([a-z0-9][a-z0-9_-]*)\/([a-z0-9][a-z0-9_-]*)$/i

/**
 * Learning history (§14.2, ADR-0067): a person's days, newest first, with the time they learned and read, the topics
 * and the notes they opened. Old-site study days come in with a claim (ADR-0023). /core events also keep /core
 * progress: time on a topic, a topic finished, a problem marked, for `coreProgress` (origin LVN).
 */
@Injectable()
export class LearningHistoryService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly learning: LearningEventsService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('LearningEventRecorded', ({ payload }) => this.applyCoreProgress(payload.userId, payload.eventIds))
  }

  /** The person's days before `before` (YYYY-MM-DD; today and older when absent), only days with something in them. */
  async history(userId: string, before: string | null, days = DAYS): Promise<{ timeZone: string; days: HistoryDay[]; nextBefore: string | null }> {
    if (before && !/^\d{4}-\d{2}-\d{2}$/.test(before)) throw Errors.validation('A day is written YYYY-MM-DD.', ['before'])
    const size = Math.min(Math.max(days, 1), 60)
    const timeZone = await this.learning.timeZoneOf(userId)
    const rows = await this.db.learningDay.findMany({ where: { userId, ...(before ? { day: { lt: new Date(`${before}T00:00:00Z`) } } : {}) }, orderBy: { day: 'desc' }, take: size + 1 })
    const page = rows.slice(0, size)
    if (!page.length) return { timeZone, days: [], nextBefore: null }
    const dayKeys = page.map((r) => r.day.toISOString().slice(0, 10))
    const [topics, opened] = await Promise.all([
      this.db.learningDayTopic.findMany({ where: { userId, day: { in: page.map((r) => r.day) } }, orderBy: [{ seconds: 'desc' }] }),
      this.notesOpened(userId, dayKeys, timeZone),
    ])
    return {
      timeZone,
      nextBefore: rows.length > size ? dayKeys.at(-1)! : null,
      days: page.map((r, i) => {
        const day = dayKeys[i]!
        const learningSeconds = r.learningSeconds + r.legacyLearningSeconds
        return {
          day,
          learningSeconds,
          readingSeconds: r.readingSeconds + r.legacyReadingSeconds,
          reviews: r.reviews,
          quizAnswers: r.quizAnswers,
          counted: countsForRhythm({ learningSeconds, reviews: r.reviews }),
          topics: topics.filter((t) => t.day.getTime() === r.day.getTime()).map((t) => ({ key: t.topicKey, seconds: t.seconds + t.legacySeconds })),
          noteIds: opened.get(day) ?? [],
        }
      }),
    }
  }

  /** NOTE_OPENED by day, newest open first; each note once a day. */
  private async notesOpened(userId: string, dayKeys: string[], timeZone: string): Promise<Map<string, string[]>> {
    const from = dayBounds(dayKeys.at(-1)!, timeZone).from
    const to = dayBounds(dayKeys[0]!, timeZone).to
    const rows = await this.db.$queryRaw<{ entityId: string; clientTs: Date }[]>`
      SELECT "entityId", "clientTs" FROM "learning"."LearningEvent"
      WHERE "userId" = ${userId}::uuid AND "type" = ${LearningEventType.NOTE_OPENED} AND "entityId" IS NOT NULL
        AND "clientTs" >= ${from} AND "clientTs" < ${to}
      ORDER BY "clientTs" DESC`
    const byDay = new Map<string, string[]>()
    for (const r of rows) {
      if (!/^[0-9a-f-]{36}$/i.test(r.entityId)) continue
      const day = learningDay(r.clientTs, timeZone)
      const list = byDay.get(day) ?? []
      if (!list.includes(r.entityId) && list.length < NOTES_PER_DAY) list.push(r.entityId)
      byDay.set(day, list)
    }
    return byDay
  }

  /**
   * /core progress from /core events (ADR-0023): time on a topic and its last visit, a topic finished (or not), a
   * problem marked SOLVED or REVISIT (or cleared with NONE).
   */
  async applyCoreProgress(userId: string, eventIds: string[]): Promise<void> {
    const rows = await this.db.$queryRaw<{ type: string; entityId: string | null; topicKeys: string[]; durationMs: number | null; metadata: Record<string, unknown>; clientTs: Date }[]>`
      SELECT "type", "entityId", "topicKeys", "durationMs", "metadata", "clientTs" FROM "learning"."LearningEvent"
      WHERE "userId" = ${userId}::uuid AND "id" = ANY(${eventIds}::uuid[]) AND (EXISTS (SELECT 1 FROM unnest("topicKeys") k WHERE k LIKE 'core:%') OR "type" = ${LearningEventType.PROBLEM_MARKED})
      ORDER BY "clientTs"`
    for (const e of rows) {
      if (e.type === LearningEventType.PROBLEM_MARKED) {
        await this.markProblem(userId, e)
        continue
      }
      for (const key of e.topicKeys) {
        const m = CORE_TOPIC.exec(key)
        if (!m) continue
        const topicKey = `${m[1]}/${m[2]}`
        const seconds = e.type === LearningEventType.TIME_SPENT ? Math.round((e.durationMs ?? 0) / 1000) : 0
        const done = e.type === LearningEventType.TOPIC_COMPLETED ? e.metadata?.done !== false : null
        const revisit = e.type === LearningEventType.TOPIC_COMPLETED && typeof e.metadata?.revisit === 'boolean' ? (e.metadata.revisit as boolean) : null
        await this.db.$executeRaw`
          INSERT INTO "core"."CoreTopicProgress" ("userId", "topicKey", "subjectId", "origin", "completed", "revisit", "secondsStudied", "lastStudiedAt", "updatedAt")
          VALUES (${userId}::uuid, ${topicKey}, ${m[1]}, 'LVN', ${done ?? false}, ${revisit ?? false}, ${seconds}, ${e.clientTs}, now())
          ON CONFLICT ("userId", "topicKey", "origin") DO UPDATE SET
            "secondsStudied" = "CoreTopicProgress"."secondsStudied" + EXCLUDED."secondsStudied",
            "completed" = CASE WHEN ${done}::boolean IS NULL THEN "CoreTopicProgress"."completed" ELSE ${done}::boolean END,
            "revisit" = CASE WHEN ${revisit}::boolean IS NULL THEN "CoreTopicProgress"."revisit" ELSE ${revisit}::boolean END,
            "lastStudiedAt" = GREATEST("CoreTopicProgress"."lastStudiedAt", EXCLUDED."lastStudiedAt"),
            "updatedAt" = now()`
      }
    }
  }

  private async markProblem(userId: string, e: { entityId: string | null; metadata: Record<string, unknown>; clientTs: Date }) {
    const subjectId = typeof e.metadata?.subjectId === 'string' ? e.metadata.subjectId : null
    const mark = e.metadata?.mark
    if (!e.entityId || !subjectId || !/^[a-z0-9][a-z0-9_-]*$/i.test(subjectId) || e.entityId.length > 100) return
    const where = { userId_subjectId_problemId_origin: { userId, subjectId, problemId: e.entityId, origin: 'LVN' as const } }
    if (mark === 'NONE') {
      await this.db.coreProblemMark.deleteMany({ where: { userId, subjectId, problemId: e.entityId, origin: 'LVN' } })
      return
    }
    if (mark !== 'SOLVED' && mark !== 'REVISIT') return
    await this.db.coreProblemMark.upsert({ where, create: { userId, subjectId, problemId: e.entityId, origin: 'LVN', mark, markedAt: e.clientTs }, update: { mark, markedAt: e.clientTs } })
  }

  /** The old site's study days (ADR-0023), set (not added) so importing a claim again changes nothing. */
  async importLegacyDays(userId: string, days: Record<string, { topics: Record<string, { sec: number }>; focus: number }>): Promise<number> {
    let n = 0
    for (const [day, d] of Object.entries(days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
      const reading = Math.round(Object.values(d.topics).reduce((s, t) => s + t.sec, 0))
      const focus = Math.round(d.focus)
      await this.db.$executeRaw`
        INSERT INTO "core"."LearningDay" ("userId", "day", "legacyLearningSeconds", "legacyReadingSeconds", "updatedAt")
        VALUES (${userId}::uuid, ${day}::date, ${focus}, ${reading}, now())
        ON CONFLICT ("userId", "day") DO UPDATE SET "legacyLearningSeconds" = EXCLUDED."legacyLearningSeconds", "legacyReadingSeconds" = EXCLUDED."legacyReadingSeconds", "updatedAt" = now()`
      for (const [key, t] of Object.entries(d.topics)) {
        const topicKey = `core:${key}`
        if (!CORE_TOPIC.test(topicKey)) continue
        await this.db.$executeRaw`
          INSERT INTO "core"."LearningDayTopic" ("userId", "day", "topicKey", "legacySeconds")
          VALUES (${userId}::uuid, ${day}::date, ${topicKey}, ${Math.round(t.sec)})
          ON CONFLICT ("userId", "day", "topicKey") DO UPDATE SET "legacySeconds" = EXCLUDED."legacySeconds"`
      }
      n++
    }
    return n
  }

  /** A declined claim: the old days go; what was recorded since stays. */
  async removeLegacyDays(userId: string): Promise<void> {
    await this.db.learningDay.updateMany({ where: { userId }, data: { legacyLearningSeconds: 0, legacyReadingSeconds: 0 } })
    await this.db.learningDayTopic.updateMany({ where: { userId }, data: { legacySeconds: 0 } })
    await this.db.learningDay.deleteMany({ where: { userId, learningSeconds: 0, readingSeconds: 0, reviews: 0, quizAnswers: 0, events: 0 } })
    await this.db.learningDayTopic.deleteMany({ where: { userId, seconds: 0, events: 0 } })
  }
}

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { LearningEventType } from '@lvn/contracts/domain'
import { EXAM_LIMITS, examNameSchema } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { TOPICS, type TopicRef, type Topics } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { accuracyOf, daysLeft, masteryOf, planSessions, READINESS_TARGET, readinessOf, REVISIT_DAYS, SUGGEST_DAYS, TASK_SECONDS, targetOn, WEAK_ACCURACY } from '../domain/exams'
import { calendarDay, dayBounds, learningDay } from '../domain/learning-day'
import { addDays } from '../domain/rhythm'
import { LearningEventsService } from './learning-events.service'
import { ReviewsService } from './reviews.service'

const day = (d: Date) => d.toISOString().slice(0, 10)
const date = (d: string) => new Date(`${d}T00:00:00Z`)
const DAY = /^\d{4}-\d{2}-\d{2}$/
/** The local hour from which a person with a revision task left today is reminded */
const REMIND_HOUR = 18

export type WeakReason = 'LOW_ACCURACY' | 'NOT_REVISITED'
export interface WeakTopic {
  key: string
  title: string | null
  topicId: string | null
  reason: WeakReason
  accuracy: number | null
  examId: string | null
  examName: string | null
  daysLeft: number | null
}
type ExamRow = Prisma.ExamGetPayload<{ include: { topics: true; tasks: true } }>

/**
 * Exams (§14.2, ADR-0070): a learner's exams and their topics, the revision plan spread back from each exam, quiz
 * results by topic, weak topics, Exam Readiness with its target line, Rhythm's suggestion and today's ring items, and
 * the evening reminder of a revision task left.
 */
@Injectable()
export class ExamsService implements OnModuleInit {
  private readonly log = new Logger('Exams')

  constructor(
    private readonly db: PrismaService,
    private readonly learning: LearningEventsService,
    private readonly reviews: ReviewsService,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('LearningEventRecorded', ({ payload }) => this.keepQuizResults(payload.userId, payload.eventIds))
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /**
   * Today as a learning day (04:00 rollover), which plans and Readiness count in, and as the calendar date, which
   * countdowns count from: at 01:00 an exam three dates away is three days away (ADR-0070).
   */
  private async today(userId: string, now = new Date()) {
    const timeZone = await this.learning.timeZoneOf(userId)
    return { timeZone, today: learningDay(now, timeZone), calendar: calendarDay(now, timeZone) }
  }

  // ── Exams ────────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Topic search for an exam's topics: the notes topics the person may use. */
  topicOptions(userId: string, query: string): Promise<TopicRef[]> {
    return this.topics.find(userId, query.slice(0, 100))
  }

  private async checked(userId: string, input: { name?: string; date?: string; topicIds?: string[] }, today: string) {
    const name = input.name === undefined ? undefined : examNameSchema.safeParse(input.name)
    if (name && !name.success) throw Errors.validation(name.error.issues[0]!.message, ['input', 'name'])
    if (input.date !== undefined) {
      if (!DAY.test(input.date) || Number.isNaN(Date.parse(input.date))) throw Errors.validation('A day is written YYYY-MM-DD.', ['input', 'date'])
      if (input.date < today) throw Errors.validation('The exam is today or later.', ['input', 'date'])
      if (input.date > addDays(today, EXAM_LIMITS.daysAhead)) throw Errors.validation('The exam is at most two years away.', ['input', 'date'])
    }
    let topics: TopicRef[] | undefined
    if (input.topicIds !== undefined) {
      const ids = [...new Set(input.topicIds)]
      if (!ids.length) throw Errors.validation('Pick at least one topic.', ['input', 'topicIds'])
      if (ids.length > EXAM_LIMITS.topics) throw Errors.validation(`An exam has at most ${EXAM_LIMITS.topics} topics.`, ['input', 'topicIds'])
      topics = await this.topics.usable(userId, ids)
      if (topics.length !== ids.length) throw Errors.validation('One of these topics does not exist.', ['input', 'topicIds'])
    }
    return { name: name?.data, date: input.date, topics }
  }

  async create(userId: string, input: { name: string; date: string; topicIds: string[] }): Promise<string> {
    const { today } = await this.today(userId)
    const { name, date: on, topics } = await this.checked(userId, input, today)
    if ((await this.db.exam.count({ where: { userId, date: { gte: date(today) } } })) >= EXAM_LIMITS.upcoming) throw Errors.validation(`You can plan for ${EXAM_LIMITS.upcoming} exams at a time.`, ['input'])
    const id = newId()
    await this.db.exam.create({ data: { id, userId, name: name!, date: date(on!), topics: { create: topics!.map((t, position) => ({ topicKey: t.key, title: t.title, position })) } } })
    await this.replan(userId, id)
    await this.learning.record(userId, { type: LearningEventType.EXAM_CREATED, entityType: 'EXAM', entityId: id, topicKeys: topics!.slice(0, 10).map((t) => t.key) })
    return id
  }

  async update(userId: string, input: { id: string; name?: string | null; date?: string | null; topicIds?: string[] | null }): Promise<void> {
    const exam = await this.db.exam.findFirst({ where: { id: input.id, userId } })
    if (!exam) throw Errors.notFound('That exam is not there.')
    const { today } = await this.today(userId)
    const { name, date: on, topics } = await this.checked(userId, { name: input.name ?? undefined, date: input.date ?? undefined, topicIds: input.topicIds ?? undefined }, today)
    await this.db.$transaction(async (tx) => {
      await tx.exam.update({ where: { id: exam.id }, data: { ...(name ? { name } : {}), ...(on ? { date: date(on) } : {}) } })
      if (topics) {
        await tx.examTopic.deleteMany({ where: { examId: exam.id } })
        await tx.examTopic.createMany({ data: topics.map((t, position) => ({ examId: exam.id, topicKey: t.key, title: t.title, position })) })
      }
    })
    if (on || topics) await this.replan(userId, exam.id)
  }

  async remove(userId: string, id: string): Promise<void> {
    const gone = await this.db.exam.deleteMany({ where: { id, userId } })
    if (!gone.count) throw Errors.notFound('That exam is not there.')
  }

  /** Plans the days from today again (ADR-0070 item 4): past days keep their tasks. */
  private async replan(userId: string, examId: string): Promise<void> {
    const exam = await this.db.exam.findUniqueOrThrow({ where: { id: examId }, include: { topics: { orderBy: { position: 'asc' } } } })
    const { today } = await this.today(userId)
    const weak = new Set((await this.weakTopics(userId)).map((w) => w.key))
    const sessions = planSessions({ today, examDate: day(exam.date), topics: exam.topics.map((t) => ({ key: t.topicKey, weak: weak.has(t.topicKey) })) })
    await this.db.$transaction([
      this.db.examPlanTask.deleteMany({ where: { examId, day: { gte: date(today) } } }),
      this.db.examPlanTask.createMany({ data: sessions.map((s) => ({ id: newId(), examId, userId, day: date(s.day), topicKeys: s.topicKeys })) }),
    ])
  }

  /** The person's exams from a week ago on, soonest first, each with its plan, Readiness and the target today. */
  async list(userId: string, now = new Date()) {
    const { timeZone, today, calendar } = await this.today(userId, now)
    const rows = await this.db.exam.findMany({ where: { userId, date: { gte: date(addDays(today, -EXAM_LIMITS.keptDays)) } }, include: { topics: { orderBy: { position: 'asc' } }, tasks: { orderBy: { day: 'asc' } } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] })
    return this.shape(userId, rows, today, calendar, timeZone, now)
  }

  async one(userId: string, id: string, now = new Date()) {
    const { timeZone, today, calendar } = await this.today(userId, now)
    const row = await this.db.exam.findFirst({ where: { id, userId }, include: { topics: { orderBy: { position: 'asc' } }, tasks: { orderBy: { day: 'asc' } } } })
    return row ? (await this.shape(userId, [row], today, calendar, timeZone, now))[0]! : null
  }

  private async shape(userId: string, rows: ExamRow[], today: string, calendar: string, timeZone: string, now: Date) {
    if (!rows.length) return []
    const keys = [...new Set(rows.flatMap((e) => e.topics.map((t) => t.topicKey)))]
    const aliases = await this.aliases(userId, keys)
    const [mastery, done] = await Promise.all([this.mastery(userId, keys, aliases, now), this.doneTasks(userId, rows.flatMap((e) => e.tasks), aliases, timeZone)])
    return rows.map((e) => {
      const topics = e.topics.map((t) => ({ key: t.topicKey, title: t.title, topicId: t.topicKey.startsWith('topic:') ? t.topicKey.slice(6) : null, ...mastery.get(t.topicKey)! }))
      const examDate = day(e.date)
      return {
        id: e.id,
        name: e.name,
        date: examDate,
        daysLeft: daysLeft(calendar, examDate),
        past: examDate < today,
        topics,
        tasks: e.tasks.map((t) => ({ id: t.id, day: day(t.day), topics: t.topicKeys.map((k) => ({ key: k, title: e.topics.find((x) => x.topicKey === k)?.title ?? k })), done: done.has(t.id), today: day(t.day) === today })),
        readiness: readinessOf(topics.map((t) => t.mastery)),
        target: READINESS_TARGET,
        targetToday: targetOn({ added: learningDay(e.createdAt, timeZone), examDate, today }),
      }
    })
  }

  /** Each topic key with the /core page key that counts for it too (ADR-0070: curated topics are /core pages). */
  private async aliases(userId: string, keys: string[]): Promise<Map<string, string[]>> {
    const refs = await this.topics.usable(userId, keys.filter((k) => k.startsWith('topic:')).map((k) => k.slice(6)))
    const core = new Map(refs.map((r) => [r.key, r.coreKey]))
    return new Map(keys.map((k) => [k, [k, ...(core.get(k) ? [core.get(k)!] : [])]]))
  }

  /** Recall (mean FSRS retrievability of the topic's studied cards), accuracy (last 3 quiz results) and mastery. */
  private async mastery(userId: string, keys: string[], aliases: Map<string, string[]>, now: Date) {
    const reviews = await this.db.cardReview.findMany({ where: { userId, state: { not: 0 } } })
    const topicsOfNotes = await this.topics.ofNotes([...new Set(reviews.map((r) => r.noteId))])
    const recallSum = new Map<string, { sum: number; n: number }>()
    for (const r of reviews) {
      const value = this.reviews.retrievability(r, now)
      for (const id of topicsOfNotes.get(r.noteId) ?? []) {
        const s = recallSum.get(`topic:${id}`) ?? { sum: 0, n: 0 }
        recallSum.set(`topic:${id}`, { sum: s.sum + value, n: s.n + 1 })
      }
    }
    const results = await this.results(userId, [...new Set(keys.flatMap((k) => aliases.get(k) ?? [k]))])
    return new Map(
      keys.map((k) => {
        const s = recallSum.get(k)
        const recall = s ? s.sum / s.n : null
        const accuracy = accuracyOf((aliases.get(k) ?? [k]).flatMap((a) => results.get(a) ?? []).sort((a, b) => b.at.getTime() - a.at.getTime()))
        return [k, { recall, accuracy, mastery: masteryOf(recall, accuracy) }]
      }),
    )
  }

  /** Each key's quiz results, newest first, the last three. */
  private async results(userId: string, keys: string[]) {
    const out = new Map<string, { at: Date; answered: number; correct: number }[]>()
    if (!keys.length) return out
    const rows = await this.db.$queryRaw<{ topicKey: string; at: Date; answered: number; correct: number }[]>`
      SELECT "topicKey", "at", "answered", "correct" FROM (
        SELECT *, row_number() OVER (PARTITION BY "topicKey" ORDER BY "at" DESC) AS n
        FROM "core"."TopicQuizResult" WHERE "userId" = ${userId}::uuid AND "topicKey" = ANY(${keys})
      ) r WHERE n <= 3 ORDER BY "at" DESC`
    for (const r of rows) out.set(r.topicKey, [...(out.get(r.topicKey) ?? []), r])
    return out
  }

  /** The tasks done (ADR-0070 item 4): 10 minutes on their topics that day, or a quiz answered on them. */
  private async doneTasks(userId: string, tasks: { id: string; day: Date; topicKeys: string[] }[], aliases: Map<string, string[]>, timeZone: string): Promise<Set<string>> {
    const done = new Set<string>()
    if (!tasks.length) return done
    const keysOf = (t: { topicKeys: string[] }) => [...new Set(t.topicKeys.flatMap((k) => aliases.get(k) ?? [k]))]
    const allKeys = [...new Set(tasks.flatMap(keysOf))]
    const days = [...new Set(tasks.map((t) => day(t.day)))].sort()
    const [time, quizzes] = await Promise.all([
      this.db.learningDayTopic.findMany({ where: { userId, topicKey: { in: allKeys }, day: { in: days.map(date) } } }),
      this.db.topicQuizResult.findMany({ where: { userId, topicKey: { in: allKeys }, at: { gte: dayBounds(days[0]!, timeZone).from, lt: dayBounds(days.at(-1)!, timeZone).to } } }),
    ])
    for (const t of tasks) {
      const keys = new Set(keysOf(t))
      const d = day(t.day)
      const seconds = time.filter((r) => day(r.day) === d && keys.has(r.topicKey)).reduce((s, r) => s + r.seconds + r.legacySeconds, 0)
      const { from, to } = dayBounds(d, timeZone)
      if (seconds >= TASK_SECONDS || quizzes.some((q) => keys.has(q.topicKey) && q.at >= from && q.at < to)) done.add(t.id)
    }
    return done
  }

  // ── Quiz results, weak topics ───────────────────────────────────────────────────────────────────────────────────

  /** QUIZ_COMPLETED events with topics and `{ answered, correct }` become a result on each topic. */
  private async keepQuizResults(userId: string, eventIds: string[]): Promise<void> {
    try {
      const rows = await this.db.$queryRaw<{ id: string; topicKeys: string[]; metadata: Record<string, unknown> | null; clientTs: Date }[]>`
        SELECT "id", "topicKeys", "metadata", "clientTs" FROM "learning"."LearningEvent"
        WHERE "userId" = ${userId}::uuid AND "id" = ANY(${eventIds}::uuid[]) AND "type" = ${LearningEventType.QUIZ_COMPLETED} AND cardinality("topicKeys") > 0`
      const data = rows.flatMap((e) => {
        // Out of the questions asked: a question left unanswered counts as not known.
        const total = Number(e.metadata?.total)
        const answered = Number.isInteger(total) && total >= Number(e.metadata?.answered) ? total : Number(e.metadata?.answered)
        const correct = Number(e.metadata?.correct)
        if (!Number.isInteger(answered) || !Number.isInteger(correct) || answered < 1 || answered > 500 || correct < 0 || correct > answered) return []
        return e.topicKeys.map((topicKey) => ({ userId, topicKey, eventId: e.id, at: e.clientTs, answered, correct }))
      })
      if (data.length) await this.db.topicQuizResult.createMany({ data, skipDuplicates: true })
    } catch (e) {
      this.log.warn(`could not keep quiz results for ${userId}: ${(e as Error).message}`)
    }
  }

  /**
   * Weak topics (§14.2): under 60 % right over a topic's last 3 quiz results, or a topic of an exam in the next 14 days
   * with no time on it in the last 14. Each says why; an exam's comes first, soonest exam first.
   */
  async weakTopics(userId: string, now = new Date()): Promise<WeakTopic[]> {
    const { today, calendar } = await this.today(userId, now)
    const out = new Map<string, WeakTopic>()
    // Not revisited before an exam.
    const soon = await this.db.exam.findMany({ where: { userId, date: { gte: date(today), lte: date(addDays(today, REVISIT_DAYS)) } }, include: { topics: { orderBy: { position: 'asc' } } }, orderBy: { date: 'asc' } })
    const examKeys = [...new Set(soon.flatMap((e) => e.topics.map((t) => t.topicKey)))]
    const aliases = await this.aliases(userId, examKeys)
    const visited = new Set(
      (await this.db.learningDayTopic.findMany({ where: { userId, topicKey: { in: [...new Set([...aliases.values()].flat())] }, day: { gte: date(addDays(today, -REVISIT_DAYS)) } }, select: { topicKey: true, seconds: true, legacySeconds: true } }))
        .filter((r) => r.seconds + r.legacySeconds > 0)
        .map((r) => r.topicKey),
    )
    const results = await this.results(userId, (await this.db.topicQuizResult.findMany({ where: { userId }, distinct: ['topicKey'], select: { topicKey: true } })).map((r) => r.topicKey))
    for (const e of soon) {
      for (const t of e.topics) {
        if (out.has(t.topicKey) || (aliases.get(t.topicKey) ?? [t.topicKey]).some((k) => visited.has(k))) continue
        const accuracy = accuracyOf(results.get(t.topicKey) ?? [])
        out.set(t.topicKey, { key: t.topicKey, title: t.title, topicId: t.topicKey.startsWith('topic:') ? t.topicKey.slice(6) : null, reason: 'NOT_REVISITED', accuracy, examId: e.id, examName: e.name, daysLeft: daysLeft(calendar, day(e.date)) })
      }
    }
    // Low accuracy, lowest first.
    const low = [...results.entries()].map(([key, r]) => ({ key, accuracy: accuracyOf(r) })).filter((r): r is { key: string; accuracy: number } => r.accuracy !== null && r.accuracy < WEAK_ACCURACY && !out.has(r.key)).sort((a, b) => a.accuracy - b.accuracy)
    const titles = new Map((await this.topics.usable(userId, low.filter((l) => l.key.startsWith('topic:')).map((l) => l.key.slice(6)))).map((r) => [r.key, r.title]))
    for (const l of low) {
      if (l.key.startsWith('topic:') && !titles.has(l.key)) continue // a topic the person may no longer use
      const exam = soon.find((e) => e.topics.some((t) => t.topicKey === l.key))
      out.set(l.key, { key: l.key, title: titles.get(l.key) ?? null, topicId: l.key.startsWith('topic:') ? l.key.slice(6) : null, reason: 'LOW_ACCURACY', accuracy: l.accuracy, examId: exam?.id ?? null, examName: exam?.name ?? null, daysLeft: exam ? daysLeft(calendar, day(exam.date)) : null })
    }
    return [...out.values()]
  }

  // ── Rhythm: today's ring items and the suggestion ───────────────────────────────────────────────────────────────

  /** Today's plan tasks (done of all) and one weak topic (done at 10 minutes on it today), for the Today ring. */
  async ringItems(userId: string, now = new Date()) {
    const { timeZone, today } = await this.today(userId, now)
    const tasks = await this.db.examPlanTask.findMany({ where: { userId, day: date(today) }, include: { exam: { select: { name: true } } } })
    const items: { kind: 'PLAN_TASK' | 'WEAK_TOPIC'; done: number; total: number; title: string | null; topicKey: string | null }[] = []
    if (tasks.length) {
      const aliases = await this.aliases(userId, [...new Set(tasks.flatMap((t) => t.topicKeys))])
      const done = await this.doneTasks(userId, tasks, aliases, timeZone)
      items.push({ kind: 'PLAN_TASK', done: tasks.filter((t) => done.has(t.id)).length, total: tasks.length, title: [...new Set(tasks.map((t) => t.exam.name))].join(', '), topicKey: null })
    }
    const weak = (await this.weakTopics(userId, now))[0]
    if (weak) {
      const keys = (await this.aliases(userId, [weak.key])).get(weak.key) ?? [weak.key]
      const seconds = (await this.db.learningDayTopic.findMany({ where: { userId, day: date(today), topicKey: { in: keys } } })).reduce((s, r) => s + r.seconds + r.legacySeconds, 0)
      items.push({ kind: 'WEAK_TOPIC', done: seconds >= TASK_SECONDS ? 1 : 0, total: 1, title: weak.title, topicKey: weak.key })
    }
    return items
  }

  /** Three weeks before an exam, one more planned day a week (up to 6) is suggested; nothing changes by itself. */
  async suggestion(userId: string, plannedDays: number, now = new Date()) {
    if (plannedDays >= 6) return null
    const { today, calendar } = await this.today(userId, now)
    const exam = await this.db.exam.findFirst({ where: { userId, date: { gte: date(today), lte: date(addDays(calendar, SUGGEST_DAYS)) } }, orderBy: { date: 'asc' } })
    return exam ? { plannedDays: plannedDays + 1, examId: exam.id, examName: exam.name, daysLeft: daysLeft(calendar, day(exam.date)) } : null
  }

  // ── Reminders ───────────────────────────────────────────────────────────────────────────────────────────────────

  /** Hourly: from 18:00 in each person's zone, one reminder of a revision task left today (ADR-0070 item 8). */
  async remind(now = new Date()): Promise<number> {
    const candidates = await this.db.examPlanTask.findMany({
      where: { remindedAt: null, day: { gte: date(addDays(day(now), -1)), lte: date(addDays(day(now), 1)) } },
      include: { exam: { select: { name: true, topics: true } } },
    })
    let sent = 0
    for (const t of candidates) {
      const timeZone = await this.learning.timeZoneOf(t.userId)
      if (learningDay(now, timeZone) !== day(t.day)) continue
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now))
      if (hour < REMIND_HOUR) continue
      const aliases = await this.aliases(t.userId, t.topicKeys)
      if ((await this.doneTasks(t.userId, [t], aliases, timeZone)).has(t.id)) continue
      const claimed = await this.db.examPlanTask.updateMany({ where: { id: t.id, remindedAt: null }, data: { remindedAt: now } })
      if (!claimed.count) continue
      const topics = t.topicKeys.map((k) => t.exam.topics.find((x) => x.topicKey === k)?.title ?? k)
      await this.events.publish('ExamTaskDue', { userId: t.userId, examId: t.examId, examName: t.exam.name, topics })
      sent++
    }
    return sent
  }

  // ── Export, erasure ─────────────────────────────────────────────────────────────────────────────────────────────

  async exportFor(userId: string) {
    const [exams, results] = await Promise.all([
      this.db.exam.findMany({ where: { userId }, include: { topics: { orderBy: { position: 'asc' } }, tasks: { orderBy: { day: 'asc' } } }, orderBy: { date: 'asc' } }),
      this.db.topicQuizResult.findMany({ where: { userId }, orderBy: { at: 'asc' } }),
    ])
    return {
      exams: exams.map((e) => ({ id: e.id, name: e.name, date: day(e.date), createdAt: e.createdAt, topics: e.topics.map((t) => ({ key: t.topicKey, title: t.title })), tasks: e.tasks.map((t) => ({ day: day(t.day), topicKeys: t.topicKeys })) })),
      quizResults: results.map(({ userId: _u, ...r }) => r),
    }
  }

  async erase(userId: string): Promise<void> {
    await this.db.exam.deleteMany({ where: { userId } })
    await this.db.topicQuizResult.deleteMany({ where: { userId } })
  }
}

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, type People } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { countsForRhythm, learningDay } from '../domain/learning-day'
import { addDays, DEFAULT_PLANNED_DAYS, PAUSE_DAYS_PER_TERM, pauseDaysUsed, termStart, validPlan, weekStart, weekState, type Pause, type WeekState } from '../domain/rhythm'
import { ExamsService } from './exams.service'
import { LearningEventsService } from './learning-events.service'
import { ReviewsService } from './reviews.service'

export type PauseReason = 'EXAMS' | 'ILLNESS' | 'FESTIVAL' | 'TRAVEL' | 'OTHER'
const day = (d: Date) => d.toISOString().slice(0, 10)
const date = (d: string) => new Date(`${d}T00:00:00Z`)
const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Rhythm (ADR-0030, ADR-0069): this week by learning day in the learner's time zone (planned days, misses, rest,
 * pauses, comebacks), the counters that never reset, today's ring, and the plan and pauses. Past weeks are closed
 * hourly, each in its person's zone, with the target they had; a late event reopens its week.
 */
@Injectable()
export class RhythmService implements OnModuleInit {
  private readonly log = new Logger('Rhythm')

  constructor(
    private readonly db: PrismaService,
    private readonly learning: LearningEventsService,
    private readonly reviews: ReviewsService,
    private readonly exams: ExamsService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('LearningEventRecorded', ({ payload }) => this.reopen(payload.userId, payload.eventIds))
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  async plannedDays(userId: string): Promise<number[]> {
    return (await this.db.learnerSettings.findUnique({ where: { userId }, select: { plannedDays: true } }))?.plannedDays ?? [...DEFAULT_PLANNED_DAYS]
  }

  async setPlan(userId: string, days: number[]): Promise<void> {
    const sorted = [...days].sort((a, b) => a - b)
    if (!validPlan(sorted)) throw Errors.validation('Pick 3 to 6 days of the week.', ['input', 'plannedDays'])
    await this.db.learnerSettings.upsert({ where: { userId }, create: { userId, plannedDays: sorted }, update: { plannedDays: sorted } })
  }

  private async pauses(userId: string): Promise<(Pause & { id: string; reason: PauseReason })[]> {
    const rows = await this.db.rhythmPause.findMany({ where: { userId }, orderBy: { from: 'asc' } })
    return rows.map((p) => ({ id: p.id, from: day(p.from), to: day(p.to), reason: p.reason }))
  }

  /** A pause from today or later, at most 14 days a term in all, not over another pause. */
  async pause(userId: string, input: { from: string; to: string; reason: PauseReason }): Promise<void> {
    if (!DAY.test(input.from) || !DAY.test(input.to)) throw Errors.validation('Days are written YYYY-MM-DD.', ['input'])
    const today = learningDay(new Date(), await this.learning.timeZoneOf(userId))
    if (input.from < today) throw Errors.validation('A pause starts today or later.', ['input', 'from'])
    if (input.to < input.from) throw Errors.validation('A pause ends on or after the day it starts.', ['input', 'to'])
    const existing = await this.pauses(userId)
    if (existing.some((p) => p.from <= input.to && input.from <= p.to)) throw Errors.conflict('These days are already paused.', ['input'])
    const all = [...existing, input]
    for (const term of new Set([termStart(input.from), termStart(input.to)])) {
      if (pauseDaysUsed(term, all) > PAUSE_DAYS_PER_TERM) throw Errors.validation(`Rhythm can pause for ${PAUSE_DAYS_PER_TERM} days a term; this would go past that.`, ['input', 'to'])
    }
    await this.db.rhythmPause.create({ data: { id: newId(), userId, from: date(input.from), to: date(input.to), reason: input.reason } })
  }

  /** Ends a pause early: the days it did not use come back. One not started yet goes. */
  async endPause(userId: string, id: string): Promise<void> {
    const pause = await this.db.rhythmPause.findFirst({ where: { id, userId } })
    if (!pause) throw Errors.notFound('That pause is not there.')
    const today = learningDay(new Date(), await this.learning.timeZoneOf(userId))
    if (day(pause.from) >= today) await this.db.rhythmPause.delete({ where: { id } })
    else await this.db.rhythmPause.update({ where: { id }, data: { to: date(addDays(today, -1)) } })
  }

  /** Learning days in [from, to] that count (ADR-0030's bar), the old site's days included. */
  private async countedDays(userId: string, from: string, to: string): Promise<Set<string>> {
    const rows = await this.db.learningDay.findMany({ where: { userId, day: { gte: date(from), lte: date(to) } } })
    return new Set(rows.filter((r) => countsForRhythm({ learningSeconds: r.learningSeconds + r.legacyLearningSeconds, reviews: r.reviews })).map((r) => day(r.day)))
  }

  /** The person's first day: the earlier of joining and their first learning day (old-site days included). */
  private async since(userId: string, timeZone: string): Promise<string | undefined> {
    const [joined, first] = await Promise.all([this.people.joinedAt(userId), this.db.learningDay.findFirst({ where: { userId }, orderBy: { day: 'asc' }, select: { day: true } })])
    return [joined ? learningDay(joined, timeZone) : null, first ? day(first.day) : null].filter((d): d is string => !!d).sort()[0]
  }

  private async week(userId: string, start: string, today: string, plannedDays: number[], pauses: Pause[]): Promise<WeekState> {
    // A week back too, for "the day after a miss" at the week's start.
    const [counted, since] = await Promise.all([this.countedDays(userId, addDays(start, -7), addDays(start, 6)), this.since(userId, await this.learning.timeZoneOf(userId))])
    return weekState({ today, since, plannedDays, counted, pauses }, start)
  }

  /** This week at a glance, for buddies and the classroom ring (ADR-0072). */
  async weekSummary(userId: string, now = new Date()): Promise<{ countedDays: number; target: number; met: boolean }> {
    const today = learningDay(now, await this.learning.timeZoneOf(userId))
    const [plannedDays, pauses] = await Promise.all([this.plannedDays(userId), this.pauses(userId)])
    const w = await this.week(userId, weekStart(today), today, plannedDays, pauses)
    return { countedDays: w.countedDays, target: w.target, met: w.met }
  }

  /** Whether the person's name and counted days show on their classes' Rhythm ring (ADR-0072). */
  async sharing(userId: string): Promise<boolean> {
    return (await this.db.learnerSettings.findUnique({ where: { userId }, select: { shareRhythm: true } }))?.shareRhythm ?? false
  }

  async setSharing(userId: string, share: boolean): Promise<void> {
    await this.db.learnerSettings.upsert({ where: { userId }, create: { userId, shareRhythm: share }, update: { shareRhythm: share } })
  }

  async rhythm(userId: string, now = new Date()) {
    const timeZone = await this.learning.timeZoneOf(userId)
    const today = learningDay(now, timeZone)
    const [plannedDays, pauses, todayRow, queue, examItems] = await Promise.all([
      this.plannedDays(userId),
      this.pauses(userId),
      this.db.learningDay.findUnique({ where: { userId_day: { userId, day: date(today) } } }),
      this.reviews.queue(userId, now),
      this.exams.ringItems(userId, now),
    ])
    const week = await this.week(userId, weekStart(today), today, plannedDays, pauses)
    const term = termStart(today)
    const [metThisTerm, metAllTime, countedAllTime] = await Promise.all([
      this.db.rhythmWeek.count({ where: { userId, met: true, weekStart: { gte: date(term), lt: date(week.weekStart) } } }),
      this.db.rhythmWeek.count({ where: { userId, met: true, weekStart: { lt: date(week.weekStart) } } }),
      this.db.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS "n" FROM "core"."LearningDay"
        WHERE "userId" = ${userId}::uuid AND ("learningSeconds" + "legacyLearningSeconds" >= 600 OR "reviews" >= 10)`,
    ])
    const learningSeconds = (todayRow?.learningSeconds ?? 0) + (todayRow?.legacyLearningSeconds ?? 0)
    const reviews = todayRow?.reviews ?? 0
    return {
      timeZone,
      plannedDays,
      target: week.target,
      countedDays: week.countedDays,
      met: week.met,
      week: week.days,
      today: {
        day: today,
        learningSeconds,
        reviews,
        counted: countsForRhythm({ learningSeconds, reviews }),
        comeback: week.comebackToday,
        cameBack: week.cameBackToday,
        // The ring (ADR-0030, ADR-0070): today's reviews, today's exam-plan tasks and one weak topic.
        items: [{ kind: 'REVIEWS', done: queue.doneToday, total: queue.doneToday + queue.cards.length, title: null, topicKey: null }, ...examItems],
      },
      weeksThisTerm: metThisTerm + (week.met ? 1 : 0),
      weeksAllTime: metAllTime + (week.met ? 1 : 0),
      countedDaysAllTime: Number(countedAllTime[0]?.n ?? 0),
      pauses: pauses.filter((p) => p.to >= today).map((p) => ({ ...p, active: p.from <= today })),
      pauseDaysLeft: Math.max(PAUSE_DAYS_PER_TERM - pauseDaysUsed(term, pauses), 0),
      suggestion: await this.exams.suggestion(userId, plannedDays.length, now),
      shareRhythm: await this.sharing(userId),
    }
  }

  /** Closes (or closes again) one person's week, with today's plan as its target. */
  async closeWeek(userId: string, start: string): Promise<WeekState> {
    const [plannedDays, pauses] = await Promise.all([this.plannedDays(userId), this.pauses(userId)])
    const closed = await this.db.rhythmWeek.findUnique({ where: { userId_weekStart: { userId, weekStart: date(start) } } })
    // A week closed before keeps the target it had; the plan of the day applies from the current week on.
    const week = await this.week(userId, start, addDays(start, 7), plannedDays, pauses)
    const target = closed ? closed.targetDays : week.target
    const data = { targetDays: target, countedDays: week.countedDays, comebacks: week.comebacks, pausedDays: week.pausedDays, met: week.countedDays >= target }
    await this.db.rhythmWeek.upsert({ where: { userId_weekStart: { userId, weekStart: date(start) } }, create: { userId, weekStart: date(start), ...data }, update: { ...data, closedAt: new Date() } })
    return week
  }

  /**
   * Hourly: last week, for everyone with learning days lately whose last week is not closed yet, in their own time
   * zone. A week already closed is left to late events, which close it again.
   */
  async closeLastWeeks(now = new Date()): Promise<number> {
    const people = await this.db.$queryRaw<{ userId: string; timeZone: string | null }[]>`
      SELECT DISTINCT d."userId", s."timeZone" FROM "core"."LearningDay" d LEFT JOIN "core"."LearnerSettings" s ON s."userId" = d."userId"
      WHERE d."day" >= ${date(addDays(day(now), -15))}`
    let closed = 0
    for (const p of people) {
      const lastWeek = addDays(weekStart(learningDay(now, p.timeZone ?? 'UTC')), -7)
      if (await this.db.rhythmWeek.count({ where: { userId: p.userId, weekStart: date(lastWeek) } })) continue
      await this.closeWeek(p.userId, lastWeek)
      closed++
    }
    return closed
  }

  /** Events that land in a closed week (a phone that was offline) close it again. */
  private async reopen(userId: string, eventIds: string[]): Promise<void> {
    try {
      const timeZone = await this.learning.timeZoneOf(userId)
      const rows = await this.db.$queryRaw<{ clientTs: Date }[]>`SELECT "clientTs" FROM "learning"."LearningEvent" WHERE "userId" = ${userId}::uuid AND "id" = ANY(${eventIds}::uuid[])`
      const weeks = new Set(rows.map((r) => weekStart(learningDay(r.clientTs, timeZone))))
      for (const start of weeks) {
        if (await this.db.rhythmWeek.count({ where: { userId, weekStart: date(start) } })) await this.closeWeek(userId, start)
      }
    } catch (e) {
      this.log.warn(`could not reopen weeks for ${userId}: ${(e as Error).message}`)
    }
  }

  async exportFor(userId: string) {
    const [weeks, pauses] = await Promise.all([this.db.rhythmWeek.findMany({ where: { userId }, orderBy: { weekStart: 'asc' } }), this.pauses(userId)])
    return { plannedDays: await this.plannedDays(userId), weeks: weeks.map(({ userId: _u, ...w }) => w), pauses }
  }

  async erase(userId: string): Promise<void> {
    await this.db.rhythmWeek.deleteMany({ where: { userId } })
    await this.db.rhythmPause.deleteMany({ where: { userId } })
  }
}

import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { TOPICS, type Topics } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { WEAK_ACCURACY } from '../domain/exams'
import { dayBounds, learningDay } from '../domain/learning-day'
import { addDays, weekStart } from '../domain/rhythm'
import { NEEDS_TOPIC, SUGGESTED, TAKES_TOPIC, TASK_LIMITS, type WeeklyTaskKindName } from '../domain/tasks'
import { ExamsService } from './exams.service'
import { LearningEventsService } from './learning-events.service'

export interface TaskView {
  id: string
  kind: WeeklyTaskKindName
  target: number
  topicId: string | null
  topicTitle: string | null
  plan: string | null
  progress: number
  done: boolean
}

export interface TaskSuggestion {
  kind: WeeklyTaskKindName
  target: number
  topicId: string | null
  topicTitle: string | null
  why: string
}

type Week = { start: string; end: string; from: Date; to: Date }
const date = (day: string) => new Date(`${day}T00:00:00Z`)

/**
 * Weekly tasks (ADR-0081): up to three goals a person picks for their Rhythm week, often from suggestions drawn from
 * their exams, weak topics and flashcards due, with a "when and where" plan. Progress is read from what learning
 * events recorded; nothing is stored about it, and an unfinished task just ends with the week.
 */
@Injectable()
export class WeeklyTasksService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly learning: LearningEventsService,
    private readonly exams: ExamsService,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /** The person's Rhythm week now: Monday to Sunday in their zone, from 04:00 to 04:00. */
  private async week(userId: string, now: Date): Promise<Week> {
    const zone = await this.learning.timeZoneOf(userId)
    const start = weekStart(learningDay(now, zone))
    const end = addDays(start, 6)
    return { start, end, from: dayBounds(start, zone).from, to: dayBounds(end, zone).to }
  }

  async list(userId: string, now = new Date()): Promise<{ weekStart: string; tasks: TaskView[] }> {
    const week = await this.week(userId, now)
    const rows = await this.db.weeklyTask.findMany({ where: { userId, weekStart: date(week.start) }, orderBy: { createdAt: 'asc' } })
    const tasks: TaskView[] = []
    for (const r of rows) {
      const progress = await this.progress(userId, r.kind, r.topicKey, week)
      tasks.push({ id: r.id, kind: r.kind, target: r.target, topicId: r.topicKey?.startsWith('topic:') ? r.topicKey.slice(6) : null, topicTitle: r.topicTitle, plan: r.plan, progress, done: progress >= r.target })
    }
    return { weekStart: week.start, tasks }
  }

  /** How far a task has come this week, from the learning days and quiz results. */
  private async progress(userId: string, kind: WeeklyTaskKindName, topicKey: string | null, week: Week): Promise<number> {
    const days = { gte: date(week.start), lte: date(week.end) }
    switch (kind) {
      case 'REVIEWS':
        return (await this.db.learningDay.aggregate({ where: { userId, day: days }, _sum: { reviews: true } }))._sum.reviews ?? 0
      case 'QUIZ_ANSWERS':
        if (!topicKey) return (await this.db.learningDay.aggregate({ where: { userId, day: days }, _sum: { quizAnswers: true } }))._sum.quizAnswers ?? 0
        return (await this.db.topicQuizResult.aggregate({ where: { userId, topicKey, at: { gte: week.from, lt: week.to } }, _sum: { answered: true } }))._sum.answered ?? 0
      case 'TOPIC_MINUTES':
        return Math.floor(((await this.db.learningDayTopic.aggregate({ where: { userId, topicKey: topicKey ?? '', day: days }, _sum: { seconds: true } }))._sum.seconds ?? 0) / 60)
    }
  }

  /**
   * What to aim at this week: the next exam's weakest topic, a topic whose answers were mostly wrong lately, and the
   * flashcards due; never one already set.
   */
  async suggestions(userId: string, now = new Date()): Promise<TaskSuggestion[]> {
    const week = await this.week(userId, now)
    const set = await this.db.weeklyTask.findMany({ where: { userId, weekStart: date(week.start) }, select: { kind: true, topicKey: true } })
    const taken = (kind: WeeklyTaskKindName, topicId: string | null) => set.some((t) => t.kind === kind && (t.topicKey ?? null) === (topicId ? `topic:${topicId}` : null))
    const out: TaskSuggestion[] = []
    const next = (await this.exams.list(userId, now)).filter((e) => !e.past && e.topics.length).sort((a, b) => a.daysLeft - b.daysLeft)[0]
    const weakest = next?.topics.filter((t) => t.topicId).sort((a, b) => a.mastery - b.mastery)[0]
    if (next && weakest && !taken('TOPIC_MINUTES', weakest.topicId)) {
      out.push({
        kind: 'TOPIC_MINUTES',
        target: SUGGESTED.examTopicMinutes,
        topicId: weakest.topicId,
        topicTitle: weakest.title,
        why: `${next.name} is in ${next.daysLeft === 1 ? '1 day' : `${next.daysLeft} days`}, and ${weakest.title} is its weakest topic.`,
      })
    }
    const results = await this.db.topicQuizResult.groupBy({ by: ['topicKey'], where: { userId, topicKey: { startsWith: 'topic:' }, at: { gte: new Date(now.getTime() - 28 * 86_400_000) } }, _sum: { answered: true, correct: true } })
    const weak = results.filter((r) => (r._sum.answered ?? 0) >= 5 && (r._sum.correct ?? 0) / (r._sum.answered ?? 1) < WEAK_ACCURACY).map((r) => r.topicKey.slice(6))
    const titles = new Map((await this.topics.usable(userId, weak)).map((t) => [t.id, t.title]))
    for (const id of weak) {
      if (out.length >= 3 || !titles.has(id) || taken('QUIZ_ANSWERS', id)) continue
      out.push({ kind: 'QUIZ_ANSWERS', target: SUGGESTED.weakTopicAnswers, topicId: id, topicTitle: titles.get(id)!, why: `Fewer than six in ten of your answers on ${titles.get(id)} were right lately.` })
    }
    if (!taken('REVIEWS', null)) {
      const due = await this.db.cardReview.count({ where: { userId, due: { lt: week.to } } })
      if (due >= TASK_LIMITS.target.REVIEWS.min) out.push({ kind: 'REVIEWS', target: Math.min(due, SUGGESTED.reviewsCap), topicId: null, topicTitle: null, why: `${due === 1 ? '1 flashcard is' : `${due} flashcards are`} due by Sunday.` })
      else if (await this.db.cardReview.count({ where: { userId } })) out.push({ kind: 'REVIEWS', target: SUGGESTED.fallbackReviews, topicId: null, topicTitle: null, why: 'Reviewing keeps what you learned.' })
    }
    return out
  }

  async add(userId: string, input: { kind: WeeklyTaskKindName; target: number; topicId?: string | null; plan?: string | null }, now = new Date()): Promise<string> {
    const week = await this.week(userId, now)
    if ((await this.db.weeklyTask.count({ where: { userId, weekStart: date(week.start) } })) >= TASK_LIMITS.perWeek) throw Errors.validation(`You have ${TASK_LIMITS.perWeek} tasks this week. Finish or remove one first.`)
    this.checkTarget(input.kind, input.target)
    if (NEEDS_TOPIC.has(input.kind) && !input.topicId) throw Errors.validation('Choose the topic.', ['input', 'topicId'])
    let topic: { key: string; title: string } | null = null
    if (input.topicId && TAKES_TOPIC.has(input.kind)) {
      const [found] = await this.topics.usable(userId, [input.topicId])
      if (!found) throw Errors.validation('That topic is not one you can use.', ['input', 'topicId'])
      topic = { key: found.key, title: found.title }
    }
    const id = newId()
    await this.db.weeklyTask.create({ data: { id, userId, weekStart: date(week.start), kind: input.kind, target: input.target, topicKey: topic?.key ?? null, topicTitle: topic?.title ?? null, plan: this.plan(input.plan) } })
    return id
  }

  async update(userId: string, input: { id: string; target?: number | null; plan?: string | null }): Promise<void> {
    const row = await this.db.weeklyTask.findFirst({ where: { id: input.id, userId } })
    if (!row) throw Errors.notFound('That task is not there any more.')
    if (input.target != null) this.checkTarget(row.kind, input.target)
    await this.db.weeklyTask.update({ where: { id: row.id }, data: { ...(input.target != null ? { target: input.target } : {}), ...(input.plan !== undefined ? { plan: this.plan(input.plan) } : {}) } })
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.weeklyTask.deleteMany({ where: { id, userId } })
  }

  private checkTarget(kind: WeeklyTaskKindName, target: number) {
    const { min, max } = TASK_LIMITS.target[kind]
    if (!Number.isInteger(target) || target < min || target > max) throw Errors.validation(`Choose a target from ${min} to ${max}.`, ['input', 'target'])
  }

  private plan(plan: string | null | undefined): string | null {
    const p = plan?.trim().replace(/\s+/g, ' ') ?? ''
    if (p.length > TASK_LIMITS.planChars) throw Errors.validation(`Keep the plan to ${TASK_LIMITS.planChars} characters.`, ['input', 'plan'])
    return p || null
  }

  async exportFor(userId: string) {
    return this.db.weeklyTask.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { weekStart: true, kind: true, target: true, topicTitle: true, plan: true, createdAt: true } })
  }

  async erase(userId: string): Promise<void> {
    await this.db.weeklyTask.deleteMany({ where: { userId } })
  }
}

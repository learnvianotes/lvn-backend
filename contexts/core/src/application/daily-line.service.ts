import { Inject, Injectable, Logger } from '@nestjs/common'
import { DAILY_LINES, type DailyLines } from '@lvn-backend/facades'
import { Queues } from '@lvn-backend/queue'
import { REDIS } from '@lvn-backend/redis'
import type Redis from 'ioredis'
import { chosenLine, spokenDay } from '../domain/daily-line'
import { learningDay } from '../domain/learning-day'
import { ExamsService } from './exams.service'
import { LearningEventsService } from './learning-events.service'
import { CORE_ENGAGEMENT_QUEUE } from './points.service'
import { RecommendationsService } from './recommendations.service'
import { RhythmService } from './rhythm.service'

/** How long a written line is kept: its day, and the next in case the time zone moves. */
const KEPT_SECONDS = 2 * 86_400
/** After AI could not write a line, Home shows the chosen one for this long before asking again. */
const RETRY_AFTER_SECONDS = 3_600

export interface DailyLineView {
  day: string
  title: string
  line: string
  fromAi: boolean
  pending: boolean
}

/**
 * Home's line for the day (ADR-0087). The first time a person opens Home on a learning day, AI is asked (on the
 * `core.engagement` queue) to write a headline and a sentence for them from a few facts about their learning; until
 * it is written, or when AI is off, a chosen line for the person and the day shows. Each line is kept in Redis for its
 * day, so it stays the same all day and changes the next.
 */
@Injectable()
export class DailyLineService {
  private readonly log = new Logger('DailyLine')

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly queues: Queues,
    private readonly learning: LearningEventsService,
    private readonly rhythm: RhythmService,
    private readonly exams: ExamsService,
    private readonly recommendations: RecommendationsService,
    @Inject(DAILY_LINES) private readonly writer: DailyLines,
  ) {}

  async forViewer(userId: string, now = new Date()): Promise<DailyLineView> {
    const day = learningDay(now, await this.learning.timeZoneOf(userId))
    const kept = await this.redis.get(key(userId, day)).catch(() => null)
    if (kept) return { day, ...(JSON.parse(kept) as { title: string; line: string }), fromAi: true, pending: false }
    const pending = !(await this.redis.exists(failedKey(userId, day)).catch(() => 0)) && (await this.writer.available().catch(() => false))
    if (pending) await this.queues.queue(CORE_ENGAGEMENT_QUEUE).add('daily-line', { userId, day }, { jobId: `line-${userId}-${day}`, removeOnComplete: true, removeOnFail: true })
    return { day, ...chosenLine(userId, day), fromAi: false, pending }
  }

  /** The worker's side: today's line written for the person, once. */
  async write(userId: string, day: string, now = new Date()): Promise<boolean> {
    if (await this.redis.exists(key(userId, day))) return false
    try {
      const written = await this.writer.write({ day: spokenDay(day), facts: await this.facts(userId, now), userId })
      await this.redis.set(key(userId, day), JSON.stringify(written), 'EX', KEPT_SECONDS)
      return true
    } catch (e) {
      this.log.warn(`daily line for ${userId} not written: ${(e as Error).message}`)
      await this.redis.set(failedKey(userId, day), '1', 'EX', RETRY_AFTER_SECONDS)
      return false
    }
  }

  /** A few facts the line may use: the week's rhythm, the next exam, the note last worked on and a topic to strengthen. */
  private async facts(userId: string, now: Date): Promise<string[]> {
    const [rhythm, exams, recs] = await Promise.all([this.rhythm.rhythm(userId, now).catch(() => null), this.exams.list(userId, now).catch(() => []), this.recommendations.list(userId, 8, now).catch(() => [])])
    const out: string[] = []
    if (rhythm) {
      if (!rhythm.countedDaysAllTime) out.push('Has not had a learning day in the app yet.')
      else out.push(`This week: ${rhythm.countedDays} of ${rhythm.target} planned learning days done${rhythm.met ? ', so the week is met' : ''}.`)
      if (rhythm.weeksAllTime) out.push(`${rhythm.weeksAllTime} rhythm ${rhythm.weeksAllTime === 1 ? 'week' : 'weeks'} met so far.`)
    }
    const exam = exams.find((e) => !e.past)
    if (exam) out.push(`Next exam: ${exam.name}, ${exam.daysLeft === 0 ? 'today' : exam.daysLeft === 1 ? 'tomorrow' : `in ${exam.daysLeft} days`}.`)
    const note = recs.find((r) => r.kind === 'CONTINUE_NOTE' && r.noteTitle)
    if (note) out.push(`Was last working on the note "${note.noteTitle}".`)
    const topic = recs.find((r) => (r.kind === 'REVISE_TOPIC' || r.kind === 'EXAM_TOPIC') && r.topicTitle)
    if (topic) out.push(`A topic to strengthen: ${topic.topicTitle}.`)
    return out
  }
}

const key = (userId: string, day: string) => `core:daily-line:${userId}:${day}`
const failedKey = (userId: string, day: string) => `core:daily-line-failed:${userId}:${day}`

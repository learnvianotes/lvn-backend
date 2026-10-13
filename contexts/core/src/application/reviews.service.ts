import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import type * as Fsrs from 'ts-fsrs' with { 'resolution-mode': 'import' }
import type { Card, Grade } from 'ts-fsrs' with { 'resolution-mode': 'import' }
import { LearningEventType } from '@lvn/contracts/domain'
import { REVIEW_LIMITS } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { NOTE_ACCESS, type NoteAccess, type StudyCard } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { dayBounds, learningDay } from '../domain/learning-day'
import { LearningEventsService } from './learning-events.service'

// ts-fsrs is an ES module with a CommonJS build (its `require` export), which this CommonJS package loads.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createEmptyCard, fsrs, generatorParameters, Rating, State } = require('ts-fsrs') as typeof Fsrs

export type ReviewRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'
const RATINGS: Record<ReviewRating, Grade> = { AGAIN: Rating.Again, HARD: Rating.Hard, GOOD: Rating.Good, EASY: Rating.Easy }
const STATES = ['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'] as const
export type ReviewState = (typeof STATES)[number]

type ReviewRow = Prisma.CardReviewGetPayload<object>

/** FSRS v6 as ADR-0068 sets it: 90 % requested retention, a year at most between reviews, intervals fuzzed. */
const scheduler = fsrs(generatorParameters({ request_retention: REVIEW_LIMITS.retention, maximum_interval: REVIEW_LIMITS.maxIntervalDays, enable_fuzz: true }))

export interface QueueCard extends StudyCard {
  state: ReviewState
  due: Date | null
}

/**
 * Flashcard reviews (§14.2, ADR-0068): the person's deck (their own notes' flashcards and those of notes they chose
 * to study, read as they read the note now), today's queue (due first, then new; 20 a day, 10 of them new), and grades
 * replayed in the order they were given, so a grade made offline lands where it belongs.
 */
@Injectable()
export class ReviewsService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly learning: LearningEventsService,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /** Every flashcard the person studies now. */
  async deck(userId: string): Promise<StudyCard[]> {
    const chosen = (await this.db.studyNote.findMany({ where: { userId }, select: { noteId: true } })).map((s) => s.noteId)
    return this.notes.studyCards(userId, chosen)
  }

  /** Today's queue: cards due by the end of the learning day, most overdue first, then new ones; done today counts. */
  async queue(userId: string, now = new Date()): Promise<{ cards: QueueCard[]; due: number; new: number; doneToday: number; waiting: number }> {
    const deck = await this.deck(userId)
    const timeZone = await this.learning.timeZoneOf(userId)
    const { from, to } = dayBounds(learningDay(now, timeZone), timeZone)
    const [reviews, doneToday, newDoneToday] = await Promise.all([
      this.db.cardReview.findMany({ where: { userId, cardId: { in: deck.map((c) => c.cardId) } } }),
      this.db.cardReviewLog.count({ where: { userId, reviewedAt: { gte: from, lt: to } } }),
      this.db.cardReview.count({ where: { userId, firstReviewAt: { gte: from, lt: to } } }),
    ])
    const byCard = new Map(reviews.map((r) => [r.cardId, r]))
    const due = deck.filter((c) => byCard.get(c.cardId) && byCard.get(c.cardId)!.due < to).sort((a, b) => byCard.get(a.cardId)!.due.getTime() - byCard.get(b.cardId)!.due.getTime())
    const fresh = deck.filter((c) => !byCard.has(c.cardId))
    // The day's room: 20 cards, of which at most 10 new; cards graded today already took their place.
    const room = Math.max(REVIEW_LIMITS.dailyCards - doneToday, 0)
    const newRoom = Math.max(Math.min(REVIEW_LIMITS.dailyNew - newDoneToday, room - Math.min(due.length, room)), 0)
    const picked = [...due.slice(0, room), ...fresh.slice(0, newRoom)]
    return {
      cards: picked.map((c) => {
        const r = byCard.get(c.cardId)
        return { ...c, state: r ? STATES[r.state]! : 'NEW', due: r?.due ?? null }
      }),
      due: due.length,
      new: fresh.length,
      doneToday,
      waiting: due.length + fresh.length - picked.length,
    }
  }

  /** One grade. The same clientOpId twice counts once; the card's state is its log replayed in order. */
  async review(userId: string, input: { cardId: string; rating: ReviewRating; reviewedAt?: string | null; durationMs?: number | null; clientOpId: string }) {
    const limit = await this.limiter.hit(`core:review:${userId}`, { max: 600, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'That is a lot of reviews in an hour. Take a break and come back.')
    const card = (await this.deck(userId)).find((c) => c.cardId === input.cardId)
    if (!card) throw Errors.notFound('This card is not in your reviews.')
    const now = Date.now()
    const at = input.reviewedAt ? new Date(Math.min(Math.max(Date.parse(input.reviewedAt), now - 30 * 86_400_000), now)) : new Date(now)
    if (Number.isNaN(at.getTime())) throw Errors.validation('reviewedAt is not a date.', ['input', 'reviewedAt'])
    const durationMs = Math.min(Math.max(input.durationMs ?? 0, 0), 30 * 60_000)
    const logged = await this.db.cardReviewLog.createMany({ data: [{ id: newId(), userId, cardId: input.cardId, rating: RATINGS[input.rating], reviewedAt: at, durationMs, clientOpId: input.clientOpId }], skipDuplicates: true })
    const state = await this.replay(userId, input.cardId, card.noteId)
    if (logged.count) await this.learning.record(userId, { type: LearningEventType.FLASHCARD_REVIEWED, entityType: 'CARD', entityId: input.cardId, durationMs, metadata: { rating: input.rating }, at })
    return state
  }

  /** Rebuilds a card's FSRS state from its log, oldest grade first. */
  private async replay(userId: string, cardId: string, noteId: string): Promise<{ cardId: string; due: Date; state: ReviewState; intervalDays: number }> {
    const log = await this.db.cardReviewLog.findMany({ where: { userId, cardId }, orderBy: [{ reviewedAt: 'asc' }, { id: 'asc' }] })
    let fsrsCard: Card = createEmptyCard(log[0]!.reviewedAt)
    for (const l of log) fsrsCard = scheduler.next(fsrsCard, l.reviewedAt, l.rating as Grade).card
    const data = {
      noteId,
      due: fsrsCard.due,
      stability: fsrsCard.stability,
      difficulty: fsrsCard.difficulty,
      scheduledDays: fsrsCard.scheduled_days,
      reps: fsrsCard.reps,
      lapses: fsrsCard.lapses,
      state: fsrsCard.state,
      learningSteps: fsrsCard.learning_steps,
      lastReview: fsrsCard.last_review ?? null,
      firstReviewAt: log[0]!.reviewedAt,
    }
    await this.db.cardReview.upsert({ where: { userId_cardId: { userId, cardId } }, create: { userId, cardId, ...data }, update: data })
    return { cardId, due: fsrsCard.due, state: STATES[fsrsCard.state]!, intervalDays: fsrsCard.scheduled_days }
  }

  /** "Study these cards" on a note the person can read. */
  async study(userId: string, noteId: string): Promise<void> {
    if (!(await this.notes.reach(userId, noteId))) throw Errors.notFound('Note not found.')
    await this.db.studyNote.upsert({ where: { userId_noteId: { userId, noteId } }, create: { userId, noteId }, update: {} })
  }

  async stopStudying(userId: string, noteId: string): Promise<void> {
    await this.db.studyNote.deleteMany({ where: { userId, noteId } })
  }

  async studying(userId: string, noteId: string): Promise<boolean> {
    return (await this.db.studyNote.count({ where: { userId, noteId } })) > 0
  }

  /** A card starts again as new (the person reversed its meaning, say). */
  async resetCard(userId: string, cardId: string): Promise<void> {
    await this.db.cardReviewLog.deleteMany({ where: { userId, cardId } })
    await this.db.cardReview.deleteMany({ where: { userId, cardId } })
  }

  /** Readiness and Rhythm read this: each studied card's chance of being recalled at a moment (ADR-0068, P6e). */
  retrievability(r: ReviewRow, at: Date): number {
    if (r.state === State.New) return 0
    const card: Card = { due: r.due, stability: r.stability, difficulty: r.difficulty, elapsed_days: 0, scheduled_days: r.scheduledDays, learning_steps: r.learningSteps, reps: r.reps, lapses: r.lapses, state: r.state as Card['state'], last_review: r.lastReview ?? undefined }
    return scheduler.get_retrievability(card, at, false) as number
  }

  async exportFor(userId: string) {
    const [reviews, log, studying] = await Promise.all([
      this.db.cardReview.findMany({ where: { userId }, orderBy: { due: 'asc' } }),
      this.db.cardReviewLog.findMany({ where: { userId }, orderBy: { reviewedAt: 'asc' } }),
      this.db.studyNote.findMany({ where: { userId } }),
    ])
    return { reviews: reviews.map(({ userId: _u, ...r }) => r), log: log.map(({ userId: _u, ...l }) => l), studying: studying.map((s) => s.noteId) }
  }

  async erase(userId: string): Promise<void> {
    await this.db.cardReviewLog.deleteMany({ where: { userId } })
    await this.db.cardReview.deleteMany({ where: { userId } })
    await this.db.studyNote.deleteMany({ where: { userId } })
  }
}

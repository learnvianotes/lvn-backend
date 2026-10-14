import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, TOPICS, type People, type Topics } from '@lvn-backend/facades'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { achievementsFrom, describe, MASTERED_AT, MASTERY_MIN_ANSWERS, MASTERY_MIN_CARDS, QUIZ_MASTER_ACCURACY, QUIZ_MASTER_MIN_ANSWERS, type AchievementKindName, type Earned } from '../domain/engagement'
import { accuracyOf, masteryOf } from '../domain/exams'
import { ExamsService } from './exams.service'
import { PointsService } from './points.service'
import { ReviewsService } from './reviews.service'

export interface AchievementView {
  id: string
  kind: AchievementKindName
  tier: number
  title: string
  description: string
  subjectTitle: string | null
  earnedAt: Date
}

/**
 * Achievements (ADR-0080): tiers of what a person has learned or given, from rules in code, each awarded once and told
 * to them in the app. Theirs alone unless they are an adult who chose to show them.
 */
@Injectable()
export class AchievementsService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly points: PointsService,
    private readonly reviews: ReviewsService,
    private readonly exams: ExamsService,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    // Learning moves mastery, quiz results and Rhythm weeks: look again shortly (one job per person while one waits).
    this.events.subscribe('LearningEventRecorded', ({ payload }) => this.points.evaluateSoon(payload.userId))
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /** Awards every tier the person now reaches and has not had; tells them of the highest new one of each kind. */
  async evaluate(userId: string, now = new Date()): Promise<Earned[]> {
    const facts = await this.facts(userId, now)
    const have = new Set((await this.db.achievement.findMany({ where: { userId }, select: { key: true } })).map((a) => a.key))
    const fresh: (Earned & { id: string })[] = []
    for (const e of achievementsFrom(facts)) {
      if (have.has(e.key)) continue
      const id = newId()
      try {
        await this.db.achievement.create({ data: { id, userId, kind: e.kind, tier: e.tier, subjectId: e.subjectId, subjectTitle: e.subjectTitle, key: e.key } })
        fresh.push({ ...e, id })
      } catch (err) {
        // Another run awarded it a moment ago.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
      }
    }
    const highest = new Map<string, Earned & { id: string }>()
    for (const e of fresh) {
      const group = `${e.kind}:${e.subjectId ?? ''}`
      if ((highest.get(group)?.tier ?? 0) < e.tier) highest.set(group, e)
    }
    for (const e of highest.values()) await this.events.publish('AchievementEarned', { userId, achievementId: e.id, kind: e.kind, tier: e.tier, ...(e.subjectTitle ? { subjectTitle: e.subjectTitle } : {}) })
    return fresh
  }

  /** What the rules read: mastery and quiz results by topic, exams at their target, Rhythm weeks met, points by subject. */
  private async facts(userId: string, now: Date) {
    const [cards, results, exams, weeks, subjectPoints] = await Promise.all([
      this.db.cardReview.findMany({ where: { userId, state: { not: 0 } } }),
      this.db.topicQuizResult.findMany({ where: { userId }, orderBy: { at: 'desc' }, select: { topicKey: true, answered: true, correct: true } }),
      this.exams.list(userId, now),
      this.db.rhythmWeek.count({ where: { userId, met: true } }),
      this.points.bySubject(userId),
    ])
    const topicsOfNotes = await this.topics.ofNotes([...new Set(cards.map((c) => c.noteId))])
    const recall = new Map<string, { sum: number; n: number }>()
    for (const c of cards) {
      const value = this.reviews.retrievability(c, now)
      for (const id of topicsOfNotes.get(c.noteId) ?? []) {
        const s = recall.get(`topic:${id}`) ?? { sum: 0, n: 0 }
        recall.set(`topic:${id}`, { sum: s.sum + value, n: s.n + 1 })
      }
    }
    const byTopic = new Map<string, { answered: number; correct: number }[]>()
    for (const r of results) byTopic.set(r.topicKey, [...(byTopic.get(r.topicKey) ?? []), r])
    let topicsMastered = 0
    let quizMasterTopics = 0
    for (const key of new Set([...recall.keys(), ...byTopic.keys()])) {
      const r = recall.get(key)
      const rows = byTopic.get(key) ?? []
      const answered = rows.reduce((s, x) => s + x.answered, 0)
      const correct = rows.reduce((s, x) => s + x.correct, 0)
      const mastery = masteryOf(r ? r.sum / r.n : null, accuracyOf(rows))
      if (mastery >= MASTERED_AT && ((r?.n ?? 0) >= MASTERY_MIN_CARDS || answered >= MASTERY_MIN_ANSWERS)) topicsMastered++
      if (answered >= QUIZ_MASTER_MIN_ANSWERS && correct / answered >= QUIZ_MASTER_ACCURACY) quizMasterTopics++
    }
    const examsReady = exams.filter((e) => !e.past && e.topics.length > 0 && e.readiness >= e.target).length
    return { topicsMastered, quizMasterTopics, examsReady, rhythmWeeksMet: weeks, subjectPoints }
  }

  // ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────

  /** A person's achievements as `viewerId` may see them: their own always; someone else's only when shown; else null. */
  async of(viewerId: string | null, userId: string): Promise<AchievementView[] | null> {
    if (viewerId !== userId && !(await this.shown(userId))) return null
    const rows = await this.db.achievement.findMany({ where: { userId }, orderBy: [{ earnedAt: 'desc' }, { tier: 'desc' }] })
    // A lower tier of the same achievement adds nothing next to the higher one.
    const top = new Map<string, (typeof rows)[number]>()
    for (const r of rows) {
      const group = `${r.kind}:${r.subjectId ?? ''}`
      if ((top.get(group)?.tier ?? 0) < r.tier) top.set(group, r)
    }
    return [...top.values()].sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime()).map((r) => ({ id: r.id, kind: r.kind, tier: r.tier, subjectTitle: r.subjectTitle, earnedAt: r.earnedAt, ...describe(r) }))
  }

  /** The contribution as `viewerId` may see it, under the same rule as achievements. */
  async contributionOf(viewerId: string | null, userId: string) {
    if (viewerId !== userId && !(await this.shown(userId))) return null
    return this.points.contribution(userId)
  }

  /** Shown on their profile: an adult who chose to. A minor's are never shown, whatever was set before. */
  private async shown(userId: string): Promise<boolean> {
    const settings = await this.db.learnerSettings.findUnique({ where: { userId }, select: { showAchievements: true } })
    return settings?.showAchievements === true && (await this.adult(userId))
  }

  async adult(userId: string, now = new Date()): Promise<boolean> {
    const [profile] = await this.people.searchProfiles([userId])
    return !!profile && profile.adultFrom.getTime() <= now.getTime()
  }

  async settings(userId: string): Promise<{ showAchievements: boolean; canShow: boolean }> {
    const [row, adult] = await Promise.all([this.db.learnerSettings.findUnique({ where: { userId }, select: { showAchievements: true } }), this.adult(userId)])
    return { showAchievements: adult && row?.showAchievements === true, canShow: adult }
  }

  async setShown(userId: string, show: boolean): Promise<{ showAchievements: boolean; canShow: boolean }> {
    if (show && !(await this.adult(userId))) throw Errors.validation('Achievements stay private until you are 18.', ['input', 'show'])
    await this.db.learnerSettings.upsert({ where: { userId }, create: { userId, showAchievements: show }, update: { showAchievements: show } })
    return this.settings(userId)
  }

  async erase(userId: string): Promise<void> {
    await this.db.achievement.deleteMany({ where: { userId } })
  }
}

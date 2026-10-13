import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { NOTE_ACCESS, PEOPLE, TOPICS, type NoteAccess, type People, type Topics } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { learningDay } from '../domain/learning-day'
import { addDays } from '../domain/rhythm'
import { ExamsService } from './exams.service'
import { LearningEventsService } from './learning-events.service'
import { ResourcesService } from './resources.service'

export type RecommendationKind = 'EXAM_TOPIC' | 'REVISE_TOPIC' | 'CONTINUE_NOTE' | 'QUIZ_ON_TOPIC' | 'POPULAR_NOTE' | 'RESOURCE'
interface Item {
  kind: RecommendationKind
  entityId: string
  score: number
  reason: string
}

/** Rows a person keeps; how long they last; who counts as active; how long a dismissal holds */
const PER_PERSON = 20
const LIFETIME_MS = 2 * 3_600_000
const ACTIVE_DAYS = 7
const DISMISS_DAYS = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const day = (d: Date) => d.toISOString().slice(0, 10)
const when = (d: Date) => d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)

/**
 * Rule-based recommendations (§14.3, ADR-0071): an upcoming exam's topics, weak topics, notes to continue, quizzes on
 * topics read this week and popular public notes in the person's topics, each with a fixed score band and a reason.
 * Recomputed hourly for active people (and when a person's are missing); every note is read through the read rule
 * again when shown, so one that left the person's view is gone at once.
 */
@Injectable()
export class RecommendationsService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly exams: ExamsService,
    private readonly learning: LearningEventsService,
    private readonly resources: ResourcesService,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /** What one person is recommended now, best first: computed again when theirs are missing or expired. */
  async list(userId: string, limit = 10, now = new Date()) {
    const take = Math.min(Math.max(limit, 1), PER_PERSON)
    const fresh = await this.db.recommendation.count({ where: { userId, expiresAt: { gt: now } } })
    if (!fresh) await this.compute(userId, now)
    const rows = await this.db.recommendation.findMany({ where: { userId, expiresAt: { gt: now } }, orderBy: [{ score: 'desc' }, { entityId: 'asc' }] })
    const dismissed = new Set((await this.db.recommendationDismissal.findMany({ where: { userId, until: { gt: now } } })).map((d) => `${d.kind}:${d.entityId}`))
    const kept = rows.filter((r) => !dismissed.has(`${r.kind}:${r.entityId}`))
    // Read through the read rule now (ADR-0071 item 3): a note that left the viewer's view is gone at once.
    const noteRows = kept.filter((r) => isNoteKind(r.kind) && UUID.test(r.entityId))
    const readable = new Map((await this.notes.readable(userId, noteRows.map((r) => r.entityId))).map((n) => [n.noteId, n]))
    const blocked = new Set(await this.people.blockedIds(userId))
    const topicIds = kept.filter((r) => !isNoteKind(r.kind) && r.kind !== 'RESOURCE' && r.entityId.startsWith('topic:')).map((r) => r.entityId.slice(6))
    const usable = new Map((await this.topics.usable(userId, topicIds)).map((t) => [t.key, t]))
    const out = []
    for (const r of kept) {
      if (r.kind === 'RESOURCE') {
        // Read as the person reads it now: a resource no longer approved, or a blocked person's, is not recommended.
        const resource = await this.resources.one(userId, r.entityId)
        if (!resource || resource.status !== 'APPROVED' || blocked.has(resource.submittedById)) continue
        out.push({ kind: r.kind, reason: r.reason, score: r.score, noteId: null, noteTitle: null, topicKey: null, topicId: null, topicTitle: null, resource })
      } else if (isNoteKind(r.kind)) {
        const note = readable.get(r.entityId)
        if (!note || blocked.has(note.ownerId)) continue
        // Popular notes and quizzes are someone else's public notes; once one is not public it is not recommended.
        if ((r.kind === 'POPULAR_NOTE' || r.kind === 'QUIZ_ON_TOPIC') && note.visibility !== 'PUBLIC') continue
        out.push({ kind: r.kind, reason: r.reason, score: r.score, noteId: note.noteId, noteTitle: note.title, topicKey: null, topicId: null, topicTitle: null, resource: null })
      } else {
        const t = r.entityId.startsWith('topic:') ? usable.get(r.entityId) : null
        if (r.entityId.startsWith('topic:') && !t) continue
        out.push({ kind: r.kind, reason: r.reason, score: r.score, noteId: null, noteTitle: null, topicKey: r.entityId, topicId: t?.id ?? null, topicTitle: t?.title ?? null, resource: null })
      }
      if (out.length >= take) break
    }
    return out
  }

  async dismiss(userId: string, kind: RecommendationKind, entityId: string, now = new Date()): Promise<void> {
    if (!entityId || entityId.length > 200) throw Errors.validation('That recommendation is not there.', ['input', 'entityId'])
    const until = new Date(now.getTime() + DISMISS_DAYS * 86_400_000)
    await this.db.recommendationDismissal.upsert({ where: { userId_kind_entityId: { userId, kind, entityId } }, create: { userId, kind, entityId, until }, update: { until } })
  }

  /** Hourly: everyone active in the last 7 days. */
  async computeActive(now = new Date()): Promise<number> {
    const people = await this.db.learningDay.findMany({ where: { day: { gte: new Date(`${addDays(day(now), -ACTIVE_DAYS)}T00:00:00Z`) } }, distinct: ['userId'], select: { userId: true } })
    for (const p of people) await this.compute(p.userId, now)
    return people.length
  }

  /** One person's rows, replaced in one go. */
  async compute(userId: string, now = new Date()): Promise<Item[]> {
    const topics = await this.topicItems(userId, now)
    const items = [...topics, ...(await this.noteItems(userId, now)), ...(await this.resourceItems(topics))]
    // One row per entity: the higher band wins (a note can be both to continue and popular).
    const best = new Map<string, Item>()
    for (const i of items) if (!best.has(i.entityId) || best.get(i.entityId)!.score < i.score) best.set(i.entityId, i)
    const kept = [...best.values()].sort((a, b) => b.score - a.score).slice(0, PER_PERSON)
    const expiresAt = new Date(now.getTime() + LIFETIME_MS)
    await this.db.$transaction([
      this.db.recommendation.deleteMany({ where: { userId } }),
      this.db.recommendation.createMany({ data: kept.map((i) => ({ userId, ...i, computedAt: now, expiresAt })) }),
    ])
    return kept
  }

  /** EXAM_TOPIC (80–100) and REVISE_TOPIC (60–80). */
  private async topicItems(userId: string, now: Date): Promise<Item[]> {
    const items: Item[] = []
    const soon = (await this.exams.list(userId, now)).filter((e) => !e.past && e.daysLeft <= 14)
    for (const e of soon) {
      for (const t of e.topics) {
        items.push({ kind: 'EXAM_TOPIC', entityId: t.key, score: 100 - t.mastery * 10 - Math.min(e.daysLeft, 14) * 0.7, reason: `On your plan for ${e.name}, ${inDays(e.daysLeft)}` })
      }
    }
    const examKeys = new Set(items.map((i) => i.entityId))
    for (const w of await this.exams.weakTopics(userId, now)) {
      if (examKeys.has(w.key)) continue
      const reason = w.reason === 'LOW_ACCURACY' ? 'Under 60% right in your last quizzes' : `Not revised in 14 days, before ${w.examName ?? 'your exam'}`
      items.push({ kind: 'REVISE_TOPIC', entityId: w.key, score: 60 + 20 * (1 - (w.accuracy ?? 0.5)), reason })
    }
    return items
  }

  /**
   * RESOURCE (25–45, ADR-0075): the most saved approved resources on the person's exam and weak topics, at most two a
   * topic and six in all; resources on an exam's topics rank above those on weak ones.
   */
  private async resourceItems(topicItems: Item[]): Promise<Item[]> {
    const items: Item[] = []
    const seen = new Set<string>()
    for (const t of topicItems.filter((i) => i.entityId.startsWith('topic:')).sort((a, b) => b.score - a.score).slice(0, 6)) {
      const rows = await this.db.resource.findMany({ where: { status: 'APPROVED', topics: { some: { topicId: t.entityId.slice(6) } } }, orderBy: [{ saves: { _count: 'desc' } }, { createdAt: 'desc' }], take: 2, select: { id: true, _count: { select: { saves: true } } } })
      rows.forEach((r, i) => {
        if (seen.has(r.id) || items.length >= 6) return
        seen.add(r.id)
        const saved = r._count.saves ? `, saved by ${r._count.saves} ${r._count.saves === 1 ? 'person' : 'people'}` : ''
        items.push({ kind: 'RESOURCE', entityId: r.id, score: (t.kind === 'EXAM_TOPIC' ? 45 : 35) - i * 5, reason: `${t.kind === 'EXAM_TOPIC' ? 'For your exam' : 'To revise a weak topic'}${saved}` })
      })
    }
    return items
  }

  /** CONTINUE_NOTE (40–60), QUIZ_ON_TOPIC (30–50) and POPULAR_NOTE (10–30). */
  private async noteItems(userId: string, now: Date): Promise<Item[]> {
    const items: Item[] = []
    const timeZone = await this.learning.timeZoneOf(userId)
    const today = learningDay(now, timeZone)
    // Notes opened in the last 14 days, the last time more than a day ago, not the person's own.
    const opened = await this.db.$queryRaw<{ noteId: string; last: Date }[]>`
      SELECT "entityId" AS "noteId", max("clientTs") AS "last" FROM "learning"."LearningEvent"
      WHERE "userId" = ${userId}::uuid AND "type" = 'NOTE_OPENED' AND "entityId" IS NOT NULL
        AND "serverTs" > ${new Date(now.getTime() - 15 * 86_400_000)} AND "clientTs" > ${new Date(now.getTime() - 14 * 86_400_000)}
      GROUP BY "entityId" ORDER BY "last" DESC LIMIT 40`.then((rows) => rows.filter((r) => UUID.test(r.noteId)))
    const seen = new Set(opened.map((o) => o.noteId))
    const readable = new Map((await this.notes.readable(userId, opened.map((o) => o.noteId))).map((n) => [n.noteId, n]))
    for (const o of opened) {
      const n = readable.get(o.noteId)
      if (!n || n.ownerId === userId || learningDay(o.last, timeZone) >= today) continue
      const ago = Math.max(Math.round((now.getTime() - o.last.getTime()) / 86_400_000), 1)
      items.push({ kind: 'CONTINUE_NOTE', entityId: o.noteId, score: 60 - Math.min(ago, 14) * 1.4, reason: `You were reading this on ${when(o.last)}` })
    }
    // Quizzes on topics read this week: public notes with a quiz card, not opened yet.
    const recent = await this.db.learningDayTopic.findMany({ where: { userId, day: { gte: new Date(`${addDays(today, -7)}T00:00:00Z`) }, topicKey: { startsWith: 'topic:' }, seconds: { gt: 0 } }, select: { topicKey: true, seconds: true } })
    const byTopic = new Map<string, number>()
    for (const r of recent) byTopic.set(r.topicKey.slice(6), (byTopic.get(r.topicKey.slice(6)) ?? 0) + r.seconds)
    const readTopics = [...byTopic.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 10)
    const titles = new Map((await this.topics.usable(userId, readTopics)).map((t) => [t.id, t.title]))
    const quizzes = (await this.notes.publicOnTopics(userId, readTopics, { withQuiz: true, take: 10 })).filter((n) => !seen.has(n.noteId))
    quizzes.forEach((n, i) => {
      const topic = n.topicIds.find((id) => titles.has(id))
      items.push({ kind: 'QUIZ_ON_TOPIC', entityId: n.noteId, score: 50 - i * 2, reason: topic ? `A quiz on ${titles.get(topic)}, which you read this week` : 'A quiz on what you read this week' })
    })
    // Popular public notes on the person's interests and exam topics: most readers in 30 days.
    const examTopicIds = (await this.exams.list(userId, now)).filter((e) => !e.past).flatMap((e) => e.topics.map((t) => t.key)).filter((k) => k.startsWith('topic:')).map((k) => k.slice(6))
    const interests = [...new Set([...(await this.people.interestTopicIds(userId)), ...examTopicIds])].slice(0, 30)
    const candidates = (await this.notes.publicOnTopics(userId, interests, { take: 40 })).filter((n) => !seen.has(n.noteId))
    if (candidates.length) {
      const readers = new Map(
        (
          await this.db.$queryRaw<{ noteId: string; n: bigint }[]>`
            SELECT "entityId" AS "noteId", count(DISTINCT "userId") AS "n" FROM "learning"."LearningEvent"
            WHERE "type" = 'NOTE_OPENED' AND "entityId" = ANY(${candidates.map((c) => c.noteId)}) AND "serverTs" > ${new Date(now.getTime() - 30 * 86_400_000)}
            GROUP BY "entityId"`
        ).map((r) => [r.noteId, Number(r.n)]),
      )
      const interestTitles = new Map((await this.topics.usable(userId, interests)).map((t) => [t.id, t.title]))
      const ranked = candidates.map((c) => ({ ...c, readers: readers.get(c.noteId) ?? 0 })).sort((a, b) => b.readers - a.readers).slice(0, 5)
      ranked.forEach((n, i) => {
        const topic = n.topicIds.find((id) => interestTitles.has(id))
        items.push({ kind: 'POPULAR_NOTE', entityId: n.noteId, score: 30 - i * 4, reason: topic ? `Popular in ${interestTitles.get(topic)}` : 'Popular in your topics' })
      })
    }
    return items
  }

  async exportFor(userId: string) {
    return { dismissed: (await this.db.recommendationDismissal.findMany({ where: { userId } })).map(({ userId: _u, ...d }) => d) }
  }

  async erase(userId: string): Promise<void> {
    await this.db.recommendation.deleteMany({ where: { userId } })
    await this.db.recommendationDismissal.deleteMany({ where: { userId } })
  }
}

const isNoteKind = (kind: string) => kind === 'CONTINUE_NOTE' || kind === 'QUIZ_ON_TOPIC' || kind === 'POPULAR_NOTE'

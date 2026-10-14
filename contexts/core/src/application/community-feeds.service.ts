import { Inject, Injectable } from '@nestjs/common'
import { NOTE_ACCESS, PEOPLE, type NoteAccess, type People } from '@lvn-backend/facades'
import { decodeCursor, encodeCursor, pageSize } from '@lvn-backend/graphql'
import { PrismaService } from '@lvn-backend/prisma-base'
import { ExamsService } from './exams.service'

const DAY = 86_400_000
/** Trending looks at the last week of reactions and comments. */
const TRENDING_DAYS = 7
/** Trending ranks at most this many notes. */
const TRENDING_MAX = 100

export interface CommunityItem {
  noteId: string
  /** For You: the person's topic the note is on */
  topicId: string | null
  cursor: string
}

/**
 * Community's For You and Trending (ADR-0076), public notes only — notes, blogs, posts and projects (group posts stay
 * in their groups). Every note passes the public read rule of `notes` when it is listed (ADR-0047); blocked people's
 * are left out (ADR-0016).
 */
@Injectable()
export class CommunityFeedsService {
  constructor(
    private readonly db: PrismaService,
    private readonly exams: ExamsService,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  /**
   * The topics For You is about: the person's interests, their upcoming exams' topics and, for an adult, the topics
   * they read in the last two weeks. A child account's feed follows only what they or their school chose (ADR-0026).
   */
  async topicsOf(userId: string, now = new Date()): Promise<string[]> {
    const [interests, exams, contact] = await Promise.all([this.people.interestTopicIds(userId), this.exams.list(userId, now), this.people.contactOf(userId)])
    const examTopics = exams.filter((e) => !e.past).flatMap((e) => e.topics.map((t) => t.key)).filter((k) => k.startsWith('topic:')).map((k) => k.slice(6))
    let read: string[] = []
    if (contact && !contact.restrictedMinor) {
      const rows = await this.db.learningDayTopic.findMany({ where: { userId, day: { gte: new Date(now.getTime() - 14 * DAY) }, topicKey: { startsWith: 'topic:' }, seconds: { gt: 0 } }, select: { topicKey: true, seconds: true } })
      const seconds = new Map<string, number>()
      for (const r of rows) seconds.set(r.topicKey.slice(6), (seconds.get(r.topicKey.slice(6)) ?? 0) + r.seconds)
      read = [...seconds.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    }
    return [...new Set([...interests, ...examTopics, ...read])].slice(0, 60)
  }

  /** For You: public notes on the person's topics, newest published first. */
  async forYou(viewerId: string, first: number | null | undefined, after: string | null | undefined) {
    const size = pageSize(first, 20)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const [topics, blocked] = await Promise.all([this.topicsOf(viewerId), this.people.blockedIds(viewerId)])
    const rows = await this.notes.publicOnTopicsPage(viewerId, topics, blocked, cursor ? { at: new Date(cursor[0]), id: cursor[1] } : null, size + 1)
    const order = new Map(topics.map((t, i) => [t, i]))
    const items: CommunityItem[] = rows.slice(0, size).map((r) => ({
      noteId: r.noteId,
      // The person's own topic it is on, the one that matters most to them first.
      topicId: [...r.topicIds].filter((t) => order.has(t)).sort((a, b) => order.get(a)! - order.get(b)!)[0] ?? null,
      cursor: encodeCursor([r.at.toISOString(), r.noteId]),
    }))
    return { items, hasNextPage: rows.length > size, basedOn: topics }
  }

  /**
   * Trending: the public notes most reacted to and discussed in the last week — each person counted once per note,
   * whatever they did, and never its owner — then the most recent activity. Pages go by position.
   */
  async trending(viewerId: string, first: number | null | undefined, after: string | null | undefined, now = new Date()) {
    const size = pageSize(first, 20)
    const offset = after ? Number((decodeCursor(after, 1) as [number] | null)?.[0] ?? 0) : 0
    const since = new Date(now.getTime() - TRENDING_DAYS * DAY)
    const engaged = await this.db.$queryRaw<{ noteId: string; userId: string; at: Date }[]>`
      SELECT "targetId" AS "noteId", "userId", max("createdAt") AS "at" FROM "core"."Reaction"
      WHERE "targetType" = 'NOTE' AND "createdAt" > ${since}
      GROUP BY "targetId", "userId"
      UNION ALL
      SELECT "targetId" AS "noteId", "authorId" AS "userId", max("createdAt") AS "at" FROM "core"."Comment"
      WHERE "targetType" = 'NOTE' AND "createdAt" > ${since} AND "state" = 'VISIBLE' AND "moderation" = 'OK' AND "deletedAt" IS NULL AND "visibleTo" IS NULL
      GROUP BY "targetId", "authorId"`
    const byNote = new Map<string, { people: Set<string>; last: number }>()
    for (const e of engaged) {
      const n = byNote.get(e.noteId) ?? { people: new Set<string>(), last: 0 }
      n.people.add(e.userId)
      n.last = Math.max(n.last, e.at.getTime())
      byNote.set(e.noteId, n)
    }
    const candidates = [...byNote.entries()].sort((a, b) => b[1].people.size - a[1].people.size).slice(0, 300)
    const [publicNotes, blocked] = await Promise.all([this.notes.publicAmong(candidates.map(([id]) => id)), this.people.blockedIds(viewerId)])
    const ranked = publicNotes
      .filter((n) => !blocked.includes(n.ownerId))
      .map((n) => {
        const e = byNote.get(n.noteId)!
        return { noteId: n.noteId, score: e.people.size - (e.people.has(n.ownerId) ? 1 : 0), last: e.last }
      })
      .filter((n) => n.score > 0)
      .sort((a, b) => b.score - a.score || b.last - a.last || (a.noteId < b.noteId ? 1 : -1))
      .slice(0, TRENDING_MAX)
    const page = ranked.slice(offset, offset + size)
    const items: CommunityItem[] = page.map((n, i) => ({ noteId: n.noteId, topicId: null, cursor: encodeCursor([offset + i + 1]) }))
    return { items, hasNextPage: offset + size < ranked.length }
  }
}

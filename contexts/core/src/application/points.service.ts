import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { NOTE_ACCESS, PEOPLE, POLICY, TOPICS, type NoteAccess, type People, type Policy, type Topics } from '@lvn-backend/facades'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { awardKey, levelOf, POINTS, POINTS_LIMITS, type PointsRuleName } from '../domain/engagement'

export const CORE_ENGAGEMENT_QUEUE = 'core.engagement'
type Source = 'NOTE' | 'RESOURCE'
const DAY = 86_400_000

/**
 * The points ledger (ADR-0080): points come only from other people's actions on someone's public work, each award and
 * each reversal once. Who counts: a verified, unsuspended account at least a week old, not the recipient, not blocked
 * either way, at most a few times a week towards the same person; reactions earn at most so much a day. Moderators'
 * approvals skip those checks. Nothing is ever updated or deleted except on erasure.
 */
@Injectable()
export class PointsService implements OnModuleInit {
  private readonly log = new Logger('Points')

  constructor(
    private readonly db: PrismaService,
    private readonly queues: Queues,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('NoteForked', async ({ payload }) => {
      const [original] = await this.notes.publicAmong([payload.forkedFromNoteId])
      if (original) await this.award({ rule: 'FORK', recipientId: original.ownerId, actorId: payload.ownerId, sourceType: 'NOTE', sourceId: original.noteId })
    })
    this.events.subscribe('NoteUnpublished', ({ payload }) => this.reverseSource('NOTE', payload.noteId).then(() => undefined))
    this.events.subscribe('ResourceDecided', async ({ payload }) => {
      if (payload.decision === 'APPROVED') await this.award({ rule: 'RESOURCE_APPROVED', recipientId: payload.submittedById, actorId: null, sourceType: 'RESOURCE', sourceId: payload.resourceId })
    })
    // A resource that leaves the catalogue (removed, deleted, held by reports) takes its points back.
    this.events.subscribe('ResourceChanged', async ({ payload }) => {
      const row = await this.db.resource.findUnique({ where: { id: payload.resourceId }, select: { status: true } })
      if (row?.status !== 'APPROVED') await this.reverseSource('RESOURCE', payload.resourceId)
    })
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /** A reaction on a note was added or taken back: points for its owner while the note is public. */
  async reacted(actorId: string, noteId: string, added: boolean): Promise<void> {
    if (!added) {
      await this.reverse('REACTION', 'NOTE', noteId, actorId)
      return
    }
    const [note] = await this.notes.publicAmong([noteId])
    if (note) await this.award({ rule: 'REACTION', recipientId: note.ownerId, actorId, sourceType: 'NOTE', sourceId: noteId })
  }

  /** Awards once per rule, source and actor; false when the action does not count. */
  async award(input: { rule: PointsRuleName; recipientId: string; actorId: string | null; sourceType: Source; sourceId: string }): Promise<boolean> {
    const { rule, recipientId, actorId, sourceType, sourceId } = input
    if (actorId === recipientId) return false
    const now = new Date()
    if (actorId) {
      if (!(await this.counts(actorId, recipientId, now))) return false
      const recent = await this.db.pointsEntry.count({ where: { actorId, userId: recipientId, delta: { gt: 0 }, createdAt: { gte: new Date(now.getTime() - POINTS_LIMITS.pairWindowDays * DAY) } } })
      if (recent >= POINTS_LIMITS.perPairPerWeek) return false
    }
    if (rule === 'REACTION') {
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const today = await this.db.pointsEntry.aggregate({ where: { userId: recipientId, rule: 'REACTION', delta: { gt: 0 }, createdAt: { gte: midnight } }, _sum: { delta: true } })
      if ((today._sum.delta ?? 0) >= POINTS_LIMITS.reactionsPerDay) return false
    }
    const subject = sourceType === 'NOTE' ? ((await this.topics.subjectsOfNotes([sourceId])).get(sourceId) ?? null) : null
    const done = await this.entry(rule, sourceType, sourceId, actorId, (net) => (net > 0 ? null : POINTS[rule]), { userId: recipientId, subjectId: subject?.id ?? null, subjectTitle: subject?.title ?? null })
    if (done) await this.evaluateSoon(recipientId)
    return done
  }

  /** Takes back what one actor's action earned on one source, if anything is left of it. */
  async reverse(rule: PointsRuleName, sourceType: Source, sourceId: string, actorId: string | null): Promise<boolean> {
    return this.entry(rule, sourceType, sourceId, actorId, (net) => (net > 0 ? -net : null))
  }

  /** Takes back everything a source earned: a note no longer public, a resource out of the catalogue. */
  async reverseSource(sourceType: Source, sourceId: string): Promise<number> {
    const groups = await this.db.pointsEntry.groupBy({ by: ['rule', 'actorId'], where: { sourceType, sourceId }, _sum: { delta: true } })
    let n = 0
    for (const g of groups) if ((g._sum.delta ?? 0) > 0 && (await this.reverse(g.rule, sourceType, sourceId, g.actorId))) n++
    return n
  }

  /**
   * Writes the next entry of a (rule, source, actor) triple, when `delta` says there is one to write given the triple's
   * net so far. The award key carries how many entries the triple had, so two writers racing for the same entry make
   * one: the loser reads again.
   */
  private async entry(
    rule: PointsRuleName,
    sourceType: Source,
    sourceId: string,
    actorId: string | null,
    delta: (net: number) => number | null,
    award?: { userId: string; subjectId: string | null; subjectTitle: string | null },
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const rows = await this.db.pointsEntry.findMany({ where: { rule, sourceType, sourceId, actorId }, select: { delta: true, userId: true, subjectId: true, subjectTitle: true } })
      const d = delta(rows.reduce((s, r) => s + r.delta, 0))
      if (d === null) return false
      const owner = award ?? rows[0]
      if (!owner) return false
      try {
        await this.db.pointsEntry.create({
          data: { id: newId(), userId: owner.userId, delta: d, rule, sourceType, sourceId, actorId, subjectId: owner.subjectId, subjectTitle: owner.subjectTitle, awardKey: awardKey(rule, sourceType, sourceId, actorId, rows.length) },
        })
        return true
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
      }
    }
    this.log.warn(`points ${rule} ${sourceType} ${sourceId}: gave up after three races`)
    return false
  }

  /** Whether an actor's action counts towards a recipient (ADR-0080). */
  private async counts(actorId: string, recipientId: string, now: Date): Promise<boolean> {
    const actor = await this.policy.actor(actorId)
    if (!actor?.institutionVerified || actor.suspended) return false
    const joined = await this.people.joinedAt(actorId)
    if (!joined || now.getTime() - joined.getTime() < POINTS_LIMITS.actorMinAgeDays * DAY) return false
    return !(await this.people.blockedBetween(actorId, recipientId))
  }

  /** Achievements are checked again shortly: one job per person while one waits (the worker runs it). */
  async evaluateSoon(userId: string): Promise<void> {
    try {
      await this.queues.queue(CORE_ENGAGEMENT_QUEUE).add('evaluate', { userId }, { jobId: `ach-${userId}`, delay: 30_000, removeOnComplete: true, removeOnFail: true })
    } catch (err) {
      // A full or unreachable queue never fails the action that earned the points; the next one tries again.
      this.log.warn(`could not queue achievements for ${userId}: ${(err as Error).message}`)
    }
  }

  // ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────

  async balance(userId: string): Promise<number> {
    const sum = await this.db.pointsEntry.aggregate({ where: { userId }, _sum: { delta: true } })
    return Math.max(0, sum._sum.delta ?? 0)
  }

  async contribution(userId: string): Promise<{ points: number; level: ReturnType<typeof levelOf>['level']; nextLevelAt: number | null }> {
    const points = await this.balance(userId)
    const { level, nextAt } = levelOf(points)
    return { points, level, nextLevelAt: nextAt }
  }

  async isTrusted(userId: string): Promise<boolean> {
    return (await this.contribution(userId)).level === 'TRUSTED'
  }

  /** Points from public notes on each subject (subject contributor achievements). */
  async bySubject(userId: string): Promise<{ subjectId: string; title: string; points: number }[]> {
    const rows = await this.db.pointsEntry.groupBy({ by: ['subjectId', 'subjectTitle'], where: { userId, sourceType: 'NOTE', subjectId: { not: null } }, _sum: { delta: true } })
    return rows.filter((r) => r.subjectId).map((r) => ({ subjectId: r.subjectId!, title: r.subjectTitle ?? '', points: r._sum.delta ?? 0 }))
  }

  /** The person's own history, newest first, before the (createdAt, id) cursor. Actors are never named. */
  async history(userId: string, before: { at: Date; id: string } | null, take: number) {
    return this.db.pointsEntry.findMany({
      where: { userId, ...(before ? { OR: [{ createdAt: { lt: before.at } }, { createdAt: before.at, id: { lt: before.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: { id: true, delta: true, rule: true, sourceType: true, sourceId: true, subjectTitle: true, createdAt: true },
    })
  }

  /** Account erasure: the person's entries, and those they caused for others. */
  async erase(userId: string): Promise<void> {
    await this.db.pointsEntry.deleteMany({ where: { OR: [{ userId }, { actorId: userId }] } })
  }
}

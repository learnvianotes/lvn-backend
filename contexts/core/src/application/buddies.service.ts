import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { FOCUS_LIMITS } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, TOPICS, type People, type Topics } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RhythmService } from './rhythm.service'

const coreName = (key: string) => key.replace(/^core:/, '').replace('/', ' / ').replace(/-/g, ' ')

/**
 * Rhythm buddies (ADR-0072): up to five, by mutual consent, from people the person follows or is connected with. A
 * buddy sees whether the other is studying now (the session's topic and Meet link) and this week's counted days and
 * target; nothing else.
 */
@Injectable()
export class BuddiesService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly rhythm: RhythmService,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  private accepted(userId: string) {
    return this.db.rhythmBuddy.count({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] } })
  }

  async invite(userId: string, handle: string): Promise<void> {
    const other = await this.people.find(handle)
    if (!other || other.id === userId) throw Errors.notFound('No one by that name can be your buddy.')
    const [blocked, following, connected, contact] = await Promise.all([this.people.blockedBetween(userId, other.id), this.people.followingIds(userId), this.people.connected(userId, other.id), this.people.contactOf(other.id)])
    // A child account is never asked; neither is someone the person has blocked, or who blocked them.
    if (blocked || !contact || contact.restrictedMinor) throw Errors.notFound('No one by that name can be your buddy.')
    if (!following.includes(other.id) && !connected) throw Errors.validation('Follow someone, or connect with them, before asking them to be your buddy.', ['input', 'handle'])
    const existing = await this.db.rhythmBuddy.findFirst({ where: { OR: [{ requesterId: userId, addresseeId: other.id }, { requesterId: other.id, addresseeId: userId }] } })
    if (existing) throw Errors.conflict(existing.status === 'ACCEPTED' ? 'You are buddies already.' : 'There is an invite between you already.', ['input', 'handle'])
    const [mine, sent] = await Promise.all([this.accepted(userId), this.db.rhythmBuddy.count({ where: { requesterId: userId, status: 'PENDING' } })])
    if (mine >= FOCUS_LIMITS.buddies) throw Errors.validation(`You can have ${FOCUS_LIMITS.buddies} buddies.`, ['input'])
    if (sent >= FOCUS_LIMITS.buddies) throw Errors.validation(`You can have ${FOCUS_LIMITS.buddies} invites waiting.`, ['input'])
    await this.db.rhythmBuddy.create({ data: { id: newId(), requesterId: userId, addresseeId: other.id } })
    await this.events.publish('RhythmBuddyChanged', { userId: other.id, otherId: userId, kind: 'REQUESTED' })
  }

  async answer(userId: string, id: string, accept: boolean): Promise<void> {
    const link = await this.db.rhythmBuddy.findFirst({ where: { id, addresseeId: userId, status: 'PENDING' } })
    if (!link) throw Errors.notFound('That invite is not there.')
    if (!accept) {
      await this.db.rhythmBuddy.delete({ where: { id } })
      return
    }
    if ((await this.accepted(userId)) >= FOCUS_LIMITS.buddies || (await this.accepted(link.requesterId)) >= FOCUS_LIMITS.buddies) throw Errors.validation(`A person can have ${FOCUS_LIMITS.buddies} buddies.`, ['input'])
    await this.db.rhythmBuddy.update({ where: { id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } })
    await this.events.publish('RhythmBuddyChanged', { userId: link.requesterId, otherId: userId, kind: 'ACCEPTED' })
  }

  /** Either of the two ends it; the asker can take an invite back. */
  async remove(userId: string, id: string): Promise<void> {
    const gone = await this.db.rhythmBuddy.deleteMany({ where: { id, OR: [{ requesterId: userId }, { addresseeId: userId }] } })
    if (!gone.count) throw Errors.notFound('That buddy is not there.')
  }

  /** The person's buddies with what they may see of each other, and the invites in and out. */
  async list(userId: string, now = new Date()) {
    const [links, blocked] = await Promise.all([this.db.rhythmBuddy.findMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] }, orderBy: { createdAt: 'asc' } }), this.people.blockedIds(userId)])
    const other = (l: { requesterId: string; addresseeId: string }) => (l.requesterId === userId ? l.addresseeId : l.requesterId)
    const visible = links.filter((l) => !blocked.includes(other(l)))
    const buddyIds = visible.filter((l) => l.status === 'ACCEPTED').map(other)
    const sessions = await this.db.focusSession.findMany({ where: { userId: { in: buddyIds }, endedAt: null } })
    const open = new Map(sessions.filter((s) => s.startedAt.getTime() + (s.plannedMinutes + s.breakMinutes) * 60_000 > now.getTime()).map((s) => [s.userId, s]))
    const topicTitles = new Map((await this.topics.usable(userId, [...open.values()].flatMap((s) => (s.topicKey?.startsWith('topic:') ? [s.topicKey.slice(6)] : [])))).map((t) => [t.key, t.title]))
    const buddies = []
    for (const l of visible.filter((x) => x.status === 'ACCEPTED')) {
      const id = other(l)
      const s = open.get(id)
      const week = await this.rhythm.weekSummary(id, now)
      buddies.push({
        id: l.id,
        userId: id,
        since: l.acceptedAt ?? l.createdAt,
        studyingNow: !!s,
        studyingSince: s?.startedAt ?? null,
        topicTitle: s?.topicKey ? (topicTitles.get(s.topicKey) ?? (s.topicKey.startsWith('core:') ? coreName(s.topicKey) : null)) : null,
        meetUrl: s?.meetUrl ?? null,
        ...week,
      })
    }
    return {
      buddies,
      invites: visible.filter((l) => l.status === 'PENDING' && l.addresseeId === userId).map((l) => ({ id: l.id, userId: l.requesterId, at: l.createdAt })),
      sent: visible.filter((l) => l.status === 'PENDING' && l.requesterId === userId).map((l) => ({ id: l.id, userId: l.addresseeId, at: l.createdAt })),
    }
  }

  async exportFor(userId: string) {
    return (await this.db.rhythmBuddy.findMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] } })).map((l) => ({ withUserId: l.requesterId === userId ? l.addresseeId : l.requesterId, askedByMe: l.requesterId === userId, status: l.status, createdAt: l.createdAt, acceptedAt: l.acceptedAt }))
  }

  async erase(userId: string): Promise<void> {
    await this.db.rhythmBuddy.deleteMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] } })
  }
}

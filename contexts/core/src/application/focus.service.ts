import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { LearningEventType } from '@lvn/contracts/domain'
import { FOCUS_LIMITS, meetUrlSchema, topicKeySchema } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { LIVE, NOTE_ACCESS, TOPICS, type Live, type NoteAccess, type Topics } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { LearningEventsService } from './learning-events.service'

type Session = { id: string; userId: string; topicKey: string | null; noteId: string | null; plannedMinutes: number; breakMinutes: number; meetUrl: string | null; startedAt: Date; endedAt: Date | null; focusedSeconds: number }

const between = (n: number | null | undefined, range: { min: number; max: number; default: number }, field: string) => {
  const v = n ?? range.default
  if (!Number.isInteger(v) || v < range.min || v > range.max) throw Errors.validation(`Choose ${range.min} to ${range.max} minutes.`, ['input', field])
  return v
}

/**
 * Focus sessions (ADR-0072): Pomodoro work and rest on a topic or a note. The time counted is what the server measured
 * between start and end, at most the planned minutes, recorded as focus time on the session's topics; buddies are told
 * a session started or ended.
 */
@Injectable()
export class FocusService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly learning: LearningEventsService,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(LIVE) private readonly live: Live,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /** The person's open session, if any. */
  current(userId: string): Promise<Session | null> {
    return this.db.focusSession.findFirst({ where: { userId, endedAt: null }, orderBy: { startedAt: 'desc' } })
  }

  async start(userId: string, input: { topicKey?: string | null; noteId?: string | null; minutes?: number | null; breakMinutes?: number | null; meetUrl?: string | null }, now = new Date()): Promise<Session> {
    const plannedMinutes = between(input.minutes, FOCUS_LIMITS.minutes, 'minutes')
    const breakMinutes = between(input.breakMinutes, FOCUS_LIMITS.breakMinutes, 'breakMinutes')
    if (input.topicKey && !topicKeySchema.safeParse(input.topicKey).success) throw Errors.validation('A topic is topic:<id> or core:<subject>/<topic>.', ['input', 'topicKey'])
    if (input.noteId && !(await this.notes.reach(userId, input.noteId))) throw Errors.notFound('That note is not there.')
    let meetUrl: string | null = null
    if (input.meetUrl) {
      const parsed = meetUrlSchema.safeParse(input.meetUrl)
      if (!parsed.success) throw Errors.validation(parsed.error.issues[0]!.message, ['input', 'meetUrl'])
      meetUrl = parsed.data
    }
    const open = await this.current(userId)
    if (open) await this.close(open, now)
    const session = await this.db.focusSession.create({ data: { id: newId(), userId, topicKey: input.topicKey ?? null, noteId: input.noteId ?? null, plannedMinutes, breakMinutes, meetUrl, startedAt: now } })
    await this.tellBuddies(userId)
    return session
  }

  async end(userId: string, id: string, now = new Date()): Promise<Session> {
    const session = await this.db.focusSession.findFirst({ where: { id, userId } })
    if (!session) throw Errors.notFound('That focus session is not there.')
    if (session.endedAt) return session
    const ended = await this.close(session, now)
    await this.tellBuddies(userId)
    return ended
  }

  /** Ends a session: the time since it started, at most the plan, becomes focus time on its topics. */
  private async close(session: Session, now: Date): Promise<Session> {
    const focusedSeconds = Math.max(Math.min(Math.round((now.getTime() - session.startedAt.getTime()) / 1000), session.plannedMinutes * 60), 0)
    const claimed = await this.db.focusSession.updateMany({ where: { id: session.id, endedAt: null }, data: { endedAt: now, focusedSeconds } })
    if (claimed.count && focusedSeconds > 0) {
      const noteTopics = session.noteId ? ((await this.topics.ofNotes([session.noteId])).get(session.noteId) ?? []).map((t) => `topic:${t}`) : []
      const topicKeys = [...new Set([...(session.topicKey ? [session.topicKey] : []), ...noteTopics])].slice(0, 10)
      await this.learning.record(session.userId, {
        type: LearningEventType.TIME_SPENT,
        entityType: session.noteId ? 'NOTE' : 'FOCUS_SESSION',
        entityId: session.noteId ?? session.id,
        topicKeys,
        durationMs: focusedSeconds * 1000,
        metadata: { activity: 'FOCUS' },
        at: session.startedAt,
      })
    }
    return { ...session, endedAt: now, focusedSeconds }
  }

  /** Every 15 minutes: sessions left open past their work and rest end at their planned length. */
  async closeAbandoned(now = new Date()): Promise<number> {
    const open = await this.db.focusSession.findMany({ where: { endedAt: null, startedAt: { lt: new Date(now.getTime() - 15 * 60_000) } } })
    let closed = 0
    for (const s of open) {
      const due = new Date(s.startedAt.getTime() + (s.plannedMinutes + s.breakMinutes) * 60_000)
      if (due > now) continue
      await this.close(s, new Date(s.startedAt.getTime() + s.plannedMinutes * 60_000))
      await this.tellBuddies(s.userId)
      closed++
    }
    return closed
  }

  /** The person's accepted buddies hear that their presence changed; they fetch the list again (ADR-0042). */
  private async tellBuddies(userId: string): Promise<void> {
    const links = await this.db.rhythmBuddy.findMany({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] } })
    for (const l of links) await this.live.notify(l.requesterId === userId ? l.addresseeId : l.requesterId, 'BUDDY_PRESENCE', userId)
  }

  async exportFor(userId: string) {
    return (await this.db.focusSession.findMany({ where: { userId }, orderBy: { startedAt: 'asc' } })).map(({ userId: _u, ...s }) => s)
  }

  async erase(userId: string): Promise<void> {
    await this.db.focusSession.deleteMany({ where: { userId } })
  }
}

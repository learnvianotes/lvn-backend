import { createHmac } from 'node:crypto'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { LearningEventType, SERVER_LEARNING_EVENTS } from '@lvn/contracts/domain'
import { isTimeZone, LEARNING_LIMITS, learningEventInputSchema } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import type { Learning, ServerLearningEvent } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { RateLimiter } from '@lvn-backend/redis'
import { CORE_CONFIG, type CoreConfig } from '../core.config'
import { contributionOf, learningDay } from '../domain/learning-day'

/** One event as it is stored. */
interface Row {
  id: string
  type: string
  entityType: string | null
  entityId: string | null
  topicKeys: string[]
  durationMs: number | null
  metadata: Record<string, unknown>
  clientTs: string
  sessionId: string | null
  platform: string
}

export interface TrackResult {
  accepted: number
  duplicates: number
  rejected: { index: number; message: string }[]
}

/** The worker's pseudonymous copy for PostHog (ADR-0067), when configured. */
export const LEARNING_ANALYTICS_QUEUE = 'core.learning-analytics'

/** Batches a person may send in a minute: one every 10 s is normal, more is a client stuck in a loop. */
const BATCHES_PER_MINUTE = 30
const DAY_MS = 86_400_000

/**
 * Learning events (§14.1, ADR-0067): `trackEvents` from the apps, and what the server records itself (the LEARNING
 * facade, and domain events it hears). Events go to the partitioned `learning."LearningEvent"`, each id once; each
 * new event is added to its person's day (`LearningDay`, `LearningDayTopic`) in their time zone, 04:00 rollover.
 */
@Injectable()
export class LearningEventsService implements Learning, OnModuleInit {
  private readonly log = new Logger('LearningEvents')

  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly queues: Queues,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(CORE_CONFIG) private readonly config: CoreConfig,
  ) {}

  onModuleInit() {
    this.events.subscribe('NotePublished', ({ payload }) => this.record(payload.ownerId, { type: LearningEventType.NOTE_PUBLISHED, entityType: 'NOTE', entityId: payload.noteId, metadata: { visibility: payload.visibility } }))
    this.events.subscribe('NoteForked', ({ payload }) => this.record(payload.ownerId, { type: LearningEventType.NOTE_FORKED, entityType: 'NOTE', entityId: payload.noteId, metadata: { forkedFromNoteId: payload.forkedFromNoteId } }))
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /** `trackEvents`: a client's batch. Bad events are refused one by one; the rest are stored. */
  async track(userId: string, input: { events: unknown[]; timeZone?: string | null }): Promise<TrackResult> {
    if (input.events.length > LEARNING_LIMITS.batch) throw Errors.validation(`Send at most ${LEARNING_LIMITS.batch} events at a time.`, ['input', 'events'])
    const limit = await this.limiter.hit(`core:track:${userId}`, { max: BATCHES_PER_MINUTE, windowSeconds: 60 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many learning events. They are kept and sent again shortly.')
    if (input.timeZone) await this.setTimeZone(userId, input.timeZone)

    const rejected: TrackResult['rejected'] = []
    const rows: Row[] = []
    const now = Date.now()
    input.events.forEach((raw, index) => {
      const parsed = learningEventInputSchema.safeParse(raw)
      if (!parsed.success) return void rejected.push({ index, message: parsed.error.issues.map((i) => `${i.path.join('.') || 'event'}: ${i.message}`).slice(0, 2).join('; ') })
      const e = parsed.data
      if (SERVER_LEARNING_EVENTS.has(e.type)) return void rejected.push({ index, message: `${e.type} is recorded by the server, not sent.` })
      rows.push({ id: e.id, type: e.type, entityType: e.entityType ?? null, entityId: e.entityId ?? null, topicKeys: e.topicKeys ?? [], durationMs: e.durationMs ?? null, metadata: e.metadata ?? {}, clientTs: clamp(e.clientTs, now), sessionId: e.sessionId ?? null, platform: e.platform })
    })
    const stored = await this.store(userId, rows, 'CLIENT')
    return { accepted: stored, duplicates: rows.length - stored, rejected }
  }

  /** The LEARNING facade: what the server knows a person did. Never throws. */
  async record(userId: string, event: ServerLearningEvent): Promise<void> {
    try {
      const at = event.at ?? new Date()
      await this.store(userId, [{ id: newId(), type: event.type, entityType: event.entityType ?? null, entityId: event.entityId ?? null, topicKeys: event.topicKeys ?? [], durationMs: event.durationMs ?? null, metadata: event.metadata ?? {}, clientTs: at.toISOString(), sessionId: null, platform: 'SERVER' }], 'SERVER')
    } catch (e) {
      this.log.warn(`could not record ${event.type} for ${userId}: ${(e as Error).message}`)
    }
  }

  /** The device's time zone, kept on the learner's settings when it changes; an unknown zone is ignored. */
  async setTimeZone(userId: string, timeZone: string): Promise<void> {
    if (!isTimeZone(timeZone)) return
    await this.db.learnerSettings.upsert({ where: { userId }, create: { userId, timeZone }, update: { timeZone } })
  }

  async timeZoneOf(userId: string): Promise<string> {
    return (await this.db.learnerSettings.findUnique({ where: { userId }, select: { timeZone: true } }))?.timeZone ?? 'UTC'
  }

  /** Stores the events not seen before and adds them to their days; returns how many were new. */
  private async store(userId: string, rows: Row[], source: 'CLIENT' | 'SERVER'): Promise<number> {
    if (!rows.length) return 0
    const timeZone = await this.timeZoneOf(userId)
    const fresh = await this.db.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<(Pick<Row, 'id' | 'type' | 'durationMs' | 'metadata' | 'topicKeys'> & { clientTs: Date })[]>`
        WITH "incoming" AS (
          -- An id twice in one batch is one event.
          SELECT DISTINCT ON ("id") * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS e(
            "id" uuid, "type" text, "entityType" text, "entityId" text, "topicKeys" text[], "durationMs" int,
            "metadata" jsonb, "clientTs" timestamptz, "sessionId" text, "platform" text)
        ), "fresh" AS (
          INSERT INTO "learning"."LearningEventKey" ("id") SELECT "id" FROM "incoming" ON CONFLICT DO NOTHING RETURNING "id"
        )
        INSERT INTO "learning"."LearningEvent" ("id", "userId", "type", "entityType", "entityId", "topicKeys", "durationMs", "metadata", "clientTs", "sessionId", "platform", "source")
        SELECT i."id", ${userId}::uuid, i."type", i."entityType", i."entityId", i."topicKeys", i."durationMs", i."metadata", i."clientTs", i."sessionId", i."platform", ${source}
        FROM "incoming" i JOIN "fresh" f USING ("id")
        RETURNING "id", "type", "durationMs", "metadata", "topicKeys", "clientTs"`
      // Each new event onto its day, and its topics' days.
      const days = new Map<string, { learningSeconds: number; readingSeconds: number; reviews: number; quizAnswers: number; events: number }>()
      const topics = new Map<string, { day: string; topicKey: string; seconds: number; events: number }>()
      for (const e of inserted) {
        const day = learningDay(new Date(e.clientTs), timeZone)
        const c = contributionOf(e)
        const d = days.get(day) ?? { learningSeconds: 0, readingSeconds: 0, reviews: 0, quizAnswers: 0, events: 0 }
        d.learningSeconds += c.learningSeconds
        d.readingSeconds += c.readingSeconds
        d.reviews += c.reviews
        d.quizAnswers += c.quizAnswers
        d.events += 1
        days.set(day, d)
        for (const topicKey of e.topicKeys ?? []) {
          const key = `${day}|${topicKey}`
          const t = topics.get(key) ?? { day, topicKey, seconds: 0, events: 0 }
          t.seconds += Math.round((e.durationMs ?? 0) / 1000)
          t.events += 1
          topics.set(key, t)
        }
      }
      for (const [day, d] of days) {
        await tx.$executeRaw`
          INSERT INTO "core"."LearningDay" ("userId", "day", "learningSeconds", "readingSeconds", "reviews", "quizAnswers", "events", "updatedAt")
          VALUES (${userId}::uuid, ${day}::date, ${d.learningSeconds}, ${d.readingSeconds}, ${d.reviews}, ${d.quizAnswers}, ${d.events}, now())
          ON CONFLICT ("userId", "day") DO UPDATE SET
            "learningSeconds" = "LearningDay"."learningSeconds" + EXCLUDED."learningSeconds",
            "readingSeconds" = "LearningDay"."readingSeconds" + EXCLUDED."readingSeconds",
            "reviews" = "LearningDay"."reviews" + EXCLUDED."reviews",
            "quizAnswers" = "LearningDay"."quizAnswers" + EXCLUDED."quizAnswers",
            "events" = "LearningDay"."events" + EXCLUDED."events",
            "updatedAt" = now()`
      }
      for (const t of topics.values()) {
        await tx.$executeRaw`
          INSERT INTO "core"."LearningDayTopic" ("userId", "day", "topicKey", "seconds", "events")
          VALUES (${userId}::uuid, ${t.day}::date, ${t.topicKey}, ${t.seconds}, ${t.events})
          ON CONFLICT ("userId", "day", "topicKey") DO UPDATE SET
            "seconds" = "LearningDayTopic"."seconds" + EXCLUDED."seconds",
            "events" = "LearningDayTopic"."events" + EXCLUDED."events"`
      }
      return inserted.map((e) => e.id)
    })
    if (fresh.length) {
      await this.events.publish('LearningEventRecorded', { userId, eventIds: fresh })
      if (this.config.analytics) await this.queues.queue(LEARNING_ANALYTICS_QUEUE).add('copy', { userId, eventIds: fresh })
    }
    return fresh.length
  }

  /**
   * The worker's side of the analytics copy (§14.1, ADR-0067): the events as PostHog takes them, under an HMAC of the
   * person's id; only type, time, platform, entity type and duration. A failed send throws, so the queue tries again.
   */
  async copyToAnalytics(userId: string, eventIds: string[]): Promise<number> {
    const target = this.config.analytics
    if (!target || !eventIds.length) return 0
    const rows = await this.db.$queryRaw<{ id: string; type: string; entityType: string | null; durationMs: number | null; clientTs: Date; platform: string }[]>`
      SELECT "id", "type", "entityType", "durationMs", "clientTs", "platform" FROM "learning"."LearningEvent"
      WHERE "userId" = ${userId}::uuid AND "id" = ANY(${eventIds}::uuid[])`
    if (!rows.length) return 0
    const distinctId = createHmac('sha256', target.pseudonymSecret).update(`posthog:${userId}`).digest('hex').slice(0, 32)
    const batch = rows.map((r) => ({ event: r.type, uuid: r.id, distinct_id: distinctId, timestamp: r.clientTs.toISOString(), properties: { platform: r.platform, entityType: r.entityType, durationMs: r.durationMs, $process_person_profile: false } }))
    const res = await fetch(`${target.host.replace(/\/+$/, '')}/batch/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: target.apiKey, batch }), signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`PostHog answered ${res.status}`)
    return rows.length
  }

  /** A person's events and days, for the data export (ADR-0018). */
  async exportFor(userId: string) {
    const [events, days, topics, settings] = await Promise.all([
      this.db.$queryRaw<Record<string, unknown>[]>`
        SELECT "id", "type", "entityType", "entityId", "topicKeys", "durationMs", "metadata", "clientTs", "serverTs", "platform", "source"
        FROM "learning"."LearningEvent" WHERE "userId" = ${userId}::uuid ORDER BY "clientTs"`,
      this.db.learningDay.findMany({ where: { userId }, orderBy: { day: 'asc' } }),
      this.db.learningDayTopic.findMany({ where: { userId }, orderBy: [{ day: 'asc' }, { topicKey: 'asc' }] }),
      this.db.learnerSettings.findUnique({ where: { userId } }),
    ])
    return { events, days: days.map(({ userId: _u, ...d }) => d), topics: topics.map(({ userId: _u, ...t }) => t), timeZone: settings?.timeZone ?? null }
  }

  /** Account erasure (§15.2): every event, day and setting of the person. The ids seen stay until pruned (no content). */
  async erase(userId: string): Promise<void> {
    await this.db.$executeRaw`DELETE FROM "learning"."LearningEvent" WHERE "userId" = ${userId}::uuid`
    await this.db.learningDayTopic.deleteMany({ where: { userId } })
    await this.db.learningDay.deleteMany({ where: { userId } })
    await this.db.learnerSettings.deleteMany({ where: { userId } })
  }

  /**
   * Nightly (the worker): partitions for this month and the next three; ids seen more than 30 days ago forgotten;
   * partitions wholly older than 24 months dropped (§15.2).
   */
  async maintain(now = new Date()): Promise<{ made: number; forgotten: number; dropped: string[] }> {
    const [ensured] = await this.db.$queryRaw<{ made: number }[]>`SELECT "learning"."ensure_partitions"(3) AS "made"`
    const forgotten = await this.db.$executeRaw`DELETE FROM "learning"."LearningEventKey" WHERE "receivedAt" < ${new Date(now.getTime() - LEARNING_LIMITS.pastDays * DAY_MS)}`
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 24, 1))
    const partitions = await this.db.$queryRaw<{ name: string }[]>`
      SELECT c.relname AS "name" FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
      WHERE i.inhparent = '"learning"."LearningEvent"'::regclass AND c.relname ~ '^LearningEvent_[0-9]{4}_[0-9]{2}$'`
    const dropped: string[] = []
    for (const { name } of partitions) {
      const [year, month] = name.slice('LearningEvent_'.length).split('_').map(Number)
      // A partition holds a month; it goes when the month after it starts before the cutoff.
      if (Date.UTC(year!, month!, 1) <= cutoff.getTime()) {
        await this.db.$executeRawUnsafe(`DROP TABLE "learning"."${name}"`)
        dropped.push(name)
      }
    }
    return { made: Number(ensured?.made ?? 0), forgotten, dropped }
  }
}

/** The client's time, believed back at most 30 days and never past the server's now. */
function clamp(iso: string, now: number): string {
  const t = Date.parse(iso)
  return new Date(Math.min(Math.max(t, now - LEARNING_LIMITS.pastDays * DAY_MS), now)).toISOString()
}

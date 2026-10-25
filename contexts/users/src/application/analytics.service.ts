import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { setBackendErrorSink, type BackendErrorReport } from '@lvn-backend/observability'
import { Errors } from '@lvn-backend/errors'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { scrubText } from '../domain/scrub-text'
import { ERROR_RETENTION_DAYS, isUsageEventName, MAX_ANALYTICS_BATCH, MAX_ANALYTICS_PROPS_CHARS, USAGE_RETENTION_DAYS } from '../domain/usage-events'
import { PolicyService } from './policy.service'

const DAY_MS = 24 * 3600 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface IngestInput {
  events?: { name: string; sessionId?: string | null; occurredAt?: Date | null; props?: unknown; platform: string; appVersion?: string | null }[] | null
  errors?: { route?: string | null; code: string; message: string; occurredAt?: Date | null; platform: string; release?: string | null; appVersion?: string | null }[] | null
}

/**
 * Our own error log and usage analytics (B9). Usage is dropped when the account has opted out.
 * Client error reports from an opted-out account are stored without the user id.
 * Backend failures are recorded from the global error handler even when Sentry is off.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly limiter: RateLimiter,
  ) {}

  async optOut(userId: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { analyticsOptOut: true } })
    return user?.analyticsOptOut === true
  }

  async setOptOut(userId: string, optOut: boolean): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { analyticsOptOut: optOut } })
  }

  async ingest(userId: string, sessionId: string, input: IngestInput): Promise<void> {
    const events = input.events ?? []
    const errors = input.errors ?? []
    if (events.length + errors.length > MAX_ANALYTICS_BATCH) throw Errors.validation(`Send at most ${MAX_ANALYTICS_BATCH} events at a time.`, ['input'])
    const limit = await this.limiter.hit(`analytics:${userId}`, { max: 30, windowSeconds: 60 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many analytics batches. Try again in a minute.')
    const optedOut = await this.optOut(userId)
    const usage = optedOut ? [] : events.map((event) => this.usageRow(userId, sessionId, event))
    const reported = errors.map((event) => this.errorRow(optedOut ? null : userId, event))
    if (usage.length) await this.db.usageEvent.createMany({ data: usage })
    if (reported.length) await this.db.errorEvent.createMany({ data: reported })
  }

  /** Called by the process-wide sink. Must not throw into the request. */
  async recordBackendError(event: BackendErrorReport): Promise<void> {
    const userId = event.userId && UUID.test(event.userId) ? event.userId : null
    await this.db.errorEvent.create({
      data: {
        id: newId(),
        userId,
        route: clip(event.route, 200),
        code: clip(event.code || 'INTERNAL', 64) || 'INTERNAL',
        message: scrubText(event.message || 'Unexpected error'),
        release: clip(event.release, 64),
        platform: 'BACKEND',
      },
    })
  }

  async errorGroups(adminId: string, since?: Date | null): Promise<{ code: string; count: number; firstSeen: Date; lastSeen: Date; userIds: string[]; sampleMessage: string }[]> {
    await this.assertAdmin(adminId)
    const from = since ?? new Date(Date.now() - ERROR_RETENTION_DAYS * DAY_MS)
    const groups = await this.db.errorEvent.groupBy({
      by: ['code'],
      where: { occurredAt: { gte: from } },
      _count: { code: true },
      _min: { occurredAt: true },
      _max: { occurredAt: true },
      orderBy: { _count: { code: 'desc' } },
      take: 50,
    })
    if (!groups.length) return []
    const codes = groups.map((g) => g.code)
    const [people, samples] = await Promise.all([
      this.db.errorEvent.findMany({ where: { code: { in: codes }, occurredAt: { gte: from }, userId: { not: null } }, distinct: ['code', 'userId'], select: { code: true, userId: true }, take: 2000 }),
      this.db.errorEvent.findMany({ where: { code: { in: codes }, occurredAt: { gte: from } }, orderBy: { occurredAt: 'desc' }, distinct: ['code'], select: { code: true, message: true } }),
    ])
    const ids = new Map<string, string[]>()
    for (const row of people) {
      if (!row.userId) continue
      const list = ids.get(row.code) ?? []
      if (list.length < 100) list.push(row.userId)
      ids.set(row.code, list)
    }
    const message = new Map(samples.map((row) => [row.code, row.message]))
    return groups.map((g) => ({
      code: g.code,
      count: g._count?.code ?? 0,
      firstSeen: g._min?.occurredAt ?? from,
      lastSeen: g._max?.occurredAt ?? from,
      userIds: ids.get(g.code) ?? [],
      sampleMessage: message.get(g.code) ?? '',
    }))
  }

  async usage(adminId: string, from?: Date | null, to?: Date | null): Promise<{ from: Date; to: Date; dau: number; wau: number; mau: number; topEvents: { name: string; count: number }[]; topFeatures: { name: string; count: number }[] }> {
    await this.assertAdmin(adminId)
    const end = to ?? new Date()
    const start = from ?? new Date(end.getTime() - 30 * DAY_MS)
    if (start.getTime() > end.getTime()) throw Errors.validation('from is after to.', ['from'])
    if (end.getTime() - start.getTime() > 366 * DAY_MS) throw Errors.validation('The window can be at most 366 days.', ['from'])
    const [dau, wau, mau, topEvents, topFeatures] = await Promise.all([
      this.distinctUsers(new Date(end.getTime() - DAY_MS), end),
      this.distinctUsers(new Date(end.getTime() - 7 * DAY_MS), end),
      this.distinctUsers(new Date(end.getTime() - 30 * DAY_MS), end),
      this.topEvents(start, end),
      this.topFeatures(start, end),
    ])
    return { from: start, to: end, dau, wau, mau, topEvents, topFeatures }
  }

  async userActivity(adminId: string, userId: string, first = 50): Promise<{ occurredAt: Date; name: string; props: unknown; platform: 'WEB' | 'MOBILE'; appVersion: string | null }[]> {
    await this.assertAdmin(adminId)
    const rows = await this.db.usageEvent.findMany({ where: { userId }, orderBy: { occurredAt: 'desc' }, take: Math.min(Math.max(first, 1), 100) })
    return rows.map((row) => ({ occurredAt: row.occurredAt, name: row.name, props: row.props, platform: row.platform === 'MOBILE' ? 'MOBILE' : 'WEB', appVersion: row.appVersion }))
  }

  async funnel(adminId: string, steps: string[], since?: Date | null): Promise<{ name: string; users: number }[]> {
    await this.assertAdmin(adminId)
    if (steps.length < 1 || steps.length > 5) throw Errors.validation('A funnel has 1 to 5 steps.', ['steps'])
    if (new Set(steps).size !== steps.length) throw Errors.validation('Use each event once.', ['steps'])
    if (steps.some((step) => !isUsageEventName(step))) throw Errors.validation(`Events must be one of: page_view, note_open, note_upload, search, download, sign_in.`, ['steps'])
    const from = since ?? new Date(Date.now() - 30 * DAY_MS)
    const grouped = await this.db.usageEvent.groupBy({
      by: ['userId', 'name'],
      where: { name: { in: steps }, occurredAt: { gte: from } },
      _min: { occurredAt: true },
    })
    const byUser = new Map<string, Map<string, Date>>()
    for (const row of grouped) {
      if (!row._min.occurredAt) continue
      const times = byUser.get(row.userId) ?? new Map<string, Date>()
      times.set(row.name, row._min.occurredAt)
      byUser.set(row.userId, times)
    }
    const counts = steps.map(() => 0)
    for (const times of byUser.values()) {
      let prev: Date | null = null
      for (let i = 0; i < steps.length; i++) {
        const at = times.get(steps[i]!)
        if (!at || (prev && at.getTime() < prev.getTime())) break
        counts[i]! += 1
        prev = at
      }
    }
    return steps.map((name, i) => ({ name, users: counts[i]! }))
  }

  async purge(now = new Date()): Promise<{ errors: number; usage: number }> {
    const [errors, usage] = await Promise.all([
      this.db.errorEvent.deleteMany({ where: { occurredAt: { lt: new Date(now.getTime() - ERROR_RETENTION_DAYS * DAY_MS) } } }),
      this.db.usageEvent.deleteMany({ where: { occurredAt: { lt: new Date(now.getTime() - USAGE_RETENTION_DAYS * DAY_MS) } } }),
    ])
    return { errors: errors.count, usage: usage.count }
  }

  private usageRow(userId: string, sessionId: string, event: NonNullable<IngestInput['events']>[number]): Prisma.UsageEventCreateManyInput {
    if (!isUsageEventName(event.name)) throw Errors.validation(`Unknown event "${event.name}".`, ['input', 'events'])
    const platform = clientPlatform(event.platform)
    return {
      id: newId(),
      occurredAt: when(event.occurredAt),
      userId,
      sessionId: clip(event.sessionId, 64) ?? clip(sessionId, 64),
      name: event.name,
      props: propsOf(event.props),
      platform,
      appVersion: clip(event.appVersion, 32),
    }
  }

  private errorRow(userId: string | null, event: NonNullable<IngestInput['errors']>[number]): Prisma.ErrorEventCreateManyInput {
    const platform = clientPlatform(event.platform)
    const code = clip(event.code, 64)
    if (!code) throw Errors.validation('Say what kind of error this is.', ['input', 'errors'])
    return {
      id: newId(),
      occurredAt: when(event.occurredAt),
      userId,
      route: clip(event.route, 200),
      code,
      message: scrubText(event.message || 'Error'),
      release: clip(event.release, 64),
      platform,
    }
  }

  private async distinctUsers(from: Date, to: Date): Promise<number> {
    const rows = await this.db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT "userId")::int AS count
      FROM users.usage_events
      WHERE "occurredAt" >= ${from} AND "occurredAt" < ${to}`
    return Number(rows[0]?.count ?? 0)
  }

  private async topEvents(from: Date, to: Date): Promise<{ name: string; count: number }[]> {
    const rows = await this.db.$queryRaw<{ name: string; count: number }[]>`
      SELECT name, COUNT(*)::int AS count
      FROM users.usage_events
      WHERE "occurredAt" >= ${from} AND "occurredAt" < ${to}
      GROUP BY name
      ORDER BY count DESC
      LIMIT 10`
    return rows.map((row) => ({ name: row.name, count: Number(row.count) }))
  }

  private async topFeatures(from: Date, to: Date): Promise<{ name: string; count: number }[]> {
    const rows = await this.db.$queryRaw<{ name: string; count: number }[]>`
      SELECT props->>'feature' AS name, COUNT(*)::int AS count
      FROM users.usage_events
      WHERE "occurredAt" >= ${from} AND "occurredAt" < ${to}
        AND jsonb_typeof(props) = 'object'
        AND props ? 'feature'
        AND length(props->>'feature') BETWEEN 1 AND 64
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 10`
    return rows.map((row) => ({ name: row.name, count: Number(row.count) }))
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (actor?.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden()
  }
}

/** Registers the backend error log with the global handler for this process. */
@Injectable()
export class BackendErrorSink implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly analytics: AnalyticsService) {}

  onModuleInit(): void {
    setBackendErrorSink((event) => this.analytics.recordBackendError(event))
  }

  onModuleDestroy(): void {
    setBackendErrorSink(null)
  }
}

function clientPlatform(value: string): 'WEB' | 'MOBILE' {
  if (value === 'WEB' || value === 'MOBILE') return value
  throw Errors.validation('Platform is web or mobile.', ['input', 'platform'])
}

function clip(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function when(value: Date | string | null | undefined): Date {
  const now = Date.now()
  const date = value instanceof Date ? value : value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return new Date(now)
  if (date.getTime() > now + 5 * 60 * 1000) return new Date(now)
  if (date.getTime() < now - 7 * DAY_MS) return new Date(now)
  return date
}

function propsOf(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) throw Errors.validation('props is an object.', ['input', 'events'])
  const json = JSON.stringify(value)
  if (json.length > MAX_ANALYTICS_PROPS_CHARS) throw Errors.validation(`props is at most ${MAX_ANALYTICS_PROPS_CHARS} characters.`, ['input', 'events'])
  return value as Prisma.InputJsonValue
}

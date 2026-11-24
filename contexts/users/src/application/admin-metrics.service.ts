import { Inject, Injectable } from '@nestjs/common'
import { AI_ADMIN_STATS, CORE_ADMIN_STATS, NOTES_ADMIN_STATS, type AiAdminStats, type AiUsageSlice, type CoreAdminStats, type NotesAdminStats } from '@lvn-backend/facades'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { PolicyService } from './policy.service'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const DEFAULT_WINDOW = 30 * DAY
const MAX_WINDOW = 366 * DAY + MINUTE
const CACHE_MS = 60_000

export interface AdminMetricsView {
  generatedAt: Date
  users: { total: number; newLast7Days: number; newLast30Days: number; active: number }
  content: { notes: number; publicNotes: number; subjects: number; topics: number; groups: number; classrooms: number }
  ai: {
    from: Date
    to: Date
    tasksRun: number
    failures: number
    promptTokens: string
    completionTokens: string
    costMicroUsd: string
    byProvider: UsageBucket[]
    byModel: UsageBucket[]
    byTask: UsageBucket[]
  }
  storage: { bytes: string; files: number }
  verification: { studentIdQueue: number; pendingRequests: number; domainReviews: number }
  moderation: { openReports: number; openAppeals: number }
  scans: { pending: number; failed: number }
}

interface UsageBucket {
  provider: string
  model: string
  task: string
  tasksRun: number
  failures: number
  promptTokens: string
  completionTokens: string
  costMicroUsd: string
}

/**
 * Counts for the admin dashboard (ADR-0101). Each process keeps a result for about a minute. The numbers are
 * totals: no account, note or document is identified. The AI window is aligned to UTC minutes so a refresh hits the cache.
 */
@Injectable()
export class AdminMetricsService {
  private readonly cache = new Map<string, { at: number; body: AdminMetricsView }>()

  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    @Inject(NOTES_ADMIN_STATS) private readonly notes: NotesAdminStats,
    @Inject(AI_ADMIN_STATS) private readonly ai: AiAdminStats,
    @Inject(CORE_ADMIN_STATS) private readonly core: CoreAdminStats,
  ) {}

  async metrics(adminId: string, from?: Date | string | null, to?: Date | string | null): Promise<AdminMetricsView> {
    await this.assertAdmin(adminId)
    const window = bounds(from, to)
    const key = `${window.from.toISOString()}/${window.to.toISOString()}`
    const hit = this.cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.body
    const body = await this.compute(window)
    this.cache.set(key, { at: Date.now(), body })
    return body
  }

  private async compute(window: { from: Date; to: Date }): Promise<AdminMetricsView> {
    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * DAY)
    const d30 = new Date(now.getTime() - 30 * DAY)
    const alive = { deletedAt: null }
    const [total, newLast7Days, newLast30Days, activeRows, notes, slices, core, studentIdQueue, pendingRequests, domainReviews] = await Promise.all([
      this.db.user.count({ where: alive }),
      this.db.user.count({ where: { ...alive, createdAt: { gte: d7 } } }),
      this.db.user.count({ where: { ...alive, createdAt: { gte: d30 } } }),
      this.db.$queryRaw<{ n: bigint }[]>`SELECT count(DISTINCT "userId")::bigint AS n FROM "users"."Session" WHERE "revokedAt" IS NULL AND "expiresAt" > now()`,
      this.notes.counts(),
      this.ai.usage(window.from, window.to),
      this.core.counts(),
      this.db.verificationRequest.count({ where: { collegeIdCard: true, status: 'PENDING' } }),
      this.db.verificationRequest.count({ where: { status: 'PENDING' } }),
      this.db.domainReview.count({ where: { status: { in: ['ACADEMIC_QUEUED', 'NEEDS_REVIEW'] } } }),
    ])
    return {
      generatedAt: new Date(),
      users: { total, newLast7Days, newLast30Days, active: Number(activeRows[0]?.n ?? 0n) },
      content: { notes: notes.notes, publicNotes: notes.publicNotes, subjects: notes.subjects, topics: notes.topics, groups: core.groups, classrooms: core.classrooms },
      ai: rollup(window, slices),
      storage: { bytes: notes.storageBytes.toString(), files: notes.storageFiles },
      verification: { studentIdQueue, pendingRequests, domainReviews },
      moderation: { openReports: core.openReports, openAppeals: core.openAppeals },
      scans: { pending: notes.pendingScans, failed: notes.failedScans },
    }
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden()
  }
}

function bounds(from?: Date | string | null, to?: Date | string | null): { from: Date; to: Date } {
  // Schema-first DateTime arguments can arrive as the ISO string the client sent.
  const endInput = to == null || to === '' ? new Date() : new Date(to)
  const startInput = from == null || from === '' ? new Date(endInput.getTime() - DEFAULT_WINDOW) : new Date(from)
  if (Number.isNaN(startInput.getTime()) || Number.isNaN(endInput.getTime())) throw Errors.validation('Use an ISO-8601 date-time.', ['from'])
  const start = floorMinute(startInput)
  // Exclusive end is the next minute, so the current minute is inside the window and two refreshes share a cache entry.
  const end = new Date(floorMinute(endInput).getTime() + MINUTE)
  if (start >= end) throw Errors.validation('The start of the window has to be before the end.', ['from'])
  if (end.getTime() - start.getTime() > MAX_WINDOW) throw Errors.validation('The window can be at most 366 days.', ['from'])
  return { from: start, to: end }
}

function floorMinute(d: Date): Date {
  const x = new Date(d)
  x.setUTCSeconds(0, 0)
  return x
}

function rollup(window: { from: Date; to: Date }, slices: AiUsageSlice[]): AdminMetricsView['ai'] {
  const providers = new Map<string, Totals>()
  const models = new Map<string, Totals>()
  const tasks = new Map<string, Totals>()
  const all = empty()
  for (const slice of slices) {
    add(all, slice)
    add(bucket(providers, slice.provider, '', ''), slice)
    add(bucket(models, slice.provider, slice.model, ''), slice)
    add(bucket(tasks, '', '', slice.task), slice)
  }
  const pack = (rows: Totals[], kind: 'provider' | 'model' | 'task') =>
    rows
      .sort((a, b) => b.tasks - a.tasks || a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model) || a.task.localeCompare(b.task))
      .map((row) => ({
        provider: kind === 'task' ? '' : row.provider,
        model: kind === 'model' ? row.model : '',
        task: kind === 'task' ? row.task : '',
        tasksRun: row.tasks,
        failures: row.failures,
        promptTokens: row.promptTokens.toString(),
        completionTokens: row.completionTokens.toString(),
        costMicroUsd: row.costMicroUsd.toString(),
      }))
  return {
    from: window.from,
    to: window.to,
    tasksRun: all.tasks,
    failures: all.failures,
    promptTokens: all.promptTokens.toString(),
    completionTokens: all.completionTokens.toString(),
    costMicroUsd: all.costMicroUsd.toString(),
    byProvider: pack([...providers.values()], 'provider'),
    byModel: pack([...models.values()], 'model'),
    byTask: pack([...tasks.values()], 'task'),
  }
}

interface Totals {
  provider: string
  model: string
  task: string
  tasks: number
  failures: number
  promptTokens: bigint
  completionTokens: bigint
  costMicroUsd: bigint
}

function empty(): Totals {
  return { provider: '', model: '', task: '', tasks: 0, failures: 0, promptTokens: 0n, completionTokens: 0n, costMicroUsd: 0n }
}

function bucket(map: Map<string, Totals>, provider: string, model: string, task: string): Totals {
  const key = `${provider}\0${model}\0${task}`
  const found = map.get(key)
  if (found) return found
  const created = { ...empty(), provider, model, task }
  map.set(key, created)
  return created
}

function add(into: Totals, slice: AiUsageSlice): void {
  into.tasks += slice.tasks
  into.failures += slice.failures
  into.promptTokens += slice.promptTokens
  into.completionTokens += slice.completionTokens
  into.costMicroUsd += slice.costMicroUsd
}

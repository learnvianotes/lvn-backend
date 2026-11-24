import { Inject, Injectable } from '@nestjs/common'
import { LimitKey, limitLabel, limitPeriod, LIMIT_KEYS, nextUtcMidnight, nextUtcMonth, startOfUtcDay, type GlobalRole } from '@lvn/contracts/domain'
import { AI_PLAN_USAGE, CORE_PLAN_USAGE, NOTES_PLAN_USAGE, type PlanUsageSource } from '@lvn-backend/facades'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { DEFAULT_PLAN } from './entitlement.service'

type PlanRow = Prisma.PlanGetPayload<{ include: { entitlements: true } }>

export interface PlanLimitView {
  key: LimitKey
  label: string
  /** Decimal string, or null when the plan does not cap this. */
  limit: string | null
}

export interface PublicPlanView {
  id: string
  code: string
  name: string
  priceMinor: number
  currency: string
  interval: PlanRow['interval']
  features: string[]
  limits: PlanLimitView[]
  current: boolean
}

export interface PlanUsageView {
  key: LimitKey
  label: string
  used: string
  limit: string | null
  resetsAt: Date | null
}

export interface MyPlanView {
  plan: PublicPlanView
  usage: PlanUsageView[]
}

interface ViewerPlan {
  /** Null when nobody is signed in. */
  userId: string | null
  role: GlobalRole
  /** Null when the account has no UserPlan row: they are on FREE. */
  planId: string | null
}

/**
 * Plans a person can look at, and the limits of the one they are on (contracts 0.70.0).
 * Listing and reading a price does not charge anyone and does not start a subscription.
 * An account with no UserPlan row is on FREE.
 */
@Injectable()
export class PublicPlansService {
  constructor(
    private readonly db: PrismaService,
    @Inject(NOTES_PLAN_USAGE) private readonly notesUsage: PlanUsageSource,
    @Inject(AI_PLAN_USAGE) private readonly aiUsage: PlanUsageSource,
    @Inject(CORE_PLAN_USAGE) private readonly coreUsage: PlanUsageSource,
  ) {}

  /** Active plans, cheapest first. Signed out, `current` is false and the limits are the student's. */
  async list(viewerId: string | null): Promise<PublicPlanView[]> {
    const viewer = await this.viewer(viewerId)
    const rows = await this.db.plan.findMany({ where: { active: true }, include: { entitlements: true } })
    return rows.sort((a, b) => a.priceMinor - b.priceMinor || a.code.localeCompare(b.code)).map((row) => this.toPublic(row, viewer))
  }

  /** The signed-in person's plan, including FREE when they have no subscription, and their usage. */
  async mine(userId: string): Promise<MyPlanView> {
    const viewer = await this.viewer(userId)
    const row = viewer.planId
      ? await this.db.plan.findUniqueOrThrow({ where: { id: viewer.planId }, include: { entitlements: true } })
      : await this.db.plan.findUniqueOrThrow({ where: { code: DEFAULT_PLAN }, include: { entitlements: true } })
    const now = new Date()
    const used = await this.usage(userId)
    const limits = limitsFor(row.entitlements, viewer.role)
    return {
      plan: this.toPublic(row, { userId, role: viewer.role, planId: row.id }),
      usage: limits.map((item) => ({
        key: item.key,
        label: item.label,
        used: (used[item.key] ?? 0n).toString(),
        limit: item.limit,
        resetsAt: resetsAt(item.key, now),
      })),
    }
  }

  private async viewer(viewerId: string | null): Promise<ViewerPlan> {
    if (!viewerId) return { userId: null, role: 'STUDENT', planId: null }
    const user = await this.db.user.findUniqueOrThrow({ where: { id: viewerId }, select: { globalRole: true, plan: { select: { planId: true } } } })
    return { userId: viewerId, role: user.globalRole, planId: user.plan?.planId ?? null }
  }

  private toPublic(row: PlanRow, viewer: ViewerPlan): PublicPlanView {
    const current = viewer.userId !== null && (viewer.planId === null ? row.code === DEFAULT_PLAN : row.id === viewer.planId)
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      priceMinor: row.priceMinor,
      currency: row.currency,
      interval: row.interval,
      features: row.features,
      limits: limitsFor(row.entitlements, viewer.role),
      current,
    }
  }

  /** Counters for every limit. Exports and organisation seats live in this context; the rest come from their owners. */
  private async usage(userId: string): Promise<Partial<Record<LimitKey, bigint>>> {
    const since = startOfUtcDay()
    const [notes, ai, core, exports, seats] = await Promise.all([
      this.notesUsage.used(userId),
      this.aiUsage.used(userId),
      this.coreUsage.used(userId),
      this.db.dataExport.count({ where: { userId, requestedAt: { gte: since }, status: { not: 'FAILED' } } }),
      this.db.membership.count({ where: { userId } }),
    ])
    return { ...notes, ...ai, ...core, [LimitKey.EXPORTS_DAILY]: BigInt(exports), [LimitKey.ORG_SEATS]: BigInt(seats) }
  }
}

/** The role-specific row wins; otherwise the row for every role; otherwise unlimited. */
function limitsFor(rows: PlanRow['entitlements'], role: GlobalRole): PlanLimitView[] {
  return LIMIT_KEYS.map((key) => {
    const specific = rows.find((row) => row.key === key && row.appliesToRole === role)
    const generic = rows.find((row) => row.key === key && row.appliesToRole === null)
    const limit = (specific ?? generic)?.limit ?? null
    return { key, label: limitLabel(key), limit: limit === null ? null : limit.toString() }
  })
}

function resetsAt(key: LimitKey, now: Date): Date | null {
  const period = limitPeriod(key)
  if (period === 'DAY') return nextUtcMidnight(now)
  if (period === 'MONTH') return nextUtcMonth(now)
  return null
}

import { Injectable } from '@nestjs/common'
import { LimitKey, type GlobalRole } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { DEFAULT_PLAN } from './entitlement.service'
import { parsePlanDraft, parsePlanPatch, type PlanEntitlementInput, type PlanIntervalName } from '../domain/plan-pricing'
import { AuditService } from './audit.service'
import { PolicyService } from './policy.service'

const KEYS = Object.values(LimitKey)

export interface AdminPlanEntitlementView {
  key: LimitKey
  limit: string | null
  appliesToRole: GlobalRole | null
}

export interface AdminPlanView {
  id: string
  code: string
  name: string
  priceMinor: number
  currency: string
  interval: PlanIntervalName
  features: string[]
  active: boolean
  entitlements: AdminPlanEntitlementView[]
  subscriberCount: number
}

export interface PlanCreateInput {
  code: string
  name: string
  priceMinor: number
  currency: string
  interval: PlanIntervalName
  features?: string[] | null
  active?: boolean | null
  entitlements?: PlanEntitlementInput[] | null
}

export interface PlanUpdateInput {
  id: string
  name?: string | null
  priceMinor?: number | null
  currency?: string | null
  interval?: PlanIntervalName | null
  features?: string[] | null
  active?: boolean | null
  entitlements?: PlanEntitlementInput[] | null
}

type PlanRow = Prisma.PlanGetPayload<{ include: { entitlements: true; _count: { select: { users: true } } } }>

/**
 * Plan prices and limits as configuration (ADR-0024, ADR-0101). Saving a price does not charge anyone and does not
 * call a payment provider. Accounts without a plan stay on FREE.
 */
@Injectable()
export class PlanAdminService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  async list(adminId: string): Promise<AdminPlanView[]> {
    await this.assertAdmin(adminId)
    const rows = await this.db.plan.findMany({
      include: { entitlements: { orderBy: [{ key: 'asc' }] }, _count: { select: { users: true } } },
      orderBy: { code: 'asc' },
    })
    return rows.map(view)
  }

  async create(adminId: string, input: PlanCreateInput): Promise<AdminPlanView> {
    await this.assertAdmin(adminId)
    const parsed = parsePlanDraft(input, KEYS)
    if (!parsed.ok) throw Errors.validation(parsed.message, parsed.field)
    const draft = parsed.value
    if (await this.db.plan.findUnique({ where: { code: draft.code }, select: { id: true } })) {
      throw Errors.conflict('A plan with this code already exists.', ['input', 'code'])
    }
    const id = newId()
    await this.db.$transaction(async (tx) => {
      await tx.plan.create({
        data: { id, code: draft.code, name: draft.name, priceMinor: draft.priceMinor, currency: draft.currency, interval: draft.interval, features: draft.features, active: draft.active },
      })
      if (draft.entitlements.length) {
        await tx.entitlement.createMany({ data: draft.entitlements.map((e) => ({ id: newId(), planId: id, key: e.key, limit: e.limit, appliesToRole: e.appliesToRole })) })
      }
    })
    await this.audit.record({ actorId: adminId, action: 'plan.created', targetType: 'Plan', targetId: id, metadata: { code: draft.code, ...summary(draft) } })
    return this.one(id)
  }

  async update(adminId: string, input: PlanUpdateInput): Promise<AdminPlanView> {
    await this.assertAdmin(adminId)
    const parsed = parsePlanPatch(input, KEYS)
    if (!parsed.ok) throw Errors.validation(parsed.message, parsed.field)
    const patch = parsed.value
    const existing = await this.db.plan.findUnique({ where: { id: input.id }, select: { id: true, code: true } })
    if (!existing) throw Errors.notFound('This plan no longer exists.')
    if (existing.code === DEFAULT_PLAN && patch.active === false) {
      throw Errors.validation('The Free plan stays available. Accounts without a plan use it.', ['input', 'active'])
    }
    await this.db.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id: existing.id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.priceMinor !== undefined ? { priceMinor: patch.priceMinor } : {}),
          ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
          ...(patch.interval !== undefined ? { interval: patch.interval } : {}),
          ...(patch.features !== undefined ? { features: patch.features } : {}),
          ...(patch.active !== undefined ? { active: patch.active } : {}),
        },
      })
      if (patch.entitlements) {
        await tx.entitlement.deleteMany({ where: { planId: existing.id } })
        if (patch.entitlements.length) {
          await tx.entitlement.createMany({ data: patch.entitlements.map((e) => ({ id: newId(), planId: existing.id, key: e.key, limit: e.limit, appliesToRole: e.appliesToRole })) })
        }
      }
    })
    await this.audit.record({ actorId: adminId, action: 'plan.updated', targetType: 'Plan', targetId: existing.id, metadata: { code: existing.code, ...summary(patch) } })
    return this.one(existing.id)
  }

  async remove(adminId: string, id: string): Promise<void> {
    await this.assertAdmin(adminId)
    const existing = await this.db.plan.findUnique({ where: { id }, select: { id: true, code: true, _count: { select: { users: true } } } })
    if (!existing) throw Errors.notFound('This plan no longer exists.')
    if (existing.code === DEFAULT_PLAN) throw Errors.validation('The Free plan stays. Accounts without a plan use it.')
    if (existing._count.users > 0) throw Errors.conflict('People are on this plan. Mark it inactive instead of deleting it.')
    await this.db.plan.delete({ where: { id } })
    await this.audit.record({ actorId: adminId, action: 'plan.deleted', targetType: 'Plan', targetId: id, metadata: { code: existing.code } })
  }

  private async one(id: string): Promise<AdminPlanView> {
    const row = await this.db.plan.findUniqueOrThrow({
      where: { id },
      include: { entitlements: { orderBy: [{ key: 'asc' }] }, _count: { select: { users: true } } },
    })
    return view(row)
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden()
  }
}

function view(row: PlanRow): AdminPlanView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    priceMinor: row.priceMinor,
    currency: row.currency,
    interval: row.interval,
    features: row.features,
    active: row.active,
    subscriberCount: row._count.users,
    entitlements: row.entitlements.map((e) => ({ key: e.key, limit: e.limit === null ? null : e.limit.toString(), appliesToRole: e.appliesToRole })),
  }
}

function summary(patch: Partial<{ name: string; priceMinor: number; currency: string; interval: string; active: boolean; features: string[]; entitlements: unknown[] }>): Record<string, string | number | boolean | string[]> {
  return {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.priceMinor !== undefined ? { priceMinor: patch.priceMinor } : {}),
    ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
    ...(patch.interval !== undefined ? { interval: patch.interval } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
    ...(patch.features !== undefined ? { features: patch.features } : {}),
    ...(patch.entitlements !== undefined ? { entitlementCount: patch.entitlements.length } : {}),
  }
}

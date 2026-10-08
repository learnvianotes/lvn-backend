import { Injectable } from '@nestjs/common'
import type { LimitKey } from '@lvn/contracts/domain'
import type { Entitlements } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

/** Accounts without a UserPlan row are on FREE (ADR-0024). */
export const DEFAULT_PLAN = 'FREE'

/**
 * Plan limits as data (ADR-0024): the user's plan (FREE by default), the entitlement for their role if there is one,
 * else the plan's entitlement for every role, else unlimited.
 */
@Injectable()
export class EntitlementService implements Entitlements {
  constructor(private readonly db: PrismaService) {}

  async limit(userId: string, key: LimitKey): Promise<bigint | null> {
    return (await this.limits(userId, [key])).get(key) ?? null
  }

  /** Several limits at once (viewer.limits). */
  async limits(userId: string, keys: LimitKey[]): Promise<Map<LimitKey, bigint | null>> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { globalRole: true, plan: { select: { planId: true } } } })
    const planId = user.plan?.planId ?? (await this.db.plan.findUniqueOrThrow({ where: { code: DEFAULT_PLAN }, select: { id: true } })).id
    const rows = await this.db.entitlement.findMany({ where: { planId, key: { in: keys }, OR: [{ appliesToRole: user.globalRole }, { appliesToRole: null }] } })
    const out = new Map<LimitKey, bigint | null>()
    for (const key of keys) {
      const forRole = rows.find((r) => r.key === key && r.appliesToRole === user.globalRole)
      const forAll = rows.find((r) => r.key === key && r.appliesToRole === null)
      out.set(key, (forRole ?? forAll)?.limit ?? null)
    }
    return out
  }
}

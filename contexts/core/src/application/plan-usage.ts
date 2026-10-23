import { Injectable } from '@nestjs/common'
import { LimitKey } from '@lvn/contracts/domain'
import type { PlanUsageSource } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

/**
 * Groups and classes the person owns. Member caps are per place, so usage is the fullest place they own.
 */
@Injectable()
export class CorePlanUsage implements PlanUsageSource {
  constructor(private readonly db: PrismaService) {}

  async used(userId: string): Promise<Partial<Record<LimitKey, bigint>>> {
    const [groups, classes] = await Promise.all([
      this.db.group.findMany({ where: { ownerId: userId, deletedAt: null }, select: { type: true, _count: { select: { members: true } } } }),
      this.db.classroom.findMany({ where: { ownerId: userId, deletedAt: null }, select: { _count: { select: { members: true } } } }),
    ])
    const fullest = (counts: number[]) => BigInt(counts.reduce((max, n) => Math.max(max, n), 0))
    return {
      [LimitKey.GROUPS_OWNED]: BigInt(groups.filter((group) => group.type === 'COMMUNITY').length),
      [LimitKey.PROJECT_WORKSPACES]: BigInt(groups.filter((group) => group.type === 'PROJECT').length),
      [LimitKey.GROUP_MEMBERS]: fullest(groups.map((group) => group._count.members)),
      [LimitKey.CLASSROOMS_OWNED]: BigInt(classes.length),
      [LimitKey.CLASSROOM_MEMBERS]: fullest(classes.map((room) => room._count.members)),
    }
  }
}

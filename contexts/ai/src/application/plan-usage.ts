import { Injectable } from '@nestjs/common'
import { LimitKey } from '@lvn/contracts/domain'
import type { PlanUsageSource } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { aiUsedToday } from './usage-counts'

/** Tokens and asks since UTC midnight. */
@Injectable()
export class AiPlanUsage implements PlanUsageSource {
  constructor(private readonly db: PrismaService) {}

  async used(userId: string): Promise<Partial<Record<LimitKey, bigint>>> {
    const used = await aiUsedToday(this.db, userId)
    return { [LimitKey.AI_TOKENS_DAILY]: used.tokens, [LimitKey.AI_REQUESTS_DAILY]: used.requests }
  }
}

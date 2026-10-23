import { Injectable } from '@nestjs/common'
import type { AiAdminStats as AiAdminStatsPort, AiUsageSlice } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

/** AI usage totals for the admin dashboard (ADR-0101). One grouped read of AiUsage. No prompts and no user ids. */
@Injectable()
export class AiAdminStats implements AiAdminStatsPort {
  constructor(private readonly db: PrismaService) {}

  async usage(from: Date, to: Date): Promise<AiUsageSlice[]> {
    const rows = await this.db.$queryRaw<{ provider: string; model: string; task: string; tasks: number; failures: number; promptTokens: string; completionTokens: string; costMicroUsd: string }[]>`
      SELECT provider::text AS provider,
             model,
             task,
             count(*)::int AS tasks,
             count(*) FILTER (WHERE NOT ok)::int AS failures,
             coalesce(sum("promptTokens"), 0)::text AS "promptTokens",
             coalesce(sum("completionTokens"), 0)::text AS "completionTokens",
             coalesce(sum("costMicroUsd"), 0)::text AS "costMicroUsd"
      FROM "ai"."AiUsage"
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
      GROUP BY provider, model, task
    `
    return rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      task: row.task,
      tasks: row.tasks,
      failures: row.failures,
      promptTokens: BigInt(row.promptTokens),
      completionTokens: BigInt(row.completionTokens),
      costMicroUsd: BigInt(row.costMicroUsd),
    }))
  }
}

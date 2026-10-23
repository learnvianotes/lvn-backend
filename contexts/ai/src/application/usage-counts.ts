import { startOfUtcDay } from '@lvn/contracts/domain'
import type { PrismaService } from '@lvn-backend/prisma-base'

/** Tokens and asks since UTC midnight. An ask is one question or one task, not each model call inside it. */
export async function aiUsedToday(db: PrismaService, userId: string): Promise<{ tokens: bigint; requests: bigint }> {
  const since = startOfUtcDay()
  const [tokens, asks, tasks] = await Promise.all([
    db.aiUsage.aggregate({ _sum: { promptTokens: true, completionTokens: true }, where: { userId, createdAt: { gte: since } } }),
    db.aiAnswer.count({ where: { askerId: userId, createdAt: { gte: since } } }),
    db.noteArtifact.count({ where: { ownerId: userId, createdAt: { gte: since } } }),
  ])
  return {
    tokens: BigInt((tokens._sum.promptTokens ?? 0) + (tokens._sum.completionTokens ?? 0)),
    requests: BigInt(asks + tasks),
  }
}

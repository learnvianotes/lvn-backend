import { Injectable } from '@nestjs/common'
import { newId, type Prisma, PrismaService } from '@lvn-backend/prisma-base'

/**
 * §4.5: who changed roles, memberships, verification and moderation state, and every view of an identity document
 * (ADR-0019). Never content. Kept 7 years (§15.2).
 */
@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}

  async record(entry: { actorId: string | null; action: string; targetType: string; targetId?: string | null; metadata?: Prisma.InputJsonValue }, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.db).auditLog.create({
      data: { id: newId(), actorId: entry.actorId, action: entry.action, targetType: entry.targetType, targetId: entry.targetId ?? null, metadata: entry.metadata },
    })
  }
}

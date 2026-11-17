import { Injectable } from '@nestjs/common'
import type { Audit, AuditEntry } from '@lvn-backend/facades'
import { newId, type Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { redactAudit } from '../domain/audit-redact'

/**
 * §4.5: who changed roles, memberships, verification and moderation state, and every view of an identity document
 * (ADR-0019). Never content. Kept 7 years (§15.2). Rows are insert-only; the database rejects updates and deletes.
 */
@Injectable()
export class AuditService implements Audit {
  constructor(private readonly db: PrismaService) {}

  async record(entry: AuditEntry | { actorId: string | null; actorEmail?: string | null; action: string; targetType: string; targetId?: string | null; metadata?: Prisma.InputJsonValue; ip?: string | null; userAgent?: string | null }, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? this.db
    let actorEmail = entry.actorEmail ?? null
    if (entry.actorId && !actorEmail) {
      const user = await db.user.findUnique({ where: { id: entry.actorId }, select: { email: true } })
      actorEmail = user?.email ?? null
    }
    const metadata = entry.metadata == null ? undefined : (redactAudit(entry.metadata) as Prisma.InputJsonValue)
    await db.auditLog.create({
      data: {
        id: newId(),
        actorId: entry.actorId,
        actorEmail,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        metadata,
        ip: entry.ip?.slice(0, 64) ?? null,
        userAgent: entry.userAgent?.slice(0, 200) ?? null,
      },
    })
  }
}

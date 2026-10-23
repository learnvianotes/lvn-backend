import { Injectable } from '@nestjs/common'
import { LimitKey, startOfUtcDay, startOfUtcMonth } from '@lvn/contracts/domain'
import type { PlanUsageSource } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

/** Notes the person owns, bytes stored, PDF pages this month, and imports started today. */
@Injectable()
export class NotesPlanUsage implements PlanUsageSource {
  constructor(private readonly db: PrismaService) {}

  async used(userId: string): Promise<Partial<Record<LimitKey, bigint>>> {
    const day = startOfUtcDay()
    const month = startOfUtcMonth()
    const [notes, storage, pages, imports] = await Promise.all([
      this.db.note.count({ where: { ownerId: userId, deletedAt: null } }),
      this.db.fileObject.aggregate({ where: { ownerId: userId, deletedAt: null, status: { notIn: ['FAILED', 'DELETED'] } }, _sum: { sizeBytes: true } }),
      this.db.pdfConversion.aggregate({ where: { userId, createdAt: { gte: month }, status: { not: 'FAILED' } }, _sum: { pages: true } }),
      this.db.noteImport.count({ where: { userId, createdAt: { gte: day } } }),
    ])
    return {
      [LimitKey.NOTES_OWNED]: BigInt(notes),
      [LimitKey.STORAGE_BYTES]: storage._sum.sizeBytes ?? 0n,
      [LimitKey.PDF_PAGES_MONTHLY]: BigInt(pages._sum.pages ?? 0),
      [LimitKey.IMPORTS_DAILY]: BigInt(imports),
    }
  }
}

import { Injectable } from '@nestjs/common'
import type { NotesAdminStats as NotesAdminStatsPort } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

/** Files that have bytes in storage. Pending uploads, failures and deletions do not. */
const STORED = ['UPLOADED', 'PROCESSING', 'READY', 'QUARANTINED'] as const

/** Note, subject and storage totals for the admin dashboard (ADR-0101). Counts only. */
@Injectable()
export class NotesAdminStats implements NotesAdminStatsPort {
  constructor(private readonly db: PrismaService) {}

  async counts(): Promise<{ notes: number; publicNotes: number; subjects: number; topics: number; storageFiles: number; storageBytes: bigint; pendingScans: number; failedScans: number }> {
    const stored = { deletedAt: null, status: { in: [...STORED] } }
    const [notes, publicNotes, subjects, topics, storageFiles, storage, pendingScans, failedScans] = await Promise.all([
      this.db.note.count({ where: { deletedAt: null } }),
      this.db.note.count({ where: { deletedAt: null, visibility: 'PUBLIC' } }),
      this.db.subject.count(),
      this.db.topic.count(),
      this.db.fileObject.count({ where: stored }),
      this.db.fileObject.aggregate({ where: stored, _sum: { sizeBytes: true } }),
      this.db.fileObject.count({ where: { deletedAt: null, scanResult: 'PENDING' } }),
      this.db.fileObject.count({ where: { deletedAt: null, scanResult: 'FAILED' } }),
    ])
    return { notes, publicNotes, subjects, topics, storageFiles, storageBytes: storage._sum.sizeBytes ?? 0n, pendingScans, failedScans }
  }
}

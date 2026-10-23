import { Injectable } from '@nestjs/common'
import type { CoreAdminStats as CoreAdminStatsPort } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

/** Moderation queue and place totals for the admin dashboard (ADR-0101). Counts only. */
@Injectable()
export class CoreAdminStats implements CoreAdminStatsPort {
  constructor(private readonly db: PrismaService) {}

  async counts(): Promise<{ openReports: number; openAppeals: number; groups: number; classrooms: number }> {
    const [openReports, openAppeals, groups, classrooms] = await Promise.all([
      this.db.report.count({ where: { status: 'OPEN' } }),
      this.db.moderationAppeal.count({ where: { status: 'OPEN' } }),
      this.db.group.count({ where: { deletedAt: null } }),
      this.db.classroom.count({ where: { deletedAt: null } }),
    ])
    return { openReports, openAppeals, groups, classrooms }
  }
}

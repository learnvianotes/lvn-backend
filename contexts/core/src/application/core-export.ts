import { Injectable } from '@nestjs/common'
import type { DataExportPart } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v, null, 2))

/**
 * The core part of a data export (ADR-0018): study progress on /core, the reports this person filed, their appeals,
 * and moderation decisions about their account. Groups, quizzes and the rest join this part when they ship.
 */
@Injectable()
export class CoreExport implements DataExportPart {
  constructor(private readonly db: PrismaService) {}

  async exportFor(userId: string) {
    const [progress, marks, reports, appeals, actions] = await Promise.all([
      this.db.coreTopicProgress.findMany({ where: { userId }, orderBy: { topicKey: 'asc' } }),
      this.db.coreProblemMark.findMany({ where: { userId }, orderBy: { markedAt: 'asc' } }),
      this.db.report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'asc' } }),
      this.db.moderationAppeal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.db.moderationAction.findMany({ where: { entityType: 'USER', entityId: userId }, orderBy: { createdAt: 'asc' } }),
    ])
    return {
      files: [
        { path: 'data/core/study-progress.json', bytes: json(progress.map(({ userId: _u, ...p }) => p)) },
        { path: 'data/core/problem-marks.json', bytes: json(marks.map(({ userId: _u, ...m }) => m)) },
        { path: 'data/core/reports-you-filed.json', bytes: json(reports.map((r) => ({ entityType: r.entityType, entityId: r.entityId, reason: r.reason, details: r.details, status: r.status, createdAt: r.createdAt }))) },
        { path: 'data/core/your-appeals.json', bytes: json(appeals.map((a) => ({ entityType: a.entityType, entityId: a.entityId, message: a.message, status: a.status, createdAt: a.createdAt, decidedAt: a.decidedAt }))) },
        { path: 'data/core/moderation-of-your-account.json', bytes: json(actions.map((a) => ({ action: a.action, reason: a.reason, createdAt: a.createdAt }))) },
      ],
      counts: { studyProgress: progress.length, problemMarks: marks.length, reports: reports.length, appeals: appeals.length },
      omitted: [],
    }
  }
}

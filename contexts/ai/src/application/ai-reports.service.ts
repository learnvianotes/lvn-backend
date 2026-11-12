import { Inject, Injectable } from '@nestjs/common'
import { AI_REPORT_MAX_PER_HOUR_DEFAULT, AI_REPORT_MAX_PER_HOUR_SETTING, GlobalRole } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { POLICY, PLATFORM_SETTINGS, type PlatformSettings, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'

const REASONS = ['INACCURATE', 'INAPPROPRIATE', 'HARMFUL', 'PERSONAL_INFO', 'OTHER'] as const
const KINDS = ['ANSWER', 'ARTIFACT'] as const

export type AiReportReasonName = (typeof REASONS)[number]
export type AiReportKind = (typeof KINDS)[number]

export interface ReportInput {
  responseId: string
  responseKind: string
  reason: string
  comment?: string | null
}

/**
 * Reports of AI answers (Families policy). The row stores the response id and the task, status and note id.
 * The question and the answer text are not copied. Listing and resolving are platform-admin only.
 */
@Injectable()
export class AiReportsService {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(PLATFORM_SETTINGS) private readonly settings: PlatformSettings,
  ) {}

  async report(userId: string, input: ReportInput) {
    const kind = this.kind(input.responseKind)
    const reason = this.reason(input.reason)
    const comment = input.comment?.trim() ?? ''
    if (comment.length > 500) throw Errors.validation('Keep the comment under 500 characters.', ['input', 'comment'])
    const max = this.settings.integer(AI_REPORT_MAX_PER_HOUR_SETTING, AI_REPORT_MAX_PER_HOUR_DEFAULT) ?? AI_REPORT_MAX_PER_HOUR_DEFAULT
    const hit = await this.limiter.hit(`ai-report:${userId}`, { max, windowSeconds: 60 * 60 })
    if (!hit.allowed) throw Errors.rateLimited(hit.retryAfter, 'Too many reports. Try again later.')
    const context = await this.contextOf(userId, input.responseId, kind)
    if (!context) throw Errors.notFound('That answer was not found.')
    const row = await this.db.aiReport.create({
      data: {
        id: newId(),
        reporterId: userId,
        responseId: input.responseId,
        responseKind: kind,
        reason,
        comment: comment || null,
        context: context as Prisma.InputJsonValue,
        status: 'OPEN',
      },
    })
    return row
  }

  async list(adminId: string, filter: { status?: 'OPEN' | 'RESOLVED' | 'DISMISSED' | null; first?: number | null }) {
    await this.assertAdmin(adminId)
    const take = Math.min(Math.max(filter.first ?? 20, 1), 50)
    return this.db.aiReport.findMany({ where: { status: filter.status ?? 'OPEN' }, orderBy: { createdAt: 'desc' }, take })
  }

  async get(adminId: string, id: string) {
    await this.assertAdmin(adminId)
    const row = await this.db.aiReport.findUnique({ where: { id } })
    if (!row) throw Errors.notFound('That report was not found.')
    return row
  }

  async resolve(adminId: string, id: string) {
    return this.close(adminId, id, 'RESOLVED')
  }

  async dismiss(adminId: string, id: string) {
    return this.close(adminId, id, 'DISMISSED')
  }

  private async close(adminId: string, id: string, status: 'RESOLVED' | 'DISMISSED') {
    await this.assertAdmin(adminId)
    const row = await this.db.aiReport.findUnique({ where: { id } })
    if (!row) throw Errors.notFound('That report was not found.')
    if (row.status !== 'OPEN') throw Errors.conflict('This report is already closed.')
    return this.db.aiReport.update({ where: { id }, data: { status, resolvedBy: adminId, resolvedAt: new Date() } })
  }

  /** The reporter owns the answer, or the artifact has no owner (a public study aid). */
  private async contextOf(userId: string, responseId: string, kind: AiReportKind): Promise<{ task: string; status: string; noteId: string | null } | null> {
    if (kind === 'ANSWER') {
      const row = await this.db.aiAnswer.findUnique({ where: { id: responseId }, select: { askerId: true, status: true, noteId: true } })
      if (!row || row.askerId !== userId) return null
      return { task: 'ASK', status: row.status, noteId: row.noteId }
    }
    const row = await this.db.noteArtifact.findUnique({ where: { id: responseId }, select: { ownerId: true, task: true, status: true, noteId: true } })
    if (!row || (row.ownerId !== null && row.ownerId !== userId)) return null
    return { task: row.task, status: row.status, noteId: row.noteId }
  }

  private kind(value: string): AiReportKind {
    if ((KINDS as readonly string[]).includes(value)) return value as AiReportKind
    throw Errors.validation('Say whether this is an answer or a task result.', ['input', 'responseKind'])
  }

  private reason(value: string): AiReportReasonName {
    if ((REASONS as readonly string[]).includes(value)) return value as AiReportReasonName
    throw Errors.validation('Choose a reason.', ['input', 'reason'])
  }

  private async assertAdmin(userId: string) {
    const actor = await this.policy.actor(userId)
    if (actor?.globalRole !== GlobalRole.PLATFORM_ADMIN) throw Errors.forbidden('Only platform admins review AI reports.')
  }
}

import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { AiReportsService, type ReportInput } from '../application/ai-reports.service'

type ReportRow = Awaited<ReturnType<AiReportsService['get']>>

@Resolver()
export class AiReportsResolver {
  constructor(private readonly reports: AiReportsService) {}

  @Query('aiReports')
  @UseGuards(SignedInGuard)
  aiReports(@Args('status') status: 'OPEN' | 'RESOLVED' | 'DISMISSED' | null, @Args('first') first: number | null, @CurrentViewer() viewer: Viewer) {
    return this.reports.list(viewer.userId, { status, first })
  }

  @Query('aiReport')
  @UseGuards(SignedInGuard)
  aiReport(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    return this.reports.get(viewer.userId, id)
  }

  @Mutation('reportAiAnswer')
  @UseGuards(SignedInGuard)
  reportAiAnswer(@Args('input') input: ReportInput, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ reportId: string | null; userErrors: UserError[] }>(async () => ({ reportId: (await this.reports.report(viewer.userId, input)).id }), { reportId: null })
  }

  @Mutation('resolveAiReport')
  @UseGuards(SignedInGuard)
  resolveAiReport(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ report: ReportRow | null; userErrors: UserError[] }>(async () => ({ report: await this.reports.resolve(viewer.userId, id) }), { report: null })
  }

  @Mutation('dismissAiReport')
  @UseGuards(SignedInGuard)
  dismissAiReport(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ report: ReportRow | null; userErrors: UserError[] }>(async () => ({ report: await this.reports.dismiss(viewer.userId, id) }), { report: null })
  }
}

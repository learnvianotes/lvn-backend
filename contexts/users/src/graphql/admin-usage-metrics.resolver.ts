import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { AdminUsageMetricsService } from '../application/admin-usage-metrics.service'
import type {
  AdminContentStats,
  AdminEngagement,
  AdminGrowth,
  AdminTopSubjects,
  AdminVerificationStats,
  QueryAdminContentStatsArgs,
  QueryAdminEngagementArgs,
  QueryAdminGrowthArgs,
  QueryAdminTopSubjectsArgs,
  QueryAdminVerificationStatsArgs,
} from './schema.types'

/** Usage metrics for the platform-admin dashboard (ADR-0105). Aggregates only; small groups are left out. */
@Resolver()
@UseGuards(SignedInGuard)
export class AdminUsageMetricsResolver {
  constructor(private readonly metrics: AdminUsageMetricsService) {}

  @Query('adminGrowth')
  adminGrowth(@Args() args: QueryAdminGrowthArgs, @CurrentViewer() viewer: Viewer): Promise<AdminGrowth> {
    return this.metrics.growth(viewer.userId, args.from, args.to, args.interval)
  }

  @Query('adminEngagement')
  adminEngagement(@Args() args: QueryAdminEngagementArgs, @CurrentViewer() viewer: Viewer): Promise<AdminEngagement> {
    return this.metrics.engagement(viewer.userId, args.from, args.to, args.interval)
  }

  @Query('adminContentStats')
  adminContentStats(@Args() args: QueryAdminContentStatsArgs, @CurrentViewer() viewer: Viewer): Promise<AdminContentStats> {
    return this.metrics.content(viewer.userId, args.from, args.to)
  }

  @Query('adminTopSubjects')
  adminTopSubjects(@Args() args: QueryAdminTopSubjectsArgs, @CurrentViewer() viewer: Viewer): Promise<AdminTopSubjects> {
    return this.metrics.topSubjects(viewer.userId, args.from, args.to, args.by, args.first)
  }

  @Query('adminVerificationStats')
  adminVerificationStats(@Args() args: QueryAdminVerificationStatsArgs, @CurrentViewer() viewer: Viewer): Promise<AdminVerificationStats> {
    return this.metrics.verification(viewer.userId, args.from, args.to)
  }
}

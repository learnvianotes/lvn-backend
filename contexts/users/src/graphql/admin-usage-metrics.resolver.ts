import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, RequireMfa, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { AdminUsageMetricsService } from '../application/admin-usage-metrics.service'
import type {
  AdminContentStats,
  AdminEngagement,
  AdminFeatureUsage,
  AdminGrowth,
  AdminRetention,
  AdminSearchQuality,
  AdminTopSubjects,
  AdminVerificationStats,
  AdminVersionAdoption,
  QueryAdminContentStatsArgs,
  QueryAdminEngagementArgs,
  QueryAdminFeatureUsageArgs,
  QueryAdminGrowthArgs,
  QueryAdminRetentionArgs,
  QueryAdminSearchQualityArgs,
  QueryAdminTopSubjectsArgs,
  QueryAdminVerificationStatsArgs,
  QueryAdminVersionAdoptionArgs,
} from './schema.types'

/** Usage metrics for the platform-admin dashboard (ADR-0105, ADR-0106, ADR-0107). Aggregates only; small groups are left out. */
@Resolver()
@UseGuards(SignedInGuard)
@RequireMfa()
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

  @Query('adminRetention')
  adminRetention(@Args() args: QueryAdminRetentionArgs, @CurrentViewer() viewer: Viewer): Promise<AdminRetention> {
    return this.metrics.retention(viewer.userId, args.cohortInterval, args.weeks)
  }

  @Query('adminFeatureUsage')
  adminFeatureUsage(@Args() args: QueryAdminFeatureUsageArgs, @CurrentViewer() viewer: Viewer): Promise<AdminFeatureUsage> {
    return this.metrics.featureUsage(viewer.userId, args.from, args.to)
  }

  @Query('adminSearchQuality')
  adminSearchQuality(@Args() args: QueryAdminSearchQualityArgs, @CurrentViewer() viewer: Viewer): Promise<AdminSearchQuality> {
    return this.metrics.searchQuality(viewer.userId, args.from, args.to)
  }

  @Query('adminVersionAdoption')
  adminVersionAdoption(@Args() args: QueryAdminVersionAdoptionArgs, @CurrentViewer() viewer: Viewer): Promise<AdminVersionAdoption> {
    return this.metrics.versionAdoption(viewer.userId, args.from, args.to)
  }
}

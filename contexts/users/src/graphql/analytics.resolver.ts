import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { AdminService } from '../application/admin.service'
import { AnalyticsService, type IngestInput } from '../application/analytics.service'
import type { OkPayload } from './schema.types'

/** Error log, usage analytics, and the errors-dashboard account lookup (B7–B9). */
@Resolver()
@UseGuards(SignedInGuard)
export class AnalyticsResolver {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly admin: AdminService,
  ) {}

  @Query('adminErrors')
  adminErrors(@Args('since') since: Date | null, @CurrentViewer() viewer: Viewer) {
    return this.analytics.errorGroups(viewer.userId, since)
  }

  @Query('adminUsage')
  adminUsage(@Args('from') from: Date | null, @Args('to') to: Date | null, @CurrentViewer() viewer: Viewer) {
    return this.analytics.usage(viewer.userId, from, to)
  }

  @Query('adminUserActivity')
  adminUserActivity(@Args('userId') userId: string, @Args('first') first: number | null, @CurrentViewer() viewer: Viewer) {
    return this.analytics.userActivity(viewer.userId, userId, first ?? 50)
  }

  @Query('adminFunnel')
  adminFunnel(@Args('steps') steps: string[], @Args('since') since: Date | null, @CurrentViewer() viewer: Viewer) {
    return this.analytics.funnel(viewer.userId, steps, since)
  }

  @Query('usersByIds')
  usersByIds(@Args('ids') ids: string[], @CurrentViewer() viewer: Viewer) {
    return this.admin.usersByIds(viewer.userId, ids)
  }

  @Mutation('ingestAnalytics')
  ingestAnalytics(@Args('input') input: IngestInput, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.analytics.ingest(viewer.userId, viewer.sessionId, input)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('setAnalyticsOptOut')
  setAnalyticsOptOut(@Args('optOut') optOut: boolean, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.analytics.setOptOut(viewer.userId, optOut)
      return { ok: true }
    }, { ok: false })
  }
}

/** `User.analyticsOptOut`, for the viewer only. */
@Resolver('User')
export class AnalyticsOptOutResolver {
  constructor(private readonly analytics: AnalyticsService) {}

  @ResolveField('analyticsOptOut')
  analyticsOptOut(@Parent() user: { id: string }, @CurrentViewer() viewer: Viewer | null): Promise<boolean | null> {
    if (!viewer || viewer.userId !== user.id) return Promise.resolve(null)
    return this.analytics.optOut(user.id)
  }
}

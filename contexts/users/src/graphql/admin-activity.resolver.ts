import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, RequireMfa, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { AdminActivityService } from '../application/admin-activity.service'
import type { AdminActivityConnection, AdminActivitySummary, QueryAdminActivityArgs, QueryAdminActivitySummaryArgs } from './schema.types'

/** The append-only audit log on the admin dashboard. MFA is required, the same as every other admin operation. */
@Resolver()
@UseGuards(SignedInGuard)
@RequireMfa()
export class AdminActivityResolver {
  constructor(private readonly activity: AdminActivityService) {}

  @Query('adminActivity')
  adminActivity(@Args() args: QueryAdminActivityArgs, @CurrentViewer() viewer: Viewer): Promise<AdminActivityConnection> {
    return this.activity.list(viewer.userId, args.filter, args.cursor, args.limit) as Promise<AdminActivityConnection>
  }

  @Query('adminActivitySummary')
  adminActivitySummary(@Args() args: QueryAdminActivitySummaryArgs, @CurrentViewer() viewer: Viewer): Promise<AdminActivitySummary> {
    return this.activity.summary(viewer.userId, args.from, args.to) as Promise<AdminActivitySummary>
  }
}

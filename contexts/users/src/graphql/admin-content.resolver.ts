import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, RequireMfa, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { AdminContentService, type AdminContentFilter } from '../application/admin-content.service'

/** Platform-admin content browser. Private items are excluded in AdminContentService, and every browse is audited. */
@Resolver()
@UseGuards(SignedInGuard)
@RequireMfa()
export class AdminContentResolver {
  constructor(private readonly content: AdminContentService) {}

  @Query('adminContent')
  adminContent(@Args('filter', { nullable: true }) filter: AdminContentFilter | null, @Args('first', { nullable: true }) first: number | null, @Args('after', { nullable: true }) after: string | null, @CurrentViewer() viewer: Viewer) {
    return this.content.list(viewer.userId, filter, first, after)
  }

  @Query('adminContentCounts')
  adminContentCounts(@Args('from', { nullable: true }) from: Date | null, @Args('to', { nullable: true }) to: Date | null, @CurrentViewer() viewer: Viewer) {
    return this.content.counts(viewer.userId, from, to)
  }
}

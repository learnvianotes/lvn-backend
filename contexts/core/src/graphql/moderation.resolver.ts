import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, RequireMfa, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { decodeCursor, encodeCursor, pageSize } from '@lvn-backend/graphql'
import { GroupsService } from '../application/groups.service'
import { ModerationService, type ModerationCase } from '../application/moderation.service'
import { ScopedReportsService } from '../application/scoped-reports.service'
import type { MutationAppealModerationArgs, MutationModerateContentArgs, MutationReportContentArgs, OkPayload, QueryModerationQueueArgs } from './schema.types'

const userRef = (id: string) => ({ __typename: 'User', id })

@Resolver('ModerationCase')
@UseGuards(SignedInGuard)
export class ModerationResolver {
  constructor(
    private readonly moderation: ModerationService,
    private readonly reports: ScopedReportsService,
    private readonly groups: GroupsService,
  ) {}

  @Query('moderationQueue')
  @RequireMfa()
  async moderationQueue(@Args() { first, after, scope }: QueryModerationQueueArgs, @CurrentViewer() viewer: Viewer) {
    const size = pageSize(first)
    const offset = Number(decodeCursor(after, 1)?.[0] ?? 0)
    const { cases, hasMore } = await this.moderation.queue(viewer.userId, offset, size, scope ? { scope: scope.scope, scopeId: scope.id ?? null } : null)
    const edges = cases.map((node, i) => ({ cursor: encodeCursor([offset + i + 1]), node }))
    return { edges, pageInfo: { hasNextPage: hasMore, endCursor: edges.at(-1)?.cursor ?? null } }
  }

  @Mutation('reportContent')
  reportContent(@Args() { input }: MutationReportContentArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.reports.report(viewer.userId, input)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('moderateContent')
  @RequireMfa()
  moderateContent(@Args() { input }: MutationModerateContentArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.moderation.decide(viewer.userId, input)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('appealModeration')
  appealModeration(@Args() { input }: MutationAppealModerationArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.moderation.appeal(viewer.userId, input)
      return { ok: true }
    }, { ok: false })
  }

  @Query('myStanding')
  myStanding(@CurrentViewer() viewer: Viewer) {
    return this.moderation.standing(viewer.userId)
  }

  @Query('removedGroup')
  removedGroup(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    return this.moderation.removedGroup(viewer.userId, id)
  }

  @ResolveField('user')
  user(@Parent() c: ModerationCase) {
    return c.entityType === 'USER' ? userRef(c.entityId) : null
  }

  @ResolveField('suspendedUntil')
  async suspendedUntil(@Parent() c: ModerationCase) {
    return c.entityType === 'USER' ? ((await this.moderation.suspensionOf(c.entityId))?.until ?? null) : null
  }

  @ResolveField('removedGroup')
  removedGroupOfCase(@Parent() c: ModerationCase) {
    // Only moderators read the queue, so the owner check of removedGroup() does not apply here.
    return c.entityType === 'GROUP' ? this.moderation.removedGroupForModerators(c.entityId) : null
  }

  @ResolveField('group')
  async group(@Parent() c: ModerationCase, @CurrentViewer() viewer: Viewer) {
    if (!c.groupId) return null
    const view = await this.groups.view(viewer.userId, c.groupId)
    return view ? { ...view.group, view } : null
  }
}

@Resolver('Group')
@UseGuards(SignedInGuard)
export class GroupModerationResolver {
  constructor(private readonly moderation: ModerationService) {}

  @ResolveField('moderationWarning')
  async moderationWarning(@Parent() g: { id: string; ownerId: string }, @CurrentViewer() viewer: Viewer) {
    if (g.ownerId !== viewer.userId) return null
    return this.moderation.groupWarning(g.id)
  }
}

@Resolver('ModeratedContent')
export class ModeratedContentResolver {
  @ResolveField('author')
  author(@Parent() c: { authorId: string }) {
    return userRef(c.authorId)
  }
}

@Resolver('ModerationReport')
export class ModerationReportResolver {
  @ResolveField('reporter')
  reporter(@Parent() r: { reporterId: string | null }) {
    return r.reporterId ? userRef(r.reporterId) : null
  }
}

@Resolver('ModeratedNote')
export class ModeratedNoteResolver {
  @ResolveField('owner')
  owner(@Parent() n: { ownerId: string }) {
    return userRef(n.ownerId)
  }
}

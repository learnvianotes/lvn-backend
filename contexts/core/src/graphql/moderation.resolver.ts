import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { decodeCursor, encodeCursor, pageSize } from '@lvn-backend/graphql'
import { ModerationService, type ModerationCase } from '../application/moderation.service'
import type { MutationAppealModerationArgs, MutationModerateContentArgs, MutationReportContentArgs, OkPayload, QueryModerationQueueArgs } from './schema.types'

const userRef = (id: string) => ({ __typename: 'User', id })

@Resolver('ModerationCase')
@UseGuards(SignedInGuard)
export class ModerationResolver {
  constructor(private readonly moderation: ModerationService) {}

  @Query('moderationQueue')
  async moderationQueue(@Args() { first, after }: QueryModerationQueueArgs, @CurrentViewer() viewer: Viewer) {
    const size = pageSize(first)
    const offset = Number(decodeCursor(after, 1)?.[0] ?? 0)
    const { cases, hasMore } = await this.moderation.queue(viewer.userId, offset, size)
    const edges = cases.map((node, i) => ({ cursor: encodeCursor([offset + i + 1]), node }))
    return { edges, pageInfo: { hasNextPage: hasMore, endCursor: edges.at(-1)?.cursor ?? null } }
  }

  @Mutation('reportContent')
  reportContent(@Args() { input }: MutationReportContentArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.moderation.report(viewer.userId, input)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('moderateContent')
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

  @ResolveField('user')
  user(@Parent() c: ModerationCase) {
    return c.entityType === 'USER' ? userRef(c.entityId) : null
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

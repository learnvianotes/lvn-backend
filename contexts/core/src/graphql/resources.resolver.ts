import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { ResourcesService, type ResourceInput, type ResourceView } from '../application/resources.service'
import type { ModerationCase } from '../application/moderation.service'

type Payload = { resource: ResourceView | null; userErrors: UserError[] }

/** Resources (§14.4, ADR-0074): approved ones are readable by guests too, so only the resolvers that need it sign in. */
@Resolver('Resource')
export class ResourcesResolver {
  constructor(private readonly resources: ResourcesService) {}

  @Query('resource')
  resource(@Args('id') id: string, @CurrentViewer() viewer: Viewer | null) {
    return this.resources.one(viewer?.userId ?? null, id)
  }

  @Query('myResources')
  @UseGuards(SignedInGuard)
  myResources(@CurrentViewer() viewer: Viewer) {
    return this.resources.mine(viewer.userId)
  }

  @Query('resourceTopicOptions')
  @UseGuards(SignedInGuard)
  resourceTopicOptions(@Args('query') query: string, @CurrentViewer() viewer: Viewer) {
    return this.resources.topicOptions(viewer.userId, query)
  }

  @Query('resourcePreview')
  @UseGuards(SignedInGuard)
  async resourcePreview(@Args('input') input: { url?: string | null; isbn?: string | null }, @CurrentViewer() viewer: Viewer) {
    const preview = await this.resources.preview(viewer.userId, input)
    return { ...preview, existing: preview.existingId ? await this.resources.one(viewer.userId, preview.existingId) : null }
  }

  @Mutation('submitResource')
  @UseGuards(SignedInGuard)
  submitResource(@Args('input') input: ResourceInput, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => {
      const id = await this.resources.submit(viewer.userId, input)
      return { resource: await this.resources.one(viewer.userId, id) }
    }, { resource: null })
  }

  @Mutation('updateResource')
  @UseGuards(SignedInGuard)
  updateResource(@Args('input') input: ResourceInput & { id: string; removeCover?: boolean | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => {
      await this.resources.update(viewer.userId, input)
      return { resource: await this.resources.one(viewer.userId, input.id) }
    }, { resource: null })
  }

  @Mutation('deleteResource')
  @UseGuards(SignedInGuard)
  deleteResource(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ ok: boolean; userErrors: UserError[] }>(async () => (await this.resources.remove(viewer.userId, input.id), { ok: true }), { ok: false })
  }

  @ResolveField('topics')
  topics(@Parent() r: ResourceView) {
    return r.topicIds.map((id) => ({ __typename: 'Topic', id }))
  }

  @ResolveField('submittedBy')
  submittedBy(@Parent() r: ResourceView) {
    return { __typename: 'User', id: r.submittedById }
  }

  @ResolveField('coverUrl')
  coverUrl(@Parent() r: ResourceView) {
    return this.resources.coverUrl(r)
  }

  @ResolveField('reason')
  reason(@Parent() r: ResourceView) {
    return r.viewerCan.seeReason ? r.reason : null
  }

  @ResolveField('viewerCan')
  viewerCan(@Parent() r: ResourceView) {
    return { edit: r.viewerCan.edit, delete: r.viewerCan.delete, report: r.viewerCan.report }
  }
}

/** A resource case in the moderation queue: moderators read every resource. */
@Resolver('ModerationCase')
@UseGuards(SignedInGuard)
export class ResourceCaseResolver {
  constructor(private readonly resources: ResourcesService) {}

  @ResolveField('resource')
  resource(@Parent() c: ModerationCase, @CurrentViewer() viewer: Viewer) {
    return c.entityType === 'RESOURCE' ? this.resources.one(viewer.userId, c.entityId) : null
  }
}

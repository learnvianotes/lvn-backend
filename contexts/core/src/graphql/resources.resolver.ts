import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { Errors, withUserErrors, type UserError } from '@lvn-backend/errors'
import { decodeCursor, encodeCursor, pageSize } from '@lvn-backend/graphql'
import { ResourcesService, type ResourceInput, type ResourceView } from '../application/resources.service'
import type { ModerationCase } from '../application/moderation.service'
import { INDEXABLE_AT_SAVES, ResourceCatalogueService, type CatalogueFilter, type CatalogueSort, type RecommendationPlace, type RecommendationRow } from '../application/resource-catalogue.service'

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

type Ok = { ok: boolean; userErrors: UserError[] }
type Place = { userId?: string | null; groupId?: string | null; classroomId?: string | null }

/** Exactly one place, or a validation error. */
function placeOf(to: Place): RecommendationPlace {
  const given = [to.userId && { userId: to.userId }, to.groupId && { groupId: to.groupId }, to.classroomId && { classroomId: to.classroomId }].filter(Boolean) as RecommendationPlace[]
  if (given.length !== 1) throw Errors.validation('Choose one person, group or class.', ['input', 'to'])
  return given[0]!
}

const page = <T>(items: T[], offset: number, hasMore: boolean) => {
  const edges = items.map((node, i) => ({ cursor: encodeCursor([offset + i + 1]), node }))
  return { edges, pageInfo: { hasNextPage: hasMore, endCursor: edges.at(-1)?.cursor ?? null } }
}
const offsetOf = (after?: string | null) => Number(decodeCursor(after ?? null, 1)?.[0] ?? 0)

/** The catalogue, saves and recommendations (ADR-0075). */
@Resolver('Resource')
export class ResourceCatalogueResolver {
  constructor(
    private readonly catalogue: ResourceCatalogueService,
    private readonly resources: ResourcesService,
  ) {}

  @Query('resources')
  async list(@Args() args: { filter?: CatalogueFilter | null; sort?: CatalogueSort | null; first?: number | null; after?: string | null }, @CurrentViewer() viewer: Viewer | null) {
    const offset = offsetOf(args.after)
    const { items, hasMore } = await this.catalogue.list(viewer?.userId ?? null, args.filter ?? {}, args.sort ?? 'POPULAR', offset, pageSize(args.first))
    return page(items, offset, hasMore)
  }

  @Query('savedResources')
  @UseGuards(SignedInGuard)
  async saved(@Args() args: { first?: number | null; after?: string | null }, @CurrentViewer() viewer: Viewer) {
    const offset = offsetOf(args.after)
    const { items, hasMore } = await this.catalogue.saved(viewer.userId, offset, pageSize(args.first))
    return page(items, offset, hasMore)
  }

  @Query('resourceRecommendations')
  @UseGuards(SignedInGuard)
  async recommendations(@Args() args: { to: Place; first?: number | null; after?: string | null }, @CurrentViewer() viewer: Viewer) {
    const offset = offsetOf(args.after)
    const { items, hasMore } = await this.catalogue.recommendations(viewer.userId, placeOf(args.to), offset, pageSize(args.first))
    return page(items, offset, hasMore)
  }

  @Mutation('saveResource')
  @UseGuards(SignedInGuard)
  saveResource(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => (await this.catalogue.save(viewer.userId, input.id), { resource: await this.resources.one(viewer.userId, input.id) }), { resource: null })
  }

  @Mutation('unsaveResource')
  @UseGuards(SignedInGuard)
  unsaveResource(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => (await this.catalogue.unsave(viewer.userId, input.id), { resource: await this.resources.one(viewer.userId, input.id) }), { resource: null })
  }

  @Mutation('recommendResource')
  @UseGuards(SignedInGuard)
  recommendResource(@Args('input') input: { resourceId: string; to: Place; reason?: string | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.catalogue.recommend(viewer.userId, { resourceId: input.resourceId, to: placeOf(input.to), reason: input.reason }), { ok: true }), { ok: false })
  }

  @Mutation('removeResourceRecommendation')
  @UseGuards(SignedInGuard)
  removeResourceRecommendation(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.catalogue.removeRecommendation(viewer.userId, input.id), { ok: true }), { ok: false })
  }

  @ResolveField('saveCount')
  async saveCount(@Parent() r: ResourceView) {
    return (await this.catalogue.saveCounts([r.id])).get(r.id) ?? 0
  }

  @ResolveField('viewerSaved')
  async viewerSaved(@Parent() r: ResourceView, @CurrentViewer() viewer: Viewer | null) {
    return viewer ? (await this.catalogue.savedBy(viewer.userId, [r.id])).has(r.id) : false
  }

  @ResolveField('indexable')
  async indexable(@Parent() r: ResourceView) {
    return r.status === 'APPROVED' && ((await this.catalogue.saveCounts([r.id])).get(r.id) ?? 0) >= INDEXABLE_AT_SAVES
  }
}

@Resolver('ResourceRecommendation')
@UseGuards(SignedInGuard)
export class ResourceRecommendationResolver {
  constructor(private readonly catalogue: ResourceCatalogueService) {}

  @ResolveField('from')
  from(@Parent() r: RecommendationRow) {
    return { __typename: 'User', id: r.fromUserId }
  }

  @ResolveField('viewerCanRemove')
  async viewerCanRemove(@Parent() r: RecommendationRow, @CurrentViewer() viewer: Viewer) {
    return this.catalogue.canRemove(viewer.userId, r)
  }
}

/** A resource another subgraph names (search, ADR-0075): resolved as the viewer reads it, null when they may not. */
@Resolver('Resource')
export class ResourceReferenceResolver {
  constructor(private readonly resources: ResourcesService) {}

  // Apollo calls this with (reference, context, info); no parameter decorators (see GroupReferenceResolver).
  @ResolveReference()
  resolveReference(reference: { id: string }, context: RequestContext) {
    return this.resources.one(context.viewer?.userId ?? null, reference.id)
  }
}

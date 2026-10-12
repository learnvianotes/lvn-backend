import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { connection, decodeCursor, pageSize } from '@lvn-backend/graphql'
import type { Prisma } from '@lvn-backend/prisma-base'
import { GroupsService, effectivePolicy, type GroupRow, type GroupView } from '../application/groups.service'
import type { GroupPayload, GroupPostPayload, OkPayload } from './schema.types'

const userRef = (id: string) => ({ __typename: 'User', id })

/** A group as the API returns it: the row, and the viewer's place in it (resolved once per group per request). */
export type GroupParent = GroupRow & { view?: GroupView }
type PostRow = Prisma.GroupPostGetPayload<object>

const viewerOf = (ctx: RequestContext) => ctx.viewer?.userId ?? null

@Resolver('Group')
@UseGuards(SignedInGuard)
export class GroupsResolver {
  constructor(private readonly groups: GroupsService) {}

  /** The viewer's view of a group, loaded once and kept on the parent. */
  private async view(g: GroupParent, viewerId: string): Promise<GroupView> {
    if (!g.view) g.view = (await this.groups.view(viewerId, g.id)) ?? undefined
    if (!g.view) throw new Error('group not visible')
    return g.view
  }

  private async payload(viewerId: string, run: () => Promise<string>): Promise<GroupPayload> {
    return withUserErrors<GroupPayload>(
      async () => {
        const id = await run()
        const view = await this.groups.view(viewerId, id)
        return { group: view ? ({ ...view.group, view } as never) : null }
      },
      { group: null },
    )
  }

  @Query('group')
  async group(@Args('id') id: string, @CurrentViewer() viewer: Viewer): Promise<GroupParent | null> {
    const view = await this.groups.view(viewer.userId, id)
    return view ? { ...view.group, view } : null
  }

  @Query('myGroups')
  myGroups(@CurrentViewer() viewer: Viewer) {
    return this.groups.mine(viewer.userId)
  }

  @Query('discoverGroups')
  discoverGroups(@Args('query') query: string | null, @Args('first') first: number | null) {
    return this.groups.discover(query, pageSize(first, 20))
  }

  // ── Fields ──

  @ResolveField('joinPolicy')
  joinPolicy(@Parent() g: GroupParent) {
    return effectivePolicy(g)
  }

  @ResolveField('owner')
  owner(@Parent() g: GroupParent) {
    return userRef(g.ownerId)
  }

  @ResolveField('memberCount')
  async memberCount(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(g, viewer.userId)).memberCount
  }

  @ResolveField('viewerRole')
  async viewerRole(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(g, viewer.userId)).role
  }

  @ResolveField('viewerRequestId')
  async viewerRequestId(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(g, viewer.userId)).pendingRequestId
  }

  @ResolveField('viewerCan')
  async viewerCan(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(g, viewer.userId)).can
  }

  @ResolveField('members')
  async members(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    if (!(await this.view(g, viewer.userId)).role) return null
    return (await this.groups.members(viewer.userId, g.id)).map((m) => ({ user: userRef(m.userId), role: m.role, joinedAt: m.joinedAt, mutedUntil: m.mutedUntil }))
  }

  @ResolveField('joinRequests')
  async joinRequests(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    if (!(await this.view(g, viewer.userId)).can.reviewRequests) return null
    return (await this.groups.requests(viewer.userId, g.id)).map((r) => ({ id: r.id, user: userRef(r.userId), message: r.message, createdAt: r.createdAt }))
  }

  @ResolveField('posts')
  async posts(@Parent() g: GroupParent, @Args('first') first: number | null, @Args('after') after: string | null, @CurrentViewer() viewer: Viewer) {
    const view = await this.view(g, viewer.userId)
    if (!view.role) return null
    const size = pageSize(first)
    const { pinned, rows } = await this.groups.posts(viewer.userId, g.id, size, decodeCursor(after, 2) as [string, string] | null)
    const toPost = (p: PostRow) => post(p, viewer.userId, view.can.moderate)
    return { pinned: pinned.map(toPost), ...connection(rows, size, (p) => [p.createdAt.toISOString(), p.id], toPost) }
  }

  // ── Mutations ──

  @Mutation('createGroup')
  createGroup(@Args('input') input: { name: string; description?: string | null; privacy: 'PUBLIC' | 'PRIVATE'; joinPolicy?: 'OPEN' | 'APPROVAL' | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.groups.create(viewer.userId, input))
  }

  @Mutation('updateGroup')
  updateGroup(@Args('input') input: { groupId: string; name?: string | null; description?: string | null; privacy?: 'PUBLIC' | 'PRIVATE' | null; joinPolicy?: 'OPEN' | 'APPROVAL' | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.groups.update(viewer.userId, input.groupId, input), input.groupId))
  }

  @Mutation('deleteGroup')
  deleteGroup(@Args('input') input: { groupId: string }, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => (await this.groups.remove(viewer.userId, input.groupId), { ok: true }), { ok: false })
  }

  @Mutation('joinGroup')
  joinGroup(@Args('input') input: { groupId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.groups.join(viewer.userId, input.groupId), input.groupId))
  }

  @Mutation('requestToJoinGroup')
  requestToJoinGroup(@Args('input') input: { groupId: string; message?: string | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.groups.requestJoin(viewer.userId, input.groupId, input.message), input.groupId))
  }

  @Mutation('withdrawGroupJoinRequest')
  withdrawGroupJoinRequest(@Args('input') input: { requestId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.groups.withdrawRequest(viewer.userId, input.requestId))
  }

  @Mutation('reviewGroupJoinRequest')
  reviewGroupJoinRequest(@Args('input') input: { requestId: string; decision: 'APPROVED' | 'REJECTED' }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.groups.review(viewer.userId, input.requestId, input.decision))
  }

  @Mutation('leaveGroup')
  leaveGroup(@Args('input') input: { groupId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.groups.leave(viewer.userId, input.groupId), input.groupId))
  }

  @Mutation('removeGroupMember')
  removeGroupMember(@Args('input') input: { groupId: string; userId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.groups.removeMember(viewer.userId, input.groupId, input.userId), input.groupId))
  }

  @Mutation('setGroupRole')
  setGroupRole(@Args('input') input: { groupId: string; userId: string; role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.groups.setRole(viewer.userId, input.groupId, input.userId, input.role), input.groupId))
  }

  @Mutation('muteGroupMember')
  muteGroupMember(@Args('input') input: { groupId: string; userId: string; until?: Date | string | null }, @CurrentViewer() viewer: Viewer) {
    // DateTime inside an input object reaches the resolver as it was sent: make it a Date here.
    const until = input.until ? new Date(input.until) : null
    return this.payload(viewer.userId, async () => (await this.groups.mute(viewer.userId, input.groupId, input.userId, until), input.groupId))
  }

  private postPayload(viewerId: string, run: () => Promise<string>): Promise<GroupPostPayload> {
    return withUserErrors<GroupPostPayload>(
      async () => {
        const p = await this.groups.getPost(viewerId, await run())
        if (!p) return { post: null }
        const view = await this.groups.view(viewerId, p.groupId)
        return { post: post(p, viewerId, view?.can.moderate ?? false) as never }
      },
      { post: null },
    )
  }

  @Mutation('createGroupPost')
  createGroupPost(@Args('input') input: { groupId: string; body: unknown }, @CurrentViewer() viewer: Viewer) {
    return this.postPayload(viewer.userId, () => this.groups.post(viewer.userId, input.groupId, input.body))
  }

  @Mutation('editGroupPost')
  editGroupPost(@Args('input') input: { postId: string; body: unknown }, @CurrentViewer() viewer: Viewer) {
    return this.postPayload(viewer.userId, () => this.groups.editPost(viewer.userId, input.postId, input.body))
  }

  @Mutation('deleteGroupPost')
  deleteGroupPost(@Args('input') input: { postId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.groups.deletePost(viewer.userId, input.postId))
  }

  @Mutation('pinGroupPost')
  pinGroupPost(@Args('input') input: { postId: string; pinned: boolean }, @CurrentViewer() viewer: Viewer) {
    return this.postPayload(viewer.userId, () => this.groups.pinPost(viewer.userId, input.postId, input.pinned))
  }
}

/** A post with what the viewer may do to it. */
function post(p: PostRow, viewerId: string, moderate: boolean) {
  const mine = p.authorId === viewerId
  return { id: p.id, author: userRef(p.authorId), body: p.body, pinned: p.pinnedAt !== null, createdAt: p.createdAt, editedAt: p.editedAt, viewerCan: { edit: mine, delete: mine || moderate, pin: moderate } }
}

/** Groups referenced from other subgraphs (notes shared to a group): resolved for people who may see them. */
@Resolver('Group')
export class GroupReferenceResolver {
  constructor(private readonly groups: GroupsService) {}

  // Apollo calls this with (reference, context, info); no parameter decorators (see users' UserReferenceResolver).
  @ResolveReference()
  async resolveReference(reference: { id: string }, context: RequestContext): Promise<GroupParent | null> {
    const viewerId = viewerOf(context)
    if (!viewerId) return null
    const view = await this.groups.view(viewerId, reference.id)
    return view ? { ...view.group, view } : null
  }
}

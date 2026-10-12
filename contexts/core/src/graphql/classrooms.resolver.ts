import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { connection, decodeCursor, pageSize } from '@lvn-backend/graphql'
import { ClassroomsService, type ClassroomRow, type ClassroomView } from '../application/classrooms.service'
import type { ClassroomPayload, OkPayload } from './schema.types'

const userRef = (id: string) => ({ __typename: 'User', id })
export type ClassroomParent = ClassroomRow & { view?: ClassroomView }

@Resolver('Classroom')
@UseGuards(SignedInGuard)
export class ClassroomsResolver {
  constructor(private readonly classes: ClassroomsService) {}

  private async view(c: ClassroomParent, viewerId: string): Promise<ClassroomView> {
    if (!c.view) c.view = (await this.classes.view(viewerId, c.id)) ?? undefined
    if (!c.view) throw new Error('class not visible')
    return c.view
  }

  private payload(viewerId: string, run: () => Promise<string>): Promise<ClassroomPayload> {
    return withUserErrors<ClassroomPayload>(
      async () => {
        const id = await run()
        const view = await this.classes.view(viewerId, id)
        return { classroom: view ? ({ ...view.classroom, view } as never) : null }
      },
      { classroom: null },
    )
  }

  @Query('classroom')
  async classroom(@Args('id') id: string, @CurrentViewer() viewer: Viewer): Promise<ClassroomParent | null> {
    const view = await this.classes.view(viewer.userId, id)
    return view ? { ...view.classroom, view } : null
  }

  @Query('classroomByCode')
  async classroomByCode(@Args('code') code: string, @CurrentViewer() viewer: Viewer) {
    const found = await this.classes.byCode(viewer.userId, code)
    if (!found) return null
    return { id: found.classroom.id, name: found.classroom.name, teacher: userRef(found.classroom.ownerId), viewerRole: found.view?.role ?? null, viewerRequestId: found.view?.pendingRequestId ?? null }
  }

  @Query('myClassrooms')
  myClassrooms(@CurrentViewer() viewer: Viewer) {
    return this.classes.mine(viewer.userId)
  }

  @Query('myClassroomInvites')
  async myClassroomInvites(@CurrentViewer() viewer: Viewer) {
    return (await this.classes.myInvites(viewer.userId)).map((i) => ({
      id: i.id,
      role: i.role,
      expiresAt: i.expiresAt,
      invitedBy: userRef(i.invitedBy),
      classroom: { id: i.classroom.id, name: i.classroom.name, teacher: userRef(i.classroom.ownerId), viewerRole: null, viewerRequestId: null },
    }))
  }

  @ResolveField('teacher')
  teacher(@Parent() c: ClassroomParent) {
    return userRef(c.ownerId)
  }

  @ResolveField('memberCount')
  async memberCount(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(c, viewer.userId)).memberCount
  }

  @ResolveField('joinCode')
  async joinCode(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(c, viewer.userId)).can.review ? c.joinCode : null
  }

  @ResolveField('viewerRole')
  async viewerRole(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(c, viewer.userId)).role
  }

  @ResolveField('viewerRequestId')
  async viewerRequestId(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(c, viewer.userId)).pendingRequestId
  }

  @ResolveField('viewerInviteId')
  async viewerInviteId(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(c, viewer.userId)).inviteId
  }

  @ResolveField('viewerCan')
  async viewerCan(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(c, viewer.userId)).can
  }

  @ResolveField('members')
  async members(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    // Staff only: a class may have young learners, who are named to nobody else (ADR-0046).
    if (!(await this.view(c, viewer.userId)).can.review) return null
    return (await this.classes.members(viewer.userId, c.id)).map((m) => ({ user: userRef(m.userId), role: m.role, joinedAt: m.joinedAt }))
  }

  @ResolveField('joinRequests')
  async joinRequests(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    if (!(await this.view(c, viewer.userId)).can.review) return null
    return (await this.classes.requests(viewer.userId, c.id)).map((r) => ({ id: r.id, user: userRef(r.userId), via: r.via, createdAt: r.createdAt }))
  }

  @ResolveField('posts')
  async posts(@Parent() c: ClassroomParent, @Args('first') first: number | null, @Args('after') after: string | null, @CurrentViewer() viewer: Viewer) {
    const view = await this.view(c, viewer.userId)
    if (!view.role) return null
    const size = pageSize(first)
    const rows = await this.classes.posts(viewer.userId, c.id, size, decodeCursor(after, 2) as [string, string] | null)
    return connection(rows, size, (p) => [p.createdAt.toISOString(), p.id], (p) => ({ id: p.id, author: userRef(p.authorId), body: p.body, createdAt: p.createdAt, viewerCanDelete: view.can.post }))
  }

  @Mutation('createClassroom')
  createClassroom(@Args('input') input: { name: string; description?: string | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.classes.create(viewer.userId, input))
  }

  @Mutation('updateClassroom')
  updateClassroom(@Args('input') input: { classroomId: string; name?: string | null; description?: string | null; newCode?: boolean | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.classes.update(viewer.userId, input.classroomId, input), input.classroomId))
  }

  @Mutation('deleteClassroom')
  deleteClassroom(@Args('input') input: { classroomId: string }, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => (await this.classes.remove(viewer.userId, input.classroomId), { ok: true }), { ok: false })
  }

  @Mutation('requestToJoinClassroom')
  requestToJoinClassroom(@Args('input') input: { code: string; via?: 'CODE' | 'LINK' | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.classes.requestJoin(viewer.userId, input.code, input.via ?? 'CODE'))
  }

  @Mutation('withdrawClassroomJoinRequest')
  withdrawClassroomJoinRequest(@Args('input') input: { requestId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.classes.withdrawRequest(viewer.userId, input.requestId))
  }

  @Mutation('reviewClassroomJoinRequest')
  reviewClassroomJoinRequest(@Args('input') input: { requestId: string; decision: 'APPROVED' | 'REJECTED' }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.classes.review(viewer.userId, input.requestId, input.decision))
  }

  @Mutation('inviteToClassroom')
  inviteToClassroom(@Args('input') input: { classroomId: string; person: string; role?: 'STUDENT' | 'TA' | 'TEACHER' | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.classes.invite(viewer.userId, input.classroomId, input.person, input.role === 'TA' ? 'TA' : 'STUDENT'), input.classroomId))
  }

  @Mutation('answerClassroomInvite')
  answerClassroomInvite(@Args('input') input: { inviteId: string; accept: boolean }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.classes.answerInvite(viewer.userId, input.inviteId, input.accept))
  }

  @Mutation('leaveClassroom')
  leaveClassroom(@Args('input') input: { classroomId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.classes.leave(viewer.userId, input.classroomId), input.classroomId))
  }

  @Mutation('removeClassroomMember')
  removeClassroomMember(@Args('input') input: { classroomId: string; userId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.classes.removeMember(viewer.userId, input.classroomId, input.userId), input.classroomId))
  }

  @Mutation('setClassroomRole')
  setClassroomRole(@Args('input') input: { classroomId: string; userId: string; role: 'TEACHER' | 'TA' | 'STUDENT' }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.classes.setRole(viewer.userId, input.classroomId, input.userId, input.role), input.classroomId))
  }

  @Mutation('createClassroomPost')
  createClassroomPost(@Args('input') input: { classroomId: string; body: unknown }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.classes.post(viewer.userId, input.classroomId, input.body), input.classroomId))
  }

  @Mutation('deleteClassroomPost')
  deleteClassroomPost(@Args('input') input: { postId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.classes.deletePost(viewer.userId, input.postId))
  }
}

/** Classes referenced from other subgraphs (notes shared to a class): resolved for people who may see them. */
@Resolver('Classroom')
export class ClassroomReferenceResolver {
  constructor(private readonly classes: ClassroomsService) {}

  // Apollo calls this with (reference, context, info); no parameter decorators (see users' UserReferenceResolver).
  @ResolveReference()
  async resolveReference(reference: { id: string }, context: RequestContext): Promise<ClassroomParent | null> {
    const viewerId = context.viewer?.userId
    if (!viewerId) return null
    const view = await this.classes.view(viewerId, reference.id)
    return view ? { ...view.classroom, view } : null
  }
}

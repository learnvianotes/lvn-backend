import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { BuddiesService } from '../application/buddies.service'
import { ClassInsightsService } from '../application/class-insights.service'
import { FocusService } from '../application/focus.service'
import type { ClassroomParent } from './classrooms.resolver'

type Ok = { ok: boolean; userErrors: UserError[] }
const userRef = (id: string) => ({ __typename: 'User', id })
const session = (s: Awaited<ReturnType<FocusService['current']>>) => (s ? { ...s, note: s.noteId ? { __typename: 'Note', id: s.noteId } : null } : null)

/** Focus sessions and Rhythm buddies (ADR-0072). */
@Resolver()
@UseGuards(SignedInGuard)
export class FocusResolver {
  constructor(
    private readonly focus: FocusService,
    private readonly buddies: BuddiesService,
  ) {}

  @Query('focusSession')
  async current(@CurrentViewer() viewer: Viewer) {
    return session(await this.focus.current(viewer.userId))
  }

  @Query('rhythmBuddies')
  async rhythmBuddies(@CurrentViewer() viewer: Viewer) {
    const list = await this.buddies.list(viewer.userId)
    return {
      buddies: list.buddies.map((b) => ({ ...b, user: userRef(b.userId) })),
      invites: list.invites.map((i) => ({ ...i, user: userRef(i.userId) })),
      sent: list.sent.map((i) => ({ ...i, user: userRef(i.userId) })),
    }
  }

  @Mutation('startFocusSession')
  start(@Args('input') input: { topicKey?: string | null; noteId?: string | null; minutes?: number | null; breakMinutes?: number | null; meetUrl?: string | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ session: ReturnType<typeof session>; userErrors: UserError[] }>(async () => ({ session: session(await this.focus.start(viewer.userId, input)) }), { session: null })
  }

  @Mutation('endFocusSession')
  end(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ session: ReturnType<typeof session>; userErrors: UserError[] }>(async () => ({ session: session(await this.focus.end(viewer.userId, input.id)) }), { session: null })
  }

  @Mutation('inviteRhythmBuddy')
  invite(@Args('input') input: { handle: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.buddies.invite(viewer.userId, input.handle), { ok: true }), { ok: false })
  }

  @Mutation('answerRhythmBuddy')
  answer(@Args('input') input: { id: string; accept: boolean }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.buddies.answer(viewer.userId, input.id, input.accept), { ok: true }), { ok: false })
  }

  @Mutation('removeRhythmBuddy')
  remove(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.buddies.remove(viewer.userId, input.id), { ok: true }), { ok: false })
  }
}

/** The class's Rhythm ring (members) and performance (staff) on the Classroom type. */
@Resolver('Classroom')
@UseGuards(SignedInGuard)
export class ClassroomInsightsResolver {
  constructor(private readonly insights: ClassInsightsService) {}

  @ResolveField('rhythmRing')
  async rhythmRing(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    const ring = await this.insights.ring(viewer.userId, c.id)
    return ring ? { ...ring, people: ring.people.map((p) => ({ ...p, user: userRef(p.userId) })) } : null
  }

  @ResolveField('performance')
  async performance(@Parent() c: ClassroomParent, @CurrentViewer() viewer: Viewer) {
    const p = await this.insights.performance(viewer.userId, c.id)
    return p ? { ...p, students: p.students.map((s) => ({ ...s, user: userRef(s.userId) })), topics: p.topics.map((t) => ({ ...t, topic: { __typename: 'Topic', id: t.topicId } })) } : null
  }
}

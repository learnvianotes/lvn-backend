import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { ContestsService, type ContestInput, type ContestView } from '../application/contests.service'

type Payload = { contest: ContestView | null; userErrors: UserError[] }
type Ok = { ok: boolean; userErrors: UserError[] }
type AdminRow = Awaited<ReturnType<ContestsService['adminList']>>[number]
type AdminPayload = { contest: ReturnType<typeof admin> | null; userErrors: UserError[] }

const admin = (c: AdminRow) => ({ ...c, published: c.status === 'PUBLISHED' })
const input = (i: Omit<ContestInput, 'opensAt' | 'closesAt'> & { opensAt: string | Date; closesAt: string | Date }): ContestInput => ({ ...i, opensAt: new Date(i.opensAt), closesAt: new Date(i.closesAt) })

/** Weekly contests (ADR-0082). */
@Resolver()
export class ContestsResolver {
  constructor(private readonly contests: ContestsService) {}

  @Query('contests')
  list(@CurrentViewer() viewer: Viewer | null) {
    return this.contests.list(viewer?.userId ?? null)
  }

  @Query('contest')
  one(@Args('id') id: string, @CurrentViewer() viewer: Viewer | null) {
    return this.contests.one(viewer?.userId ?? null, id)
  }

  @Query('contestSettings')
  @UseGuards(SignedInGuard)
  settings(@CurrentViewer() viewer: Viewer) {
    return this.contests.settings(viewer.userId)
  }

  @Query('adminContests')
  @UseGuards(SignedInGuard)
  async adminContests(@CurrentViewer() viewer: Viewer) {
    return (await this.contests.adminList(viewer.userId)).map(admin)
  }

  @Mutation('startContest')
  @UseGuards(SignedInGuard)
  start(@Args('input') i: { contestId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => ({ contest: await this.contests.start(viewer.userId, i.contestId) }), { contest: null })
  }

  @Mutation('answerContestQuestion')
  @UseGuards(SignedInGuard)
  answer(@Args('input') i: { attemptId: string; questionId: string; choiceId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => ({ contest: await this.contests.answer(viewer.userId, i) }), { contest: null })
  }

  @Mutation('submitContest')
  @UseGuards(SignedInGuard)
  submit(@Args('input') i: { attemptId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => ({ contest: await this.contests.submit(viewer.userId, i.attemptId) }), { contest: null })
  }

  @Mutation('setContestBands')
  @UseGuards(SignedInGuard)
  setBands(@Args('input') i: { show: boolean }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ settings: Awaited<ReturnType<ContestsService['settings']>> | null; userErrors: UserError[] }>(async () => ({ settings: await this.contests.setBands(viewer.userId, i.show) }), { settings: null })
  }

  private async adminOne(viewerId: string, id: string) {
    return (await this.contests.adminList(viewerId)).map(admin).find((c) => c.id === id) ?? null
  }

  @Mutation('saveContest')
  @UseGuards(SignedInGuard)
  save(@Args('input') i: Parameters<typeof input>[0] & { id?: string | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<AdminPayload>(
      async () => {
        const id = i.id ? (await this.contests.update(viewer.userId, i.id, input(i)), i.id) : await this.contests.create(viewer.userId, input(i))
        return { contest: await this.adminOne(viewer.userId, id) }
      },
      { contest: null },
    )
  }

  @Mutation('publishContest')
  @UseGuards(SignedInGuard)
  publish(@Args('input') i: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<AdminPayload>(async () => (await this.contests.publish(viewer.userId, i.id), { contest: await this.adminOne(viewer.userId, i.id) }), { contest: null })
  }

  @Mutation('deleteContest')
  @UseGuards(SignedInGuard)
  remove(@Args('input') i: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.contests.remove(viewer.userId, i.id), { ok: true }), { ok: false })
  }
}

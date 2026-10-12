import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { connection, decodeCursor, pageSize } from '@lvn-backend/graphql'
import { GroupsService, type GroupView } from '../application/groups.service'
import { WorkspacesService, type DoubtRow, type RepositoryDetails } from '../application/workspaces.service'
import type { GroupParent } from './groups.resolver'
import { post } from './groups.resolver'
import type { GroupPayload } from './schema.types'

const userRef = (id: string) => ({ __typename: 'User', id })

/** A doubt with what the viewer may do with it, resolved once. */
interface DoubtParent {
  row: DoubtRow
  can: { answer: boolean; resolve: boolean; reopen: boolean; delete: boolean }
}
type DoubtPayload = { doubt: DoubtParent | null; userErrors: UserError[] }

/** Project workspaces (ADR-0048): the parts a PROJECT group adds, and their mutations. */
@Resolver('Group')
@UseGuards(SignedInGuard)
export class WorkspaceGroupResolver {
  constructor(
    private readonly groups: GroupsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async view(g: GroupParent, viewerId: string): Promise<GroupView | null> {
    if (!g.view) g.view = (await this.groups.view(viewerId, g.id)) ?? undefined
    return g.view ?? null
  }

  @ResolveField('repository')
  async repository(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    if (g.type !== 'PROJECT' || !(await this.view(g, viewer.userId))) return null
    const repo = await this.workspaces.repository(g.id)
    if (!repo) return null
    const details = (repo.available ? repo.metadata : null) as RepositoryDetails | null
    return { provider: repo.provider, url: repo.url, available: repo.available, name: details?.name ?? null, description: details?.description ?? null, language: details?.language ?? null, stars: details?.stars ?? null, pushedAt: details?.pushedAt ? new Date(details.pushedAt) : null, refreshedAt: repo.refreshedAt }
  }

  @ResolveField('ideas')
  async ideas(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    const view = await this.view(g, viewer.userId)
    if (g.type !== 'PROJECT' || !view?.role) return null
    return (await this.workspaces.ideas(viewer.userId, g.id)).map((p) => post(p, viewer.userId, view.can.moderate))
  }

  @ResolveField('doubts')
  async doubts(@Parent() g: GroupParent, @Args('status') status: 'OPEN' | 'ANSWERED' | 'RESOLVED' | null, @Args('first') first: number | null, @Args('after') after: string | null, @CurrentViewer() viewer: Viewer) {
    const view = await this.view(g, viewer.userId)
    if (g.type !== 'PROJECT' || !view?.role) return null
    const size = pageSize(first)
    const rows = await this.workspaces.doubts(viewer.userId, g.id, status, size, decodeCursor(after, 2) as [string, string] | null)
    const parents = await Promise.all(rows.map(async (row) => (await this.workspaces.getDoubt(viewer.userId, row.id)) ?? { doubt: row, can: { answer: false, resolve: false, reopen: false, delete: false } }))
    const byId = new Map(parents.map((p) => [p.doubt.id, p.can]))
    return connection(rows, size, (d) => [d.createdAt.toISOString(), d.id], (row): DoubtParent => ({ row, can: byId.get(row.id)! }))
  }

  @ResolveField('viewerMentorInviteId')
  async viewerMentorInviteId(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    return (await this.view(g, viewer.userId))?.mentorInviteId ?? null
  }

  @ResolveField('showcase')
  async showcase(@Parent() g: GroupParent, @CurrentViewer() viewer: Viewer) {
    if (!g.showcaseNoteId || !(await this.view(g, viewer.userId))) return null
    return { __typename: 'Note', id: g.showcaseNoteId }
  }

  private payload(viewerId: string, run: () => Promise<string>): Promise<GroupPayload> {
    return withUserErrors<GroupPayload>(
      async () => {
        const id = await run()
        const view = await this.groups.view(viewerId, id)
        return { group: view ? ({ ...view.group, view } as never) : null }
      },
      { group: null },
    )
  }

  @Mutation('setGroupRepository')
  setGroupRepository(@Args('input') input: { groupId: string; url?: string | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.workspaces.setRepository(viewer.userId, input.groupId, input.url ?? null))
  }

  @Mutation('inviteMentor')
  inviteMentor(@Args('input') input: { groupId: string; person: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, async () => (await this.workspaces.inviteMentor(viewer.userId, input.groupId, input.person), input.groupId))
  }

  @Mutation('answerMentorInvite')
  answerMentorInvite(@Args('input') input: { inviteId: string; accept: boolean }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.workspaces.answerMentorInvite(viewer.userId, input.inviteId, input.accept))
  }

  @Mutation('deleteDoubt')
  deleteDoubt(@Args('input') input: { doubtId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.workspaces.deleteDoubt(viewer.userId, input.doubtId))
  }

  @Mutation('setProjectShowcase')
  setProjectShowcase(@Args('input') input: { groupId: string; noteId?: string | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.workspaces.setShowcase(viewer.userId, input.groupId, input.noteId ?? null))
  }

  @Query('myMentorInvites')
  async myMentorInvites(@CurrentViewer() viewer: Viewer) {
    return (await this.workspaces.myMentorInvites(viewer.userId)).map((i) => ({ id: i.id, group: i.group, invitedBy: userRef(i.invitedBy), expiresAt: i.expiresAt }))
  }
}

@Resolver('Doubt')
@UseGuards(SignedInGuard)
export class DoubtResolver {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Query('doubt')
  async doubt(@Args('id') id: string, @CurrentViewer() viewer: Viewer): Promise<DoubtParent | null> {
    const found = await this.workspaces.getDoubt(viewer.userId, id)
    return found ? { row: found.doubt, can: found.can } : null
  }

  @ResolveField('id')
  id(@Parent() d: DoubtParent) {
    return d.row.id
  }

  @ResolveField('title')
  title(@Parent() d: DoubtParent) {
    return d.row.title
  }

  @ResolveField('body')
  body(@Parent() d: DoubtParent) {
    return d.row.body
  }

  @ResolveField('repoRef')
  repoRef(@Parent() d: DoubtParent) {
    return d.row.repoRef
  }

  @ResolveField('status')
  status(@Parent() d: DoubtParent) {
    return d.row.status
  }

  @ResolveField('author')
  author(@Parent() d: DoubtParent) {
    return userRef(d.row.authorId)
  }

  @ResolveField('createdAt')
  createdAt(@Parent() d: DoubtParent) {
    return d.row.createdAt
  }

  @ResolveField('resolvedAt')
  resolvedAt(@Parent() d: DoubtParent) {
    return d.row.resolvedAt
  }

  @ResolveField('answerCount')
  answerCount(@Parent() d: DoubtParent) {
    return this.workspaces.answerCount(d.row.id)
  }

  @ResolveField('answers')
  async answers(@Parent() d: DoubtParent, @CurrentViewer() viewer: Viewer) {
    return (await this.workspaces.answers(viewer.userId, d.row.id)).map((a) => ({ id: a.id, author: userRef(a.authorId), body: a.body, byMentor: a.byMentor, createdAt: a.createdAt }))
  }

  @ResolveField('viewerCan')
  viewerCan(@Parent() d: DoubtParent) {
    return d.can
  }

  private payload(viewerId: string, run: () => Promise<string>): Promise<DoubtPayload> {
    return withUserErrors<DoubtPayload>(
      async () => {
        const found = await this.workspaces.getDoubt(viewerId, await run())
        return { doubt: found ? { row: found.doubt, can: found.can } : null }
      },
      { doubt: null },
    )
  }

  @Mutation('askDoubt')
  askDoubt(@Args('input') input: { groupId: string; title: string; body: unknown; repoRef?: string | null }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.workspaces.ask(viewer.userId, input.groupId, input))
  }

  @Mutation('answerDoubt')
  answerDoubt(@Args('input') input: { doubtId: string; body: unknown }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.workspaces.answer(viewer.userId, input.doubtId, input.body))
  }

  @Mutation('resolveDoubt')
  resolveDoubt(@Args('input') input: { doubtId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.workspaces.resolve(viewer.userId, input.doubtId))
  }

  @Mutation('reopenDoubt')
  reopenDoubt(@Args('input') input: { doubtId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.workspaces.reopen(viewer.userId, input.doubtId))
  }
}

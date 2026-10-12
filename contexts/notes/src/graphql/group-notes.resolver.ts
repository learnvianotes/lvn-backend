import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { connection } from '@lvn-backend/graphql'
import { GroupSharesService } from '../application/group-shares.service'
import { NotesService } from '../application/notes.service'
import { noteAccess, type NoteAccessRow } from '../domain/note-access'
import { toNote, type NoteParent } from './notes.resolver'

type NotePayload = { note: NoteParent | null; userErrors: UserError[] }

/** Notes shared to groups (ADR-0045): the field on Group, the owner's list on Note, and the two mutations. */
@Resolver('Group')
@UseGuards(SignedInGuard)
export class GroupNotesResolver {
  constructor(
    private readonly shares: GroupSharesService,
    private readonly notes: NotesService,
  ) {}

  // Apollo calls this with (reference, context, info); see UserReferenceResolver in users for why there are no decorators.
  @ResolveReference()
  resolveReference(reference: { id: string }) {
    return { id: reference.id }
  }

  @ResolveField('sharedNotes')
  async sharedNotes(@Parent() group: { id: string }, @Args('first') first: number | null, @Args('after') after: string | null, @CurrentViewer() viewer: Viewer) {
    const page = await this.shares.shared(viewer.userId, group.id, first, after)
    if (!page) return null
    const actor = await this.notes.actor(viewer.userId)
    return connection(page.rows, page.size, (s) => [s.createdAt.toISOString(), s.noteId], (s) => toNote({ note: s.note, access: noteAccess(actor, s.note as NoteAccessRow, null, { inSharedGroup: true }) ?? 'READER', shareRole: null, actor }))
  }

  @Mutation('shareNoteToGroup')
  shareNoteToGroup(@Args('input') input: { noteId: string; groupId: string }, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.shares.share(viewer.userId, input.noteId, input.groupId)) }), { note: null })
  }

  @Mutation('unshareNoteFromGroup')
  unshareNoteFromGroup(@Args('input') input: { noteId: string; groupId: string }, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.shares.unshare(viewer.userId, input.noteId, input.groupId)) }), { note: null })
  }
}

@Resolver('Note')
export class NoteGroupsResolver {
  constructor(private readonly shares: GroupSharesService) {}

  @ResolveField('groups')
  async groups(@Parent() n: NoteParent) {
    if (n.opened.access !== 'OWNER') return null
    return (await this.shares.groupsOf(n.id)).map((id) => ({ __typename: 'Group', id }))
  }
}

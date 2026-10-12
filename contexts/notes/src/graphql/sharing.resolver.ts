import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { connection } from '@lvn-backend/graphql'
import { noteAccess, type NoteAccessRow } from '../domain/note-access'
import { NotesService } from '../application/notes.service'
import { SharingService } from '../application/sharing.service'
import { toNote, type NoteParent } from './notes.resolver'
import type {
  MutationChangeNoteVisibilityArgs,
  MutationForkNoteArgs,
  MutationSetNoteForkingArgs,
  MutationShareNoteArgs,
  MutationUnshareNoteArgs,
  QuerySharedWithMeArgs,
} from './schema.types'

type NotePayload = { note: NoteParent | null; userErrors: UserError[] }
const userRef = (id: string) => ({ __typename: 'User', id })

@Resolver('Note')
export class SharingResolver {
  constructor(
    private readonly sharing: SharingService,
    private readonly notes: NotesService,
  ) {}

  @Query('sharedWithMe')
  @UseGuards(SignedInGuard)
  async sharedWithMe(@Args() { first, after }: QuerySharedWithMeArgs, @CurrentViewer() viewer: Viewer) {
    const actor = await this.notes.actor(viewer.userId)
    const { rows, size } = await this.sharing.sharedWithMe(viewer.userId, first, after)
    return connection(
      rows,
      size,
      (n) => [n.updatedAt.toISOString(), n.id],
      (n) => {
        const shareRole = n.shares[0]?.role ?? null
        return toNote({ note: n, access: noteAccess(actor, n as NoteAccessRow, shareRole) ?? 'READER', shareRole, actor })
      },
    )
  }

  @ResolveField('shares')
  async shares(@Parent() n: NoteParent) {
    if (n.opened.access !== 'OWNER') return null
    return (await this.sharing.shares(n.id)).map((s) => ({ user: userRef(s.userId), role: s.role, source: s.source, createdAt: s.createdAt }))
  }

  @ResolveField('sharedWithConnections')
  sharedWithConnections(@Parent() n: NoteParent) {
    return n.opened.access === 'OWNER' ? n.sharedWithConnections : null
  }

  @Mutation('setNoteSharedWithConnections')
  @UseGuards(SignedInGuard)
  setNoteSharedWithConnections(@Args() { input }: { input: { noteId: string; shared: boolean } }, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.sharing.setSharedWithConnections(viewer.userId, input.noteId, input.shared)) }), { note: null })
  }

  @ResolveField('forkedFrom')
  async forkedFrom(@Parent() n: NoteParent, @CurrentViewer() viewer: Viewer | null) {
    if (!n.forkedFromOwnerId) return null
    const origin = n.forkedFromNoteId ? await this.notes.open(viewer?.userId ?? null, n.forkedFromNoteId, n.opened.actor) : null
    // ADR-0010: the author is always credited; the origin's title and link only for people who can open it.
    return { author: userRef(n.forkedFromOwnerId), note: origin ? toNote(origin) : null, title: origin ? origin.note.title : null }
  }

  @Mutation('changeNoteVisibility')
  @UseGuards(SignedInGuard)
  changeNoteVisibility(@Args() { input }: MutationChangeNoteVisibilityArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.sharing.changeVisibility(viewer.userId, input.noteId, input.visibility)) }), { note: null })
  }

  @Mutation('shareNote')
  @UseGuards(SignedInGuard)
  shareNote(@Args() { input }: MutationShareNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.sharing.share(viewer.userId, input.noteId, input.person, input.role)) }), { note: null })
  }

  @Mutation('unshareNote')
  @UseGuards(SignedInGuard)
  unshareNote(@Args() { input }: MutationUnshareNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.sharing.unshare(viewer.userId, input.noteId, input.userId)) }), { note: null })
  }

  @Mutation('forkNote')
  @UseGuards(SignedInGuard)
  forkNote(@Args() { input }: MutationForkNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.sharing.fork(viewer.userId, input.noteId)) }), { note: null })
  }

  @Mutation('setNoteForking')
  @UseGuards(SignedInGuard)
  setNoteForking(@Args() { input }: MutationSetNoteForkingArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.sharing.setForking(viewer.userId, input.noteId, input.enabled)) }), { note: null })
  }
}

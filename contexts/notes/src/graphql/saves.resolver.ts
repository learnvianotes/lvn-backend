import { UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { requestLoader } from '@lvn-backend/graphql'
import { NoteSavesService } from '../application/note-saves.service'
import { toNote, type NoteParent } from './notes.resolver'
import type { MutationSaveNoteArgs, MutationUnsaveNoteArgs, QuerySavedNotesArgs } from './schema.types'

type NotePayload = { note: NoteParent | null; userErrors: UserError[] }

/** Saved notes (ADR-0076): Save on a note, `viewerSaved`, and the viewer's list. */
@Resolver('Note')
export class NoteSavesResolver {
  constructor(private readonly saves: NoteSavesService) {}

  @ResolveField('viewerSaved')
  viewerSaved(@Parent() note: NoteParent, @Context() context: RequestContext): Promise<boolean> | boolean {
    const viewerId = context.viewer?.userId
    if (!viewerId) return false
    return requestLoader<string, boolean>(context, 'notes.viewerSaved', async (ids) => {
      const saved = await this.saves.savedBy(viewerId, [...ids])
      return ids.map((id) => saved.has(id))
    }).load(note.id)
  }

  @Query('savedNotes')
  @UseGuards(SignedInGuard)
  async savedNotes(@Args() { first, after }: QuerySavedNotesArgs, @CurrentViewer() viewer: Viewer) {
    const { items, hasNextPage, endCursor } = await this.saves.saved(viewer.userId, first, after)
    return { edges: items.map((i) => ({ cursor: i.cursor, node: toNote(i.opened) })), pageInfo: { hasNextPage, endCursor } }
  }

  @Mutation('saveNote')
  @UseGuards(SignedInGuard)
  saveNote(@Args() { input }: MutationSaveNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.saves.save(viewer.userId, input.noteId)) }), { note: null })
  }

  @Mutation('unsaveNote')
  @UseGuards(SignedInGuard)
  unsaveNote(@Args() { input }: MutationUnsaveNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => {
      const opened = await this.saves.unsave(viewer.userId, input.noteId)
      return { note: opened ? toNote(opened) : null }
    }, { note: null })
  }
}

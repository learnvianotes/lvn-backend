import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { PdfReaderService, type HighlightRow } from '../application/pdf-reader.service'
import { toNote, type NoteParent } from './notes.resolver'
import type {
  MutationAddPdfHighlightArgs,
  MutationRemovePdfHighlightArgs,
  MutationStudyPdfArgs,
  MutationUpdatePdfHighlightArgs,
  NoteHighlightsArgs,
  OkPayload,
  QueryNoteFileArgs,
} from './schema.types'

type HighlightPayload = { highlight: ReturnType<typeof toHighlight> | null; userErrors: UserError[] }
type NotePayload = { note: NoteParent | null; userErrors: UserError[] }

const toHighlight = (h: HighlightRow) => ({ ...h, createdBy: { __typename: 'User', id: h.createdById } })

/** The PDF reader (ADR-0040): Note.highlights, noteFile, highlights and studyPdf. */
@Resolver('Note')
export class ReaderResolver {
  constructor(private readonly reader: PdfReaderService) {}

  @ResolveField('highlights')
  async highlights(@Parent() n: NoteParent, @Args() { fileId }: NoteHighlightsArgs) {
    return (await this.reader.list(n.opened, fileId)).map(toHighlight)
  }

  @Query('noteFile')
  noteFile(@Args() { noteId, fileId }: QueryNoteFileArgs, @CurrentViewer() viewer: Viewer | null) {
    return this.reader.noteFile(viewer?.userId ?? null, noteId, fileId)
  }

  @Mutation('addPdfHighlight')
  @UseGuards(SignedInGuard)
  addPdfHighlight(@Args() { input }: MutationAddPdfHighlightArgs, @CurrentViewer() viewer: Viewer): Promise<HighlightPayload> {
    return withUserErrors<HighlightPayload>(async () => ({ highlight: toHighlight(await this.reader.add(viewer.userId, input)) }), { highlight: null })
  }

  @Mutation('updatePdfHighlight')
  @UseGuards(SignedInGuard)
  updatePdfHighlight(@Args() { input }: MutationUpdatePdfHighlightArgs, @CurrentViewer() viewer: Viewer): Promise<HighlightPayload> {
    return withUserErrors<HighlightPayload>(async () => ({ highlight: toHighlight(await this.reader.update(viewer.userId, input)) }), { highlight: null })
  }

  @Mutation('removePdfHighlight')
  @UseGuards(SignedInGuard)
  removePdfHighlight(@Args() { input }: MutationRemovePdfHighlightArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.reader.remove(viewer.userId, input.highlightId)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('studyPdf')
  @UseGuards(SignedInGuard)
  studyPdf(@Args() { input }: MutationStudyPdfArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.reader.study(viewer.userId, input.noteId, input.fileId)) }), { note: null })
  }
}

import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { NotesService } from '../application/notes.service'
import { PdfConversionService, type ConversionRow } from '../application/pdf-conversion.service'
import { toNote, type NoteParent } from './notes.resolver'
import type { MutationConvertPdfToNoteArgs, QueryPdfConversionArgs } from './schema.types'

type Payload = { conversion: ConversionRow | null; userErrors: UserError[] }

/** Converting PDFs into notes (ADR-0025, ADR-0028): convertPdfToNote, pdfConversion, Note.pdfConversion. */
@Resolver('PdfConversion')
export class ConversionResolver {
  constructor(
    private readonly conversions: PdfConversionService,
    private readonly notes: NotesService,
  ) {}

  @Mutation('convertPdfToNote')
  @UseGuards(SignedInGuard)
  convertPdfToNote(@Args() { input }: MutationConvertPdfToNoteArgs, @CurrentViewer() viewer: Viewer): Promise<Payload> {
    return withUserErrors<Payload>(async () => ({ conversion: (await this.conversions.request(viewer.userId, input.noteId, input.fileId)).conversion }), { conversion: null })
  }

  @Query('pdfConversion')
  @UseGuards(SignedInGuard)
  pdfConversion(@Args() { id }: QueryPdfConversionArgs, @CurrentViewer() viewer: Viewer) {
    return this.conversions.get(viewer.userId, id)
  }

  @Query('pdfPagesThisMonth')
  @UseGuards(SignedInGuard)
  async pdfPagesThisMonth(@CurrentViewer() viewer: Viewer) {
    const [used, limit] = await Promise.all([this.conversions.pagesThisMonth(viewer.userId), this.conversions.limit(viewer.userId)])
    return { used, limit }
  }

  @ResolveField('note')
  async note(@Parent() c: ConversionRow, @CurrentViewer() viewer: Viewer | null): Promise<NoteParent | null> {
    const opened = await this.notes.open(viewer?.userId ?? null, c.noteId)
    return opened ? toNote(opened) : null
  }
}

@Resolver('Note')
export class NoteConversionResolver {
  constructor(private readonly conversions: PdfConversionService) {}

  @ResolveField('pdfConversion')
  pdfConversion(@Parent() n: NoteParent, @CurrentViewer() viewer: Viewer | null) {
    return viewer ? this.conversions.forNote(viewer.userId, n.id) : null
  }
}

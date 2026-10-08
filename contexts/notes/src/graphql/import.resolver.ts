import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { NoteImportService } from '../application/note-import.service'
import type { MutationConfirmNoteImportArgs, MutationImportNotesArgs } from './schema.types'

type Row = Awaited<ReturnType<NoteImportService['list']>>[number]
const toImport = (r: Row) => {
  const report = (r.report ?? {}) as { created?: number; notes?: { id: string; title: string }[]; skipped?: { path: string; reason: string }[] }
  return { ...r, created: report.created ?? 0, notes: report.notes ?? [], skipped: report.skipped ?? [] }
}
type Payload = { noteImport: ReturnType<typeof toImport> | null; userErrors: UserError[] }

@Resolver()
@UseGuards(SignedInGuard)
export class ImportResolver {
  constructor(private readonly imports: NoteImportService) {}

  @Query('noteImports')
  async noteImports(@CurrentViewer() viewer: Viewer) {
    return (await this.imports.list(viewer.userId)).map(toImport)
  }

  @Mutation('importNotes')
  importNotes(@Args() { input }: MutationImportNotesArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => ({ noteImport: toImport(await this.imports.start(viewer.userId, input.fileId)) }), { noteImport: null })
  }

  @Mutation('confirmNoteImport')
  confirmNoteImport(@Args() { input }: MutationConfirmNoteImportArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Payload>(async () => ({ noteImport: toImport(await this.imports.confirm(viewer.userId, input.noteId)) }), { noteImport: null })
  }
}

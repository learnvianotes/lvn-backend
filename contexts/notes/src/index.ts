// Public surface of the `notes` context. Nothing else is exported (spec §3).
import { notesTypeDefs } from './graphql/schema'
import { NotesModule } from './notes.module'

export { NotesModule }
export { notesConfigFrom, type NotesConfig } from './notes.config'
/** Implementation of the FILES facade, bound by the composition roots. */
export { FilesService } from './application/files.service'
/** Implementation of the NOTE_MODERATION facade (ADR-0037), bound by the composition roots. */
export { NoteModerationService } from './application/moderation.service'
/** Implementation of the NOTE_ACCESS facade (ADR-0047), bound by the composition roots. */
export { NoteAccessFacade } from './application/note-access.facade'
/** The search index and its queue (§10.4), run by apps/worker. */
export { NOTES_SEARCH_QUEUE, SearchIndex } from './application/search-index'
/** The notes part of a data export (ADR-0018), bound to NOTES_DATA_EXPORT by the composition roots. */
export { NotesExport } from './application/notes-export'
/** Imports of notes (ADR-0018), run by apps/worker from the notes.import queue. */
export { NOTES_IMPORT_QUEUE, NoteImportService } from './application/note-import.service'
export { NOTES_PDF_QUEUE, PDF_ENGINE_QUEUE, PDF_LIMITS, PdfConversionService } from './application/pdf-conversion.service'
export { IMAGE_SIZES, MediaProcessingService, NOTES_MEDIA_QUEUE, variantKey } from './application/media-processing.service'
export { clamdScan } from './application/clamav'
/** Nightly housekeeping (version pruning, emptying the trash), run by apps/worker. */
export { NotesMaintenance } from './application/notes-maintenance'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const notesSubgraph = { name: 'notes', typeDefs: notesTypeDefs, modules: [NotesModule] }

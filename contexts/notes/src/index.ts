// Public surface of the `notes` context. Nothing else is exported (spec §3).
import { notesTypeDefs } from './graphql/schema'
import { NotesModule } from './notes.module'

export { NotesModule }
export { notesConfigFrom, type NotesConfig } from './notes.config'
/** Implementation of the FILES facade, bound by the composition roots. */
export { FilesService } from './application/files.service'
/** Note and storage totals for the admin dashboard (ADR-0101). */
export { NotesAdminStats } from './application/admin-stats'
/** Implementation of the NOTE_MODERATION facade (ADR-0037), bound by the composition roots. */
export { NoteModerationService } from './application/moderation.service'
/** Implementation of the NOTE_ACCESS facade (ADR-0047), bound by the composition roots. */
export { NoteAccessFacade } from './application/note-access.facade'
/** Implementation of the TOPICS facade (ADR-0070). */
export { TopicsFacade } from './application/topics.facade'
/** Implementation of the NOTE_AI facade (ADR-0059), bound by the composition roots. */
export { NoteAiFacade } from './application/note-ai.facade'
/** The search indexes, their outbox drainer and queue (§11, ADR-0055), run by apps/worker. */
export { NOTES_SEARCH_QUEUE, SearchIndex } from './application/search-index'
/** Ask AI's chunks (ADR-0060): embedded by apps/worker from the notes.chunks queue; NoteRetrievalFacade is NOTE_RETRIEVAL. */
export { NOTES_CHUNKS_QUEUE, NoteChunks, NoteRetrievalFacade } from './application/note-chunks'
/** Hybrid ranking's semantic side (ADR-0057), bound by Phase 5. */
export { SEMANTIC_SEARCH, type SemanticSearch } from './application/search-ranking'
/** The notes part of a data export (ADR-0018), bound to NOTES_DATA_EXPORT by the composition roots. */
export { NotesExport } from './application/notes-export'
/** Imports of notes (ADR-0018), run by apps/worker from the notes.import queue. */
export { NOTES_IMPORT_QUEUE, NoteImportService } from './application/note-import.service'
/** The old site's study content into notes (ADR-0098), run by apps/worker's `content:import-legacy`. */
export { firestoreContentSource, LegacyContentImport, type LegacyContentReport, type LegacyContentSource } from './application/legacy-content'
export { NOTES_PDF_QUEUE, PDF_ENGINE_QUEUE, PDF_LIMITS, PdfConversionService } from './application/pdf-conversion.service'
export { IMAGE_SIZES, MediaProcessingService, NOTES_MEDIA_QUEUE, variantKey } from './application/media-processing.service'
export { clamdScan } from './application/clamav'
/** Nightly housekeeping (version pruning, emptying the trash), run by apps/worker. */
export { NotesMaintenance } from './application/notes-maintenance'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const notesSubgraph = { name: 'notes', typeDefs: notesTypeDefs, modules: [NotesModule] }

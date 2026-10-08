// Public surface of the `notes` context. Nothing else is exported (spec §3).
import { notesTypeDefs } from './graphql/schema'
import { NotesModule } from './notes.module'

export { NotesModule }
export { notesConfigFrom, type NotesConfig } from './notes.config'
/** Implementation of the FILES facade, bound by the composition roots. */
export { FilesService } from './application/files.service'
/** Implementation of the NOTE_MODERATION facade (ADR-0037), bound by the composition roots. */
export { NoteModerationService } from './application/moderation.service'
/** The search index and its queue (§10.4), run by apps/worker. */
export { NOTES_SEARCH_QUEUE, SearchIndex } from './application/search-index'
/** The notes part of a data export (ADR-0018), bound to NOTES_DATA_EXPORT by the composition roots. */
export { NotesExport } from './application/notes-export'
/** Imports of notes (ADR-0018), run by apps/worker from the notes.import queue. */
export { NOTES_IMPORT_QUEUE, NoteImportService } from './application/note-import.service'
/** Nightly housekeeping (version pruning, emptying the trash), run by apps/worker. */
export { NotesMaintenance } from './application/notes-maintenance'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const notesSubgraph = { name: 'notes', typeDefs: notesTypeDefs, modules: [NotesModule] }

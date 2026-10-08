// Public surface of the `notes` context. Nothing else is exported (spec §3).
import { notesTypeDefs } from './graphql/schema'
import { NotesModule } from './notes.module'

export { NotesModule }
export { notesConfigFrom, type NotesConfig } from './notes.config'
/** Implementation of the FILES facade, bound by the composition roots. */
export { FilesService } from './application/files.service'
/** Implementation of the NOTE_MODERATION facade (ADR-0037), bound by the composition roots. */
export { NoteModerationService } from './application/moderation.service'
/** Nightly housekeeping (version pruning, emptying the trash), run by apps/worker. */
export { NotesMaintenance } from './application/notes-maintenance'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const notesSubgraph = { name: 'notes', typeDefs: notesTypeDefs, modules: [NotesModule] }

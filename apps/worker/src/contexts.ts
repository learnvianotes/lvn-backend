import type { DynamicModule } from '@nestjs/common'
import type { WorkerConfig } from '@lvn-backend/config'
import { AiEmbeddings, AiExport, AiPageVision, AiModule, aiConfigFrom } from '@lvn-backend/ai'
import { CommunicationModule, communicationConfigFrom, MailService, LiveNotifier } from '@lvn-backend/communication'
import { CoreExport, CoreModule, coreConfigFrom, ModerationService, PlacesService, WorkspacesService } from '@lvn-backend/core'
import { AI_DATA_EXPORT, AUDIT, CORE_DATA_EXPORT, DOUBTS, EMBEDDINGS, ENTITLEMENTS, FacadesModule, FILES, LIVE, MAILER, MODERATION, NOTE_ACCESS, NOTE_AI, NOTE_RETRIEVAL, PAGE_VISION, PLACES, NOTE_MODERATION, NOTES_DATA_EXPORT, PEOPLE, POLICY } from '@lvn-backend/facades'
import { FilesService, NoteAccessFacade, NoteAiFacade, NoteRetrievalFacade, NoteModerationService, NotesExport, NotesModule, notesConfigFrom } from '@lvn-backend/notes'
import { AuditService, EntitlementService, PolicyService, UsersModule, usersConfigFrom, UsersService } from '@lvn-backend/users'

/**
 * The five bounded contexts this process composes (spec §6), configured as in apps/api. Extracting a context
 * (§6.5 step 4) removes it from this list and from apps/api, and adds apps/<name>-worker.
 */
export function contextModules(config: WorkerConfig): DynamicModule[] {
  return [
    UsersModule.forRoot(usersConfigFrom(config)),
    NotesModule.forRoot(notesConfigFrom(config)),
    CoreModule.forRoot(coreConfigFrom(config)),
    AiModule.forRoot(aiConfigFrom(config)),
    CommunicationModule.forRoot(communicationConfigFrom(config)),
  ]
}

/** Which context implements each facade in this process (§6.1). */
export const facades = () =>
  FacadesModule.bind([
    [MAILER, MailService],
    [FILES, FilesService],
    [POLICY, PolicyService],
    [ENTITLEMENTS, EntitlementService],
    [PEOPLE, UsersService],
    [AUDIT, AuditService],
    [MODERATION, ModerationService],
    [NOTE_MODERATION, NoteModerationService],
    [NOTE_ACCESS, NoteAccessFacade],
    [NOTE_AI, NoteAiFacade],
    [PLACES, PlacesService],
    [NOTES_DATA_EXPORT, NotesExport],
    [CORE_DATA_EXPORT, CoreExport],
    [AI_DATA_EXPORT, AiExport],
    [EMBEDDINGS, AiEmbeddings],
    [PAGE_VISION, AiPageVision],
    [NOTE_RETRIEVAL, NoteRetrievalFacade],
    [DOUBTS, WorkspacesService],
    [LIVE, LiveNotifier],
  ])

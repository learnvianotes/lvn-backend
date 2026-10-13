import { AiEmbeddings, AiExport, AiPageVision } from '@lvn-backend/ai'
import { MailService, LiveNotifier } from '@lvn-backend/communication'
import { AI_DATA_EXPORT, AUDIT, CORE_DATA_EXPORT, LEARNING, DOUBTS, EMBEDDINGS, ENTITLEMENTS, FacadesModule, FILES, LIVE, MAILER, MODERATION, NOTE_ACCESS, NOTE_AI, NOTE_RETRIEVAL, PAGE_VISION, PLACES, NOTE_MODERATION, NOTES_DATA_EXPORT, PEOPLE, POLICY } from '@lvn-backend/facades'
import { CoreExport, LearningEventsService, ModerationService, PlacesService, WorkspacesService } from '@lvn-backend/core'
import { FilesService, NoteAccessFacade, NoteAiFacade, NoteRetrievalFacade, NoteModerationService, NotesExport } from '@lvn-backend/notes'
import { AuditService, EntitlementService, PolicyService, UsersService } from '@lvn-backend/users'

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
    [LEARNING, LearningEventsService],
  ])

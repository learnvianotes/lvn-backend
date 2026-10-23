import type { DynamicModule } from '@nestjs/common'
import type { WorkerConfig } from '@lvn-backend/config'
import { AiAdminStats, AiDailyLines, AiEmbeddings, AiExport, AiPageVision, AiSkillsReader, AiModule, aiConfigFrom } from '@lvn-backend/ai'
import { CommunicationModule, communicationConfigFrom, MailService, LiveNotifier } from '@lvn-backend/communication'
import { CoreAdminStats, CoreExport, CoreModule, coreConfigFrom, LearningEventsService, ModerationService, PlacesService, ResourceSearchFacade, WorkspacesService } from '@lvn-backend/core'
import { AI_ADMIN_STATS, AI_DATA_EXPORT, AUDIT, CORE_ADMIN_STATS, CORE_DATA_EXPORT, LEARNING, DOUBTS, EMBEDDINGS, ENTITLEMENTS, FacadesModule, FILES, LIVE, MAILER, MODERATION, NOTE_ACCESS, NOTE_AI, NOTES_ADMIN_STATS, NOTE_RETRIEVAL, PAGE_VISION, PLACES, PLATFORM_SETTINGS, SKILLS_READER, DAILY_LINES, RESOURCE_SEARCH, NOTE_MODERATION, NOTES_DATA_EXPORT, PEOPLE, POLICY, TOPICS } from '@lvn-backend/facades'
import { FilesService, NoteAccessFacade, NoteAiFacade, NotesAdminStats, TopicsFacade, NoteRetrievalFacade, NoteModerationService, NotesExport, NotesModule, notesConfigFrom } from '@lvn-backend/notes'
import { AuditService, EntitlementService, PlatformSettingsStore, PolicyService, UsersModule, usersConfigFrom, UsersService } from '@lvn-backend/users'

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
    [PLATFORM_SETTINGS, PlatformSettingsStore],
    [NOTES_ADMIN_STATS, NotesAdminStats],
    [AI_ADMIN_STATS, AiAdminStats],
    [CORE_ADMIN_STATS, CoreAdminStats],
    [PEOPLE, UsersService],
    [AUDIT, AuditService],
    [MODERATION, ModerationService],
    [NOTE_MODERATION, NoteModerationService],
    [NOTE_ACCESS, NoteAccessFacade],
    [TOPICS, TopicsFacade],
    [NOTE_AI, NoteAiFacade],
    [PLACES, PlacesService],
    [RESOURCE_SEARCH, ResourceSearchFacade],
    [NOTES_DATA_EXPORT, NotesExport],
    [CORE_DATA_EXPORT, CoreExport],
    [AI_DATA_EXPORT, AiExport],
    [EMBEDDINGS, AiEmbeddings],
    [PAGE_VISION, AiPageVision],
    [SKILLS_READER, AiSkillsReader],
    [DAILY_LINES, AiDailyLines],
    [NOTE_RETRIEVAL, NoteRetrievalFacade],
    [DOUBTS, WorkspacesService],
    [LIVE, LiveNotifier],
    [LEARNING, LearningEventsService],
  ])

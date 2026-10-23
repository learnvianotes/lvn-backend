import { AiAdminStats, AiDailyLines, AiEmbeddings, AiExport, AiPageVision, AiPlanUsage, AiSkillsReader } from '@lvn-backend/ai'
import { MailService, LiveNotifier } from '@lvn-backend/communication'
import { AI_ADMIN_STATS, AI_DATA_EXPORT, AI_PLAN_USAGE, AUDIT, CORE_ADMIN_STATS, CORE_DATA_EXPORT, CORE_PLAN_USAGE, LEARNING, DOUBTS, EMBEDDINGS, ENTITLEMENTS, FacadesModule, FILES, LIVE, MAILER, MODERATION, NOTE_ACCESS, NOTE_AI, NOTES_ADMIN_STATS, NOTES_PLAN_USAGE, NOTE_RETRIEVAL, PAGE_VISION, PLACES, PLATFORM_SETTINGS, SKILLS_READER, DAILY_LINES, RESOURCE_SEARCH, NOTE_MODERATION, NOTES_DATA_EXPORT, PEOPLE, POLICY, TOPICS } from '@lvn-backend/facades'
import { CoreAdminStats, CoreExport, CorePlanUsage, LearningEventsService, ModerationService, PlacesService, ResourceSearchFacade, WorkspacesService } from '@lvn-backend/core'
import { FilesService, NoteAccessFacade, NoteAiFacade, NotesAdminStats, NotesPlanUsage, TopicsFacade, NoteRetrievalFacade, NoteModerationService, NotesExport } from '@lvn-backend/notes'
import { AuditService, EntitlementService, PlatformSettingsStore, PolicyService, UsersService } from '@lvn-backend/users'

/** Which context implements each facade in this process (§6.1). */
export const facades = () =>
  FacadesModule.bind([
    [MAILER, MailService],
    [FILES, FilesService],
    [POLICY, PolicyService],
    [ENTITLEMENTS, EntitlementService],
    [NOTES_PLAN_USAGE, NotesPlanUsage],
    [AI_PLAN_USAGE, AiPlanUsage],
    [CORE_PLAN_USAGE, CorePlanUsage],
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

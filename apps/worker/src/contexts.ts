import type { DynamicModule } from '@nestjs/common'
import type { WorkerConfig } from '@lvn-backend/config'
import { AiModule } from '@lvn-backend/ai'
import { CommunicationModule, communicationConfigFrom, MailService } from '@lvn-backend/communication'
import { ClassroomsService, CoreExport, CoreModule, coreConfigFrom, ModerationService } from '@lvn-backend/core'
import { AUDIT, CORE_DATA_EXPORT, ENTITLEMENTS, FacadesModule, FILES, MAILER, MODERATION, NOTE_ACCESS, PLACES, NOTE_MODERATION, NOTES_DATA_EXPORT, PEOPLE, POLICY } from '@lvn-backend/facades'
import { FilesService, NoteAccessFacade, NoteModerationService, NotesExport, NotesModule, notesConfigFrom } from '@lvn-backend/notes'
import { AuditService, EntitlementService, PolicyService, UsersModule, usersConfigFrom, UsersService } from '@lvn-backend/users'

/**
 * The five bounded contexts this process composes (spec §6), configured as in apps/api. Extracting a context
 * (§6.5 step 4) removes it from this list and from apps/api, and adds apps/<name>-worker.
 */
export function contextModules(config: WorkerConfig): (DynamicModule | typeof AiModule)[] {
  return [
    UsersModule.forRoot(usersConfigFrom(config)),
    NotesModule.forRoot(notesConfigFrom(config)),
    CoreModule.forRoot(coreConfigFrom(config)),
    AiModule,
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
    [PLACES, ClassroomsService],
    [NOTES_DATA_EXPORT, NotesExport],
    [CORE_DATA_EXPORT, CoreExport],
  ])

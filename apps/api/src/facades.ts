import { MailService } from '@lvn-backend/communication'
import { AUDIT, CORE_DATA_EXPORT, ENTITLEMENTS, FacadesModule, FILES, MAILER, MODERATION, NOTE_ACCESS, PLACES, NOTE_MODERATION, NOTES_DATA_EXPORT, PEOPLE, POLICY } from '@lvn-backend/facades'
import { ClassroomsService, CoreExport, ModerationService } from '@lvn-backend/core'
import { FilesService, NoteAccessFacade, NoteModerationService, NotesExport } from '@lvn-backend/notes'
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
    [PLACES, ClassroomsService],
    [NOTES_DATA_EXPORT, NotesExport],
    [CORE_DATA_EXPORT, CoreExport],
  ])

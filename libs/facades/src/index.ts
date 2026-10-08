// Interfaces through which contexts call each other in-process (spec §6.1, §6.5 step 5). Only tokens and types live
// here; each implementation belongs to the owning context and is bound by the composition roots.
export { MAILER, type Mailer, type MailTemplate, type MailTemplates } from './mail'
export { POLICY, type Policy } from './policy'
export { ENTITLEMENTS, type Entitlements } from './entitlements'
export { FILES, type Files, type FileParentKind, type FilePurposeKind, type FileSummary } from './files'
export { PEOPLE, type People, type Person } from './people'
export { AUDIT, type Audit, type AuditEntry } from './audit'
export { MODERATION, NOTE_MODERATION, type Moderation, type ModerationSubject, type ModerationStateKind, type ModeratedNote, type NoteModeration } from './moderation'
export { FacadesModule } from './bind'

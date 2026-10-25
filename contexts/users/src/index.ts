// Public surface of the `users` context. Nothing else is exported (spec §3).
import { usersTypeDefs } from './graphql/schema'
import { UsersModule } from './users.module'

export { UsersModule }
export { STUDY_PUBLISHER_EMAIL, STUDY_PUBLISHER_ID, isStudyPublisher } from './domain/study-publisher'
export { usersConfigFrom, type UsersConfig } from './users.config'
export { UsersMaintenance } from './application/maintenance'
/** ADR-0023 one-off snapshot of the old site, run by apps/worker's `legacy:snapshot` command. */
export { firestoreLegacySource, snapshotOldSite, type LegacyAccount, type LegacySink, type LegacySource, type SnapshotReport } from './application/legacy-snapshot.job'
/** Implementations of the POLICY and ENTITLEMENTS facades, bound by the composition roots. */
export { PolicyService } from './application/policy.service'
export { EntitlementService } from './application/entitlement.service'
/** Implementations of the PEOPLE and AUDIT facades, bound by the composition roots. */
export { UsersService } from './application/users.service'
export { AuditService } from './application/audit.service'
/** AppSetting cache (ADR-0101), bound to PLATFORM_SETTINGS by the composition roots. */
export { PlatformSettingsStore } from './application/platform-settings.store'
/** Adapters at the edge of the context that a composition root (or a test) may bind differently. */
export { GOOGLE_ID_TOKENS, MX_LOOKUP, type GoogleIdTokens, type MxLookup, type ProviderIdentity } from './application/providers'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const usersSubgraph = { name: 'users', typeDefs: usersTypeDefs, modules: [UsersModule] }
/** Data exports (ADR-0018): requested here, built by apps/worker from the users.export queue. */
export { DataExportService, USERS_EXPORT_QUEUE } from './application/data-export.service'
export { AccountDeletionService, DELETION_GRACE_DAYS } from './application/account-deletion.service'
/** College ID and proof documents read by the worker's AI job. The API only enqueues. */
export { AI_REVIEWER_ID, IdCardCheckService, USERS_ID_CHECK_QUEUE, type IdCardExtractor } from './application/id-card-check.service'
export { AnalyticsService } from './application/analytics.service'
/** Skills import (ADR-0077): the worker's import and monthly refresh. */
export { SkillsImportService, USERS_SKILLS_QUEUE } from './application/skills-import.service'

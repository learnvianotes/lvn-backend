import { Module, type DynamicModule } from '@nestjs/common'
import { JsonScalar } from '@lvn-backend/graphql'
import { AccessAllowlistService } from './application/access-allowlist.service'
import { AccessGate } from './application/access-gate'
import { AdminService } from './application/admin.service'
import { AdminMetricsService } from './application/admin-metrics.service'
import { AppSettingsService } from './application/app-settings.service'
import { PlanAdminService } from './application/plan-admin.service'
import { PublicPlansService } from './application/public-plans.service'
import { PlatformSettingsStore } from './application/platform-settings.store'
import { TermsVersionProvider } from './application/terms-version.provider'
import { AdminTermsService } from './application/admin-terms.service'
import { AuditService } from './application/audit.service'
import { AuthService } from './application/auth.service'
import { EntitlementService } from './application/entitlement.service'
import { InstitutionalEmailService } from './application/institutional-email.service'
import { LegacyService } from './application/legacy.service'
import { UsersMaintenance } from './application/maintenance'
import { OAuthService } from './application/oauth.service'
import { PasswordService } from './application/password.service'
import { PolicyService } from './application/policy.service'
import { ConsentService } from './application/consent.service'
import { DataExportService } from './application/data-export.service'
import { ProfileService } from './application/profile.service'
import { DnsMxLookup, FirebaseGoogleIdTokens, GOOGLE_ID_TOKENS, MX_LOOKUP } from './application/providers'
import { RegistrationService } from './application/registration.service'
import { SessionService } from './application/session.service'
import { SocialService } from './application/social.service'
import { SkillsImportService } from './application/skills-import.service'
import { TeacherProfileService } from './application/teacher-profile.service'
import { UsersService } from './application/users.service'
import { AnalyticsService, BackendErrorSink } from './application/analytics.service'
import { IdCardCheckService } from './application/id-card-check.service'
import { VerificationService } from './application/verification.service'
import { AuthResolver } from './graphql/auth.resolver'
import { ProfileResolver } from './graphql/profile.resolver'
import { TermsResolver } from './graphql/terms.resolver'
import { DataResolver } from './graphql/data.resolver'
import { RegistrationResolver } from './graphql/registration.resolver'
import { PeopleResolver, SocialResolver } from './graphql/social.resolver'
import { TeacherProfileFieldsResolver, TeacherProfileResolver } from './graphql/teacher.resolver'
import { StudentIdVerificationPublicResolver, StudentIdVerificationResolver } from './graphql/college-id.resolver'
import { TeacherStatusResolver, VerificationResolver } from './graphql/verification.resolver'
import { UserReferenceResolver } from './graphql/user-reference.resolver'
import { UserSignInMethodsResolver, ViewerResolver } from './graphql/viewer.resolver'
import { USERS_CONFIG, type UsersConfig } from './users.config'
import { AccountAdminService } from './application/account-admin.service'
import { AccountDeletionService } from './application/account-deletion.service'
import { AgeBlockService } from './application/age-block.service'
import { SupportContact } from './application/support-contact'
import { AccountResolver } from './graphql/account.resolver'
import { AccessAllowlistResolver } from './graphql/access.resolver'
import { AnalyticsOptOutResolver, AnalyticsResolver } from './graphql/analytics.resolver'
import { AdminDashboardResolver } from './graphql/admin.resolver'
import { PlansResolver } from './graphql/plans.resolver'

/**
 * The `users` bounded context (spec §6.1) — Postgres schema `users`.
 * Owns: auth, sessions, users, profiles, roles, PolicyService, device tokens, organizations (read model from the admin app),
 * follows, blocks and restrictions (ADR-0043), teacher connections and the Skills tab (ADR-0044).
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/, never by importing this package (enforced by dependency-cruiser).
 * Needs PrismaModule, RedisModule, EventBusModule and the MAILER and FILES facades; implements POLICY and
 * ENTITLEMENTS (libs/facades), which the composition root binds for the other contexts.
 * Never global: GraphQL subgraphs follow module imports, so a global context would leak its resolvers.
 */
@Module({})
export class UsersModule {
  static forRoot(config: UsersConfig): DynamicModule {
    return {
      module: UsersModule,
      providers: [
        { provide: USERS_CONFIG, useValue: config },
        JsonScalar,
        // Google sign-in is off unless a Firebase project is configured (ADR-0007).
        { provide: GOOGLE_ID_TOKENS, useFactory: () => (config.firebaseProjectId ? new FirebaseGoogleIdTokens(config.firebaseProjectId) : null) },
        { provide: MX_LOOKUP, useClass: DnsMxLookup },
        UsersService,
        PasswordService,
        SessionService,
        AuthService,
        OAuthService,
        RegistrationService,
        InstitutionalEmailService,
        PolicyService,
        EntitlementService,
        AuditService,
        IdCardCheckService,
        AnalyticsService,
        BackendErrorSink,
        VerificationService,
        PlatformSettingsStore,
        TermsVersionProvider,
        AdminTermsService,
        AccessGate,
        AccessAllowlistService,
        AppSettingsService,
        AdminMetricsService,
        PlanAdminService,
        PublicPlansService,
        AdminService,
        UsersMaintenance,
        ProfileService,
        ConsentService,
        DataExportService,
        SupportContact,
        AgeBlockService,
        AccountAdminService,
        AccountDeletionService,
        AccountResolver,
        AccessAllowlistResolver,
        AdminDashboardResolver,
        PlansResolver,
        LegacyService,
        SocialService,
        TeacherProfileService,
        SkillsImportService,
        ViewerResolver,
        UserSignInMethodsResolver,
        SocialResolver,
        PeopleResolver,
        TeacherProfileResolver,
        TeacherProfileFieldsResolver,
        UserReferenceResolver,
        AuthResolver,
        RegistrationResolver,
        VerificationResolver,
        StudentIdVerificationResolver,
        StudentIdVerificationPublicResolver,
        TeacherStatusResolver,
        ProfileResolver,
        TermsResolver,
        DataResolver,
        AnalyticsResolver,
        AnalyticsOptOutResolver,
      ],
      exports: [PolicyService, EntitlementService, UsersMaintenance, DataExportService, SkillsImportService, AccountDeletionService, IdCardCheckService],
    }
  }
}

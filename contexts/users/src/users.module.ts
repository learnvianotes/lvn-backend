import { Module, type DynamicModule } from '@nestjs/common'
import { AuthService } from './application/auth.service'
import { InstitutionalEmailService } from './application/institutional-email.service'
import { OAuthService } from './application/oauth.service'
import { PasswordService } from './application/password.service'
import { DnsMxLookup, FirebaseGoogleIdTokens, GOOGLE_ID_TOKENS, MX_LOOKUP } from './application/providers'
import { RegistrationService } from './application/registration.service'
import { SessionService } from './application/session.service'
import { UsersService } from './application/users.service'
import { AuthResolver } from './graphql/auth.resolver'
import { RegistrationResolver } from './graphql/registration.resolver'
import { ViewerResolver } from './graphql/viewer.resolver'
import { USERS_CONFIG, type UsersConfig } from './users.config'

/**
 * The `users` bounded context (spec §6.1) — Postgres schema `users`.
 * Owns: auth, sessions, users, profiles, roles, PolicyService, device tokens, organizations (read model from the admin app).
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/, never by importing this package (enforced by dependency-cruiser).
 * Needs PrismaModule, RedisModule, EventBusModule and a MAILER binding from the composition root.
 */
@Module({})
export class UsersModule {
  static forRoot(config: UsersConfig): DynamicModule {
    return {
      module: UsersModule,
      providers: [
        { provide: USERS_CONFIG, useValue: config },
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
        ViewerResolver,
        AuthResolver,
        RegistrationResolver,
      ],
    }
  }
}

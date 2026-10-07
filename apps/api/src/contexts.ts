import type { DynamicModule, Type } from '@nestjs/common'
import type { ApiConfig } from '@lvn-backend/config'
import { AiModule } from '@lvn-backend/ai'
import { CommunicationModule } from '@lvn-backend/communication'
import { CoreModule } from '@lvn-backend/core'
import type { SubgraphDefinition } from '@lvn-backend/graphql'
import { NotesModule } from '@lvn-backend/notes'
import { UsersModule, usersSubgraph } from '@lvn-backend/users'

/** Audience of LVN access tokens. */
export const TOKEN_AUDIENCE = 'lvn'

/**
 * The five bounded contexts this process composes (spec §6), each given only the configuration it needs.
 * Extracting a context (§6.5 step 4) removes it from this list and from apps/worker, and adds apps/<name>-service.
 */
export function contextModules(config: ApiConfig): (Type | DynamicModule)[] {
  return [
    UsersModule.forRoot({
      jwtPrivateKey: config.JWT_PRIVATE_KEY,
      jwtIssuer: config.JWT_ISSUER,
      tokenAudience: TOKEN_AUDIENCE,
      webUrl: config.WEB_URL,
      codeHmacSecret: config.CODE_HMAC_SECRET,
      digitalConsentAge: config.DIGITAL_CONSENT_AGE,
      passwordBreachApiUrl: config.PASSWORD_BREACH_API_URL,
      firebaseProjectId: config.FIREBASE_PROJECT_ID,
      github: config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET ? { clientId: config.GITHUB_CLIENT_ID, clientSecret: config.GITHUB_CLIENT_SECRET } : undefined,
      linkedin: config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET ? { clientId: config.LINKEDIN_CLIENT_ID, clientSecret: config.LINKEDIN_CLIENT_SECRET } : undefined,
    }),
    NotesModule,
    CoreModule,
    AiModule,
    CommunicationModule.forRoot({
      mailFrom: config.MAIL_FROM,
      mailTransport: config.MAIL_TRANSPORT,
      smtpUrl: config.SMTP_URL,
      resendApiKey: config.RESEND_API_KEY,
    }),
  ]
}

/**
 * Contexts that serve GraphQL today, each as its own federation subgraph. A context joins when it ships its first
 * resolver (spec §18: later-phase code is not written early).
 */
export const SUBGRAPHS: SubgraphDefinition[] = [usersSubgraph]

import { Module, type DynamicModule } from '@nestjs/common'
import type { ApiConfig } from '@lvn-backend/config'
import { AccessTokenVerifier } from '@lvn-backend/auth-guard'
import { graphqlModules } from '@lvn-backend/graphql'
import { PrismaModule } from '@lvn-backend/prisma-base'
import { CONTEXT_MODULES, SUBGRAPHS } from './contexts'
import { buildRequestContext } from './graphql/request-context'
import { HealthController } from './health/health.controller'

/** Audience of LVN access tokens. */
export const TOKEN_AUDIENCE = 'lvn'

/**
 * Composition root for the GraphQL API (spec §3 apps/api): the five contexts, one federation subgraph per context
 * that has a schema, and the Apollo Gateway composing them in-process at /graphql.
 */
@Module({})
export class AppModule {
  static forRoot(config: ApiConfig): DynamicModule {
    const verifier = new AccessTokenVerifier(config.JWT_PUBLIC_KEY, config.JWT_ISSUER, TOKEN_AUDIENCE)
    return {
      module: AppModule,
      imports: [
        PrismaModule.forRoot(config.DATABASE_URL),
        ...CONTEXT_MODULES,
        ...graphqlModules({
          subgraphs: SUBGRAPHS,
          context: buildRequestContext(verifier),
          introspection: config.APP_ENV === 'development',
        }),
      ],
      controllers: [HealthController],
    }
  }
}

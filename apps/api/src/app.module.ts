import { Module, type DynamicModule } from '@nestjs/common'
import type { ApiConfig } from '@lvn-backend/config'
import { AccessTokenVerifier } from '@lvn-backend/auth-guard'
import { EventBusModule } from '@lvn-backend/event-bus'
import { graphqlModules } from '@lvn-backend/graphql'
import { PrismaModule } from '@lvn-backend/prisma-base'
import { QueueModule } from '@lvn-backend/queue'
import { RedisModule, SessionRevocations } from '@lvn-backend/redis'
import { StorageModule } from '@lvn-backend/storage'
import { contextModules, SUBGRAPHS, TOKEN_AUDIENCE } from './contexts'
import { facades } from './facades'
import { buildRequestContext } from './graphql/request-context'
import { HealthController } from './health/health.controller'

export { TOKEN_AUDIENCE }

/**
 * Composition root for the GraphQL API (spec §3 apps/api): shared infrastructure, the five contexts, one federation
 * subgraph per context that has a schema, and the Apollo Gateway composing them in-process at /graphql.
 */
@Module({})
export class AppModule {
  static forRoot(config: ApiConfig): DynamicModule {
    const verifier = new AccessTokenVerifier(config.JWT_PUBLIC_KEY, config.JWT_ISSUER, TOKEN_AUDIENCE)
    return {
      module: AppModule,
      imports: [
        PrismaModule.forRoot(config.DATABASE_URL),
        RedisModule.forRoot(config.REDIS_URL),
        // The API only enqueues (§9.1); apps/worker runs the jobs.
        QueueModule.forRoot(config.REDIS_URL),
        StorageModule.forRoot({
          endpoint: config.S3_ENDPOINT,
          region: config.S3_REGION,
          accessKeyId: config.S3_ACCESS_KEY_ID,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          forcePathStyle: config.S3_FORCE_PATH_STYLE,
        }),
        EventBusModule,
        facades(),
        ...contextModules(config),
        ...graphqlModules({
          subgraphs: SUBGRAPHS,
          context: { inject: [SessionRevocations], useFactory: (revocations: SessionRevocations) => buildRequestContext(verifier, revocations) },
          introspection: config.APP_ENV === 'development',
        }),
      ],
      controllers: [HealthController],
    }
  }
}

import { Module, type DynamicModule } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import type { ApiConfig } from '@lvn-backend/config'
import { AccessTokenVerifier, type RequestContext } from '@lvn-backend/auth-guard'
import { EventBusModule } from '@lvn-backend/event-bus'
import { graphqlModules } from '@lvn-backend/graphql'
import { PrismaModule } from '@lvn-backend/prisma-base'
import { QueueModule } from '@lvn-backend/queue'
import { RateLimiter, RedisModule, SessionRevocations } from '@lvn-backend/redis'
import { StorageModule } from '@lvn-backend/storage'
import { contextModules, SUBGRAPHS, TOKEN_AUDIENCE } from './contexts'
import { facades } from './facades'
import { graphqlOperationRetryAfter } from './graphql/operation-rate'
import { buildRequestContext } from './graphql/request-context'
import { SuspendedRefusals } from './graphql/suspended-refusals'
import { GitHubWebhookController } from '@lvn-backend/core'
import { HealthController } from './health/health.controller'
import { MonitoringController, SENTRY_DSN } from './monitoring/monitoring.controller'

export { TOKEN_AUDIENCE }

/**
 * Composition root for the GraphQL API (spec §3 apps/api): shared infrastructure, the five contexts, one federation
 * subgraph per context that has a schema, and the Apollo Gateway composing them in-process at /graphql.
 */
@Module({})
export class AppModule {
  static forRoot(config: ApiConfig): DynamicModule {
    const verifier = new AccessTokenVerifier(config.JWT_PUBLIC_KEY, [config.JWT_ISSUER, ...config.JWT_EXTRA_ISSUERS], TOKEN_AUDIENCE)
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
          // ADR-0090: signed-in operations per person, anonymous operations per network. Fail open when Redis is down.
          rateLimit: {
            inject: [RateLimiter],
            useFactory: (limiter: RateLimiter) => (ctx: unknown) => graphqlOperationRetryAfter(limiter, ctx as RequestContext),
          },
        }),
      ],
      // ADR-0078: GitHub App deliveries arrive here (404 until the App is configured).
      controllers: [HealthController, GitHubWebhookController, MonitoringController],
      // A suspended person's refused change says why (ADR-0053).
      providers: [
        { provide: APP_INTERCEPTOR, useClass: SuspendedRefusals },
        { provide: AccessTokenVerifier, useValue: verifier },
        { provide: SENTRY_DSN, useValue: config.SENTRY_DSN },
      ],
    }
  }
}

import { Global, Inject, Injectable, Module, type DynamicModule, type OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'
import { RateLimiter } from './rate-limiter'
import { SessionRevocations } from './session-revocations'
import { REDIS } from './tokens'

/** Closes the connection when the app shuts down. */
@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect())
  }
}

/**
 * Redis for rate limits, revocation markers, short caches and (later) BullMQ and pub/sub (§8). Nothing here lives
 * without a TTL except queues, and nothing here is a permission decision.
 */
@Global()
@Module({})
export class RedisModule {
  static forRoot(url: string): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        { provide: REDIS, useFactory: () => new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false }) },
        RedisLifecycle,
        RateLimiter,
        SessionRevocations,
      ],
      exports: [REDIS, RateLimiter, SessionRevocations],
    }
  }
}

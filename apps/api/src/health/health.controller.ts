import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common'
import { PrismaService, shippedMigration } from '@lvn-backend/prisma-base'
import { REDIS } from '@lvn-backend/redis'
import type { Response } from 'express'
import type Redis from 'ioredis'

const TIMEOUT_MS = 2000

const within = <T>(work: Promise<T>): Promise<T> =>
  Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS} ms`)), TIMEOUT_MS).unref())])

/**
 * Probes for the load balancer and rolling deploys (spec §16.2). Liveness says the process answers; readiness says it
 * can serve: Postgres and Redis answer, and the database has at least the migrations this build ships. "At least",
 * because migrations run before new tasks start (expand/contract) and the old tasks keep serving meanwhile.
 */
@Controller('health')
export class HealthController {
  private readonly expected = shippedMigration()

  constructor(
    private readonly db: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' }
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const [database, redis, schema] = await Promise.all([
      this.check(async () => void (await within(this.db.$queryRaw`SELECT 1`))),
      this.check(async () => void (await within(this.redis.ping()))),
      this.check(async () => {
        const rows = await within(
          this.db.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1`,
        )
        const applied = rows[0]?.migration_name ?? null
        if (this.expected && (!applied || applied < this.expected)) throw new Error(`database at ${applied ?? 'no migrations'}, this build needs ${this.expected}`)
      }),
    ])
    const checks = { database, redis, schema }
    const ok = Object.values(checks).every((c) => c === 'ok')
    if (!ok) res.status(HttpStatus.SERVICE_UNAVAILABLE)
    return { status: ok ? 'ok' : 'unavailable', checks }
  }

  private async check(probe: () => Promise<void>): Promise<string> {
    try {
      await probe()
      return 'ok'
    } catch (e) {
      return e instanceof Error ? e.message : 'failed'
    }
  }
}

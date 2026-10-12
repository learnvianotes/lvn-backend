import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers'

/**
 * Isolated infrastructure for integration and e2e tests (spec §17): tests never touch a shared database, sandbox or
 * production. Images match infra/docker/compose.yaml.
 */
export const IMAGES = {
  postgres: 'pgvector/pgvector:pg16',
  redis: 'redis:7-alpine',
  s3: 'rustfs/rustfs:1.0.1',
  mailpit: 'axllent/mailpit:v1.31.4',
} as const

const REPO_ROOT = path.resolve(__dirname, '../../..')

export interface TestInfra {
  databaseUrl: string
  redisUrl: string
  s3: { endpoint: string; accessKeyId: string; secretAccessKey: string }
  /** SMTP URL the API sends to, and the HTTP API tests read messages from */
  mail: { smtpUrl: string; apiUrl: string }
  stop(): Promise<void>
}

/** Postgres with every migration applied by the real `prisma migrate deploy`. */
export async function startPostgres(): Promise<{ url: string; container: StartedPostgreSqlContainer }> {
  // Test files run in parallel, each app with its own pool (and some with a second app, ADR-0042): room for all of them.
  const container = await new PostgreSqlContainer(IMAGES.postgres).withDatabase('lvn').withUsername('lvn').withPassword('lvn').withCommand(['postgres', '-c', 'max_connections=500']).start()
  const url = container.getConnectionUri()
  execFileSync(path.join(REPO_ROOT, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  })
  return { url, container }
}

export async function startRedis(): Promise<{ url: string; container: StartedRedisContainer }> {
  const container = await new RedisContainer(IMAGES.redis).start()
  return { url: container.getConnectionUrl(), container }
}

export async function startS3(): Promise<{ endpoint: string; accessKeyId: string; secretAccessKey: string; container: StartedTestContainer }> {
  const accessKeyId = 'lvn-test'
  const secretAccessKey = 'lvn-test-secret'
  const container = await new GenericContainer(IMAGES.s3)
    .withEnvironment({ RUSTFS_ADDRESS: ':9000', RUSTFS_ACCESS_KEY: accessKeyId, RUSTFS_SECRET_KEY: secretAccessKey, RUSTFS_CONSOLE_ENABLE: 'false' })
    .withExposedPorts(9000)
    .withWaitStrategy(Wait.forListeningPorts())
    .start()
  return { endpoint: `http://${container.getHost()}:${container.getMappedPort(9000)}`, accessKeyId, secretAccessKey, container }
}

export async function startMailpit(): Promise<{ smtpUrl: string; apiUrl: string; container: StartedTestContainer }> {
  const container = await new GenericContainer(IMAGES.mailpit).withExposedPorts(1025, 8025).withWaitStrategy(Wait.forListeningPorts()).start()
  const host = container.getHost()
  return { smtpUrl: `smtp://${host}:${container.getMappedPort(1025)}`, apiUrl: `http://${host}:${container.getMappedPort(8025)}`, container }
}

/** Everything the API needs, started in parallel. */
export async function startInfra(): Promise<TestInfra> {
  const [pg, redis, s3, mail] = await Promise.all([startPostgres(), startRedis(), startS3(), startMailpit()])
  return {
    databaseUrl: pg.url,
    redisUrl: redis.url,
    s3: { endpoint: s3.endpoint, accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
    mail: { smtpUrl: mail.smtpUrl, apiUrl: mail.apiUrl },
    stop: async () => {
      await Promise.all([pg.container.stop(), redis.container.stop(), s3.container.stop(), mail.container.stop()])
    },
  }
}

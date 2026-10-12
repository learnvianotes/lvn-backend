import { randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { apiConfigSchema, loadConfig, type ApiConfig } from '@lvn/contracts/config'
import { resetDatabase, testSecrets, workerDatabase, type TestInfra } from '@lvn-backend/testing'
import { GOOGLE_ID_TOKENS, MX_LOOKUP, type GoogleIdTokens, type MxLookup } from '@lvn-backend/users'
import { createLogger, PinoNestLogger } from '@lvn-backend/observability'
import { Storage } from '@lvn-backend/storage'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { configureHttp } from '../../src/http'

export type Infra = Omit<TestInfra, 'stop'>

export function infra(): Infra {
  const file = process.env.LVN_TEST_INFRA
  if (!file) throw new Error('LVN_TEST_INFRA is not set — run through jest (test/support/global-setup.ts)')
  return JSON.parse(readFileSync(file, 'utf8')) as Infra
}

const secrets = testSecrets()

/** This worker's own database (see workerDatabase). */
let workerDb: Promise<string> | undefined
export const databaseUrl = (): Promise<string> => (workerDb ??= workerDatabase(infra().databaseUrl))

/** A complete API configuration pointing at the test containers and this worker's database. */
export async function testConfig(overrides: Record<string, string> = {}): Promise<ApiConfig> {
  return loadConfig(apiConfigSchema, await testEnv(overrides))
}

/** The same configuration as environment variables, for starting the built API as a process. */
export async function testEnv(overrides: Record<string, string> = {}): Promise<Record<string, string>> {
  const i = infra()
  return {
    APP_ENV: 'development',
    LOG_LEVEL: 'error',
    DATABASE_URL: await databaseUrl(),
    REDIS_URL: i.redisUrl,
    CORS_ORIGINS: 'http://localhost:3000',
    S3_ENDPOINT: i.s3.endpoint,
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: i.s3.accessKeyId,
    S3_SECRET_ACCESS_KEY: i.s3.secretAccessKey,
    S3_FORCE_PATH_STYLE: 'true',
    S3_BUCKET: 'lvn-files',
    S3_RESTRICTED_BUCKET: 'lvn-restricted',
    MAIL_FROM: 'LearnViaNotes <no-reply@learnvianotes.in>',
    MAIL_TRANSPORT: 'smtp',
    SMTP_URL: i.mail.smtpUrl,
    JWT_ISSUER: 'http://localhost:4000',
    WEB_URL: 'http://localhost:3000',
    TRUST_PROXY_HOPS: '1',
    ...secrets,
    ...overrides,
  }
}

export interface TestApp {
  app: INestApplication
  config: ApiConfig
  /** Log lines written so far (JSON-parsed), at the configured LOG_LEVEL ("error" unless overridden). */
  logs(): Record<string, unknown>[]
  /** POST /graphql; `token` is sent as a Bearer access token. */
  gql<T = Record<string, unknown>>(query: string, variables?: object, token?: string): Promise<{ status: number; data?: T; errors?: { message: string; extensions: { code: string; field?: string[] } }[] }>
  close(): Promise<void>
}

/** Domains the fake MX lookup treats as unable to receive mail. */
export const NO_MAIL_DOMAINS = new Set(['nomail.example', 'dead-college.edu'])
const fakeMx: MxLookup = { acceptsMail: async (domain) => !NO_MAIL_DOMAINS.has(domain) }

/**
 * Fake Google ID tokens: `google:<uid>:<email>[:<name>]` is a valid Google sign-in with a verified email; anything else
 * is refused, as Firebase would refuse a forged token.
 */
export const fakeGoogle: GoogleIdTokens = {
  verify: async (token) => {
    const [kind, uid, email, name] = token.split(':')
    if (kind !== 'google' || !uid || !email) return null
    return { provider: 'GOOGLE', providerUserId: uid, email, emailVerified: true, name: name ?? null }
  },
}

/**
 * A fresh database and a fully composed API (all subgraphs + gateway), as main.ts builds it. Only the edges are
 * replaced: DNS (MX) and Google token verification, which would otherwise reach the internet.
 */
export async function createTestApp(overrides: Record<string, string> = {}, options: { resetDatabase?: boolean; providers?: [token: symbol, value: unknown][] } = {}): Promise<TestApp> {
  const config = await testConfig(overrides)
  // A second instance of the API (ADR-0042) shares the first one's database: it must not wipe it.
  if (options.resetDatabase !== false) await resetDatabase(config.DATABASE_URL)
  let builder = Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
    .overrideProvider(MX_LOOKUP)
    .useValue(fakeMx)
    .overrideProvider(GOOGLE_ID_TOKENS)
    .useValue(fakeGoogle)
  // A test's own stand-ins, e.g. a semantic search for hybrid ranking (ADR-0057).
  for (const [token, value] of options.providers ?? []) builder = builder.overrideProvider(token).useValue(value)
  const moduleRef = await builder.compile()
  // Logs go to memory for assertions, and to stdout too with LVN_TEST_LOGS=1.
  const lines: string[] = []
  const logger = createLogger({
    service: 'lvn-api',
    env: config.APP_ENV,
    level: config.LOG_LEVEL,
    destination: { write: (line: string) => void (lines.push(line), process.env.LVN_TEST_LOGS && process.stdout.write(line)) },
  })
  const app = moduleRef.createNestApplication({ logger: new PinoNestLogger(logger) })
  // Each test app is its own client network (behind one trusted proxy), so per-network sign-in limits in the shared
  // Redis never add up across test files or runs. A test can still send its own X-Forwarded-For.
  const network = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`
  app.use((req: { headers: Record<string, string | string[] | undefined> }, _res: unknown, next: () => void) => {
    req.headers['x-forwarded-for'] ??= network
    next()
  })
  configureHttp(app, config, logger)
  await app.init()
  await app.get(Storage).ensureBuckets([config.S3_BUCKET, config.S3_RESTRICTED_BUCKET])
  return {
    app,
    config,
    logs: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>),
    async gql(query, variables, token) {
      const req = request(app.getHttpServer()).post('/graphql').set('content-type', 'application/json')
      if (token) req.set('authorization', `Bearer ${token}`)
      const res = await req.send({ query, variables })
      return { status: res.status, data: res.body.data, errors: res.body.errors }
    },
    close: () => app.close(),
  }
}

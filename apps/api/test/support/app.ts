import { readFileSync } from 'node:fs'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { apiConfigSchema, loadConfig, type ApiConfig } from '@lvn/contracts/config'
import { resetDatabase, testSecrets, type TestInfra } from '@lvn-backend/testing'
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

/** A complete API configuration pointing at the test containers. */
export function testConfig(overrides: Record<string, string> = {}): ApiConfig {
  const i = infra()
  return loadConfig(apiConfigSchema, {
    APP_ENV: 'development',
    LOG_LEVEL: 'error',
    DATABASE_URL: i.databaseUrl,
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
    ...secrets,
    ...overrides,
  })
}

export interface TestApp {
  app: INestApplication
  config: ApiConfig
  /** POST /graphql; `token` is sent as a Bearer access token. */
  gql<T = Record<string, unknown>>(query: string, variables?: object, token?: string): Promise<{ status: number; data?: T; errors?: { message: string; extensions: { code: string; field?: string[] } }[] }>
  close(): Promise<void>
}

/** A fresh database and a fully composed API (all subgraphs + gateway), as main.ts builds it. */
export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const config = testConfig(overrides)
  await resetDatabase(config.DATABASE_URL)
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).compile()
  const app = moduleRef.createNestApplication({ logger: false })
  configureHttp(app, config)
  await app.init()
  return {
    app,
    config,
    async gql(query, variables, token) {
      const req = request(app.getHttpServer()).post('/graphql').set('content-type', 'application/json')
      if (token) req.set('authorization', `Bearer ${token}`)
      const res = await req.send({ query, variables })
      return { status: res.status, data: res.body.data, errors: res.body.errors }
    },
    close: () => app.close(),
  }
}

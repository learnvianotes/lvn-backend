import type { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { loadConfig, workerConfigSchema } from '@lvn/contracts/config'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { Storage } from '@lvn-backend/storage'
import { startInfra, testSecrets, type TestInfra } from '@lvn-backend/testing'
import { USERS_MAINTENANCE_QUEUE } from '../../src/maintenance.jobs'
import { WorkerModule } from '../../src/worker.module'

/** The worker boots with every context and runs its scheduled jobs (§9.1). */
describe('worker', () => {
  let infra: TestInfra
  let app: INestApplicationContext

  beforeAll(async () => {
    infra = await startInfra()
    const config = loadConfig(workerConfigSchema, {
      APP_ENV: 'development',
      LOG_LEVEL: 'error',
      DATABASE_URL: infra.databaseUrl,
      REDIS_URL: infra.redisUrl,
      CORS_ORIGINS: 'http://localhost:3000',
      S3_ENDPOINT: infra.s3.endpoint,
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: infra.s3.accessKeyId,
      S3_SECRET_ACCESS_KEY: infra.s3.secretAccessKey,
      S3_FORCE_PATH_STYLE: 'true',
      S3_BUCKET: 'lvn-files',
      S3_RESTRICTED_BUCKET: 'lvn-restricted',
      MAIL_FROM: 'LearnViaNotes <no-reply@learnvianotes.in>',
      MAIL_TRANSPORT: 'smtp',
      SMTP_URL: infra.mail.smtpUrl,
      JWT_ISSUER: 'http://localhost:4000',
      WEB_URL: 'http://localhost:3000',
      ...testSecrets(),
    })
    app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config), { logger: false })
    await app.init()
    await app.get(Storage).ensureBuckets(['lvn-files', 'lvn-restricted'])
  })

  afterAll(async () => {
    await app?.close()
    await infra?.stop()
  })

  it('schedules the daily purge of decided verification documents', async () => {
    const schedulers = await app.get(Queues).queue(USERS_MAINTENANCE_QUEUE).getJobSchedulers()
    expect(schedulers.map((s) => [s.key, s.pattern, s.tz])).toEqual([['purge-verification-documents', '15 3 * * *', 'UTC']])
  })

  it('purges documents decided more than 30 days ago when the job runs', async () => {
    const db = app.get(PrismaService)
    const userId = newId()
    await db.user.create({ data: { id: userId, email: `w${userId.slice(-8)}@example.com`, handle: `w${userId.slice(-8)}`, displayName: 'W' } })
    const fileId = newId()
    const key = `development/${userId}/${fileId}/original`
    await app.get(Storage).client.send(new (await import('@aws-sdk/client-s3')).PutObjectCommand({ Bucket: 'lvn-restricted', Key: key, Body: '%PDF-1.7' }))
    await db.fileObject.create({
      data: { id: fileId, ownerId: userId, parentType: 'VERIFICATION_REQUEST', purpose: 'VERIFICATION_DOCUMENT', bucket: 'lvn-restricted', storageKey: key, mimeType: 'application/pdf', sizeBytes: 8n, originalFileName: 'id.pdf', status: 'READY' },
    })
    await db.verificationRequest.create({
      data: { id: newId(), userId, method: 'DOCUMENTS', status: 'APPROVED', documentIds: [fileId], decidedAt: new Date(Date.now() - 31 * 86_400_000) },
    })

    const job = await app.get(Queues).queue(USERS_MAINTENANCE_QUEUE).add('purge-verification-documents', {})
    const deadline = Date.now() + 20_000
    while (!(await job.isCompleted())) {
      if (Date.now() > deadline || (await job.isFailed())) throw new Error(`job did not complete: ${job.failedReason ?? 'timeout'}`)
      await new Promise((r) => setTimeout(r, 200))
    }
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ status: 'DELETED' })
    expect(await app.get(Storage).head('lvn-restricted', key)).toBeNull()
  })
})

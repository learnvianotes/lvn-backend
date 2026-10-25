import type { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { loadConfig, workerConfigSchema } from '@lvn/contracts/config'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { Storage } from '@lvn-backend/storage'
import { startInfra, testSecrets, type TestInfra } from '@lvn-backend/testing'
import { NOTES_SEARCH_QUEUE } from '@lvn-backend/notes'
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
      SEARCH_PROVIDER: 'typesense',
      TYPESENSE_URL: infra.typesense.url,
      TYPESENSE_API_KEY: infra.typesense.apiKey,
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

  it('schedules the daily purge of decided verification documents and the deletion of accounts past their grace', async () => {
    const schedulers = await app.get(Queues).queue(USERS_MAINTENANCE_QUEUE).getJobSchedulers()
    expect(schedulers.map((s) => [s.key, s.pattern, s.tz]).sort()).toEqual([
      ['delete-accounts', '20 3 * * *', 'UTC'],
      ['purge-analytics', '25 3 * * *', 'UTC'],
      ['purge-verification-documents', '15 3 * * *', 'UTC'],
    ])
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

  it('indexes a published note in both search indexes on its own, and schedules the nightly reindex (ADR-0055)', async () => {
    const db = app.get(PrismaService)
    const ownerId = newId()
    await db.user.create({ data: { id: ownerId, email: `s${ownerId.slice(-8)}@example.com`, handle: `s${ownerId.slice(-8)}`, displayName: 'S' } })
    const noteId = newId()
    const versionId = newId()
    await db.note.create({ data: { id: noteId, ownerId, title: 'Tries', visibility: 'PUBLIC' } })
    await db.noteVersion.create({ data: { id: versionId, noteId, number: 1, kind: 'PUBLISHED', title: 'Tries', createdById: ownerId, cards: [{ id: newId(), type: 'text', position: 'a0', revision: 1, content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prefix trees for autocomplete.' }] }] } } }] } })
    // Publishing leaves a row in the search outbox (a trigger); the worker's drainer takes it from there.
    await db.note.update({ where: { id: noteId }, data: { publishedVersionId: versionId, publishedAt: new Date() } })

    const deadline = Date.now() + 30_000
    const typesense = async () => {
      const res = await fetch(`${infra.typesense.url}/collections/lvn_notes/documents/${noteId}`, { headers: { 'X-TYPESENSE-API-KEY': infra.typesense.apiKey } })
      return res.ok ? ((await res.json()) as { title: string; visibility: string }) : null
    }
    while (!(await db.noteSearchDocument.findUnique({ where: { noteId } })) || !(await typesense())) {
      if (Date.now() > deadline) throw new Error('the note was not indexed in time')
      await new Promise((r) => setTimeout(r, 200))
    }
    expect(await db.noteSearchDocument.findUniqueOrThrow({ where: { noteId } })).toMatchObject({ versionId, title: 'Tries', body: 'Prefix trees for autocomplete.' })
    expect(await typesense()).toMatchObject({ title: 'Tries', visibility: 'PUBLIC' })
    // The rest of the outbox (the curated topics a new database starts with) drains too, in its own time: under the
    // full suite's load it can still be going when the note is done.
    while ((await db.searchChange.count()) > 0) {
      if (Date.now() > deadline) throw new Error(`the search outbox did not drain in time (${await db.searchChange.count()} left)`)
      await new Promise((r) => setTimeout(r, 200))
    }
    expect(await db.searchChange.count()).toBe(0)
    const schedulers = await app.get(Queues).queue(NOTES_SEARCH_QUEUE).getJobSchedulers()
    expect(schedulers.map((x) => [x.key, x.pattern])).toEqual([['reindex-all', '15 4 * * *']])
  })
})

import { PrismaService } from '@lvn-backend/prisma-base'
import request from 'supertest'
import { createTestApp, type TestApp } from '../support/app'

describe('health', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  it('reports liveness', () => request(t.app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' }))

  it('is ready when Postgres and Redis answer and the database has this build’s migrations', async () => {
    const res = await request(t.app.getHttpServer()).get('/health/ready').expect(200)
    expect(res.body).toEqual({
      status: 'ok',
      checks: { database: 'ok', redis: 'ok', schema: 'ok' },
      version: expect.stringMatching(/^v\d+\.\d+\.\d+\+/),
    })
  })

  it('is not ready while the database lacks a migration this build ships (a deploy before its migrate task)', async () => {
    const db = t.app.get(PrismaService)
    const [latest] = await db.$queryRaw<{ id: string; migration_name: string }[]>`SELECT id, migration_name FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 1`
    await db.$executeRaw`UPDATE _prisma_migrations SET rolled_back_at = now() WHERE id = ${latest!.id}`
    try {
      const res = await request(t.app.getHttpServer()).get('/health/ready').expect(503)
      expect(res.body.checks).toMatchObject({ database: 'ok', redis: 'ok', schema: expect.stringContaining(latest!.migration_name) })
    } finally {
      await db.$executeRaw`UPDATE _prisma_migrations SET rolled_back_at = NULL WHERE id = ${latest!.id}`
    }
  })

  it('sends security headers (Helmet)', async () => {
    const res = await request(t.app.getHttpServer()).get('/health/live')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toBeDefined()
  })
})

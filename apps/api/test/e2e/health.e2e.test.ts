import request from 'supertest'
import { createTestApp, type TestApp } from '../support/app'

describe('health', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  it('reports liveness', () => request(t.app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' }))
  it('reports readiness', () => request(t.app.getHttpServer()).get('/health/ready').expect(200))
  it('sends security headers (Helmet)', async () => {
    const res = await request(t.app.getHttpServer()).get('/health/live')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toBeDefined()
  })
})

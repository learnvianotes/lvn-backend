import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('health', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('reports liveness', () => request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' }))
  it('reports readiness', () => request(app.getHttpServer()).get('/health/ready').expect(200))
})

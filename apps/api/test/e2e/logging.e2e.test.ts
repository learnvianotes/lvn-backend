import request from 'supertest'
import { createTestApp, type TestApp } from '../support/app'

/** Structured logs with request ids (§16.5) that never carry credentials (§7.2). */
describe('logging', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({ LOG_LEVEL: 'info' })
  })
  afterAll(() => t.close())

  const signIn = (requestId?: string) => {
    const req = request(t.app.getHttpServer()).post('/graphql').set('content-type', 'application/json')
    if (requestId) req.set('x-request-id', requestId)
    return req.send({
      operationName: 'SignIn',
      query: 'mutation SignIn($input: SignInInput!) { signIn(input: $input) { session { accessToken } userErrors { message } } }',
      variables: { input: { email: 'nobody@example.com', password: 'a very secret passphrase' } },
    })
  }

  it('echoes a well-formed X-Request-Id and logs the request under it with the operation name', async () => {
    const res = await signIn('client-req-0001')
    expect(res.headers['x-request-id']).toBe('client-req-0001')
    const line = t.logs().find((l) => l.requestId === 'client-req-0001' && l.msg === 'POST /graphql 200')
    expect(line).toMatchObject({ level: 'info', service: 'lvn-api', operation: 'SignIn', req: { method: 'POST', path: '/graphql' }, res: { statusCode: 200 } })
    expect(typeof line!.durationMs).toBe('number')
  })

  it('replaces a malformed request id with its own', async () => {
    const res = await signIn('bad id; with spaces')
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('writes no password, token, cookie, query string or variables', async () => {
    await signIn('client-req-0002')
    await request(t.app.getHttpServer()).get('/health/live?token=emailed-secret').set('cookie', 'lvn_rt=cookie-secret')
    await request(t.app.getHttpServer()).post('/graphql?token=emailed-secret').set('authorization', 'Bearer header-secret').set('cookie', 'lvn_rt=cookie-secret').send({ query: '{ termsVersion }' })
    const text = JSON.stringify(t.logs())
    for (const secret of ['a very secret passphrase', 'emailed-secret', 'header-secret', 'cookie-secret', 'nobody@example.com']) expect(text).not.toContain(secret)
  })

  it('does not log health checks', async () => {
    const before = t.logs().length
    await request(t.app.getHttpServer()).get('/health/live')
    expect(t.logs().slice(before).filter((l) => String(l.msg).includes('/health'))).toEqual([])
  })

  it('logs an unexpected failure with its cause and request id, and tells the client only that something went wrong', async () => {
    // A resolver failure the API did not anticipate: the database disappears mid-request.
    const { PrismaService } = await import('@lvn-backend/prisma-base')
    const db = t.app.get(PrismaService)
    const spy = jest.spyOn(db.user, 'findUnique').mockRejectedValueOnce(new Error('connection terminated unexpectedly'))
    const res = await signIn('client-req-0003')
    spy.mockRestore()
    expect(res.body.errors[0]).toMatchObject({ message: 'Something went wrong. Please try again.', extensions: { code: 'INTERNAL' } })
    const line = t.logs().find((l) => l.level === 'error' && l.requestId === 'client-req-0003')
    expect(line).toMatchObject({ operation: 'SignIn' })
    expect(JSON.stringify(line)).toContain('connection terminated unexpectedly')
  })
})

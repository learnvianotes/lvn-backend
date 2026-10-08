import { flushErrors, startErrorReporting } from '@lvn-backend/observability'
import { PrismaService } from '@lvn-backend/prisma-base'
import request from 'supertest'
import { createTestApp, type TestApp } from '../support/app'

/**
 * Sentry (§16.5) with the network replaced: what would be sent is kept here. Only unexpected failures are reported,
 * tagged with the request id and operation, and nothing personal leaves the process.
 */
type Envelope = [Record<string, unknown>, [{ type: string }, Record<string, unknown>][]]
const sent: Envelope[] = []

describe('error reporting', () => {
  let t: TestApp

  beforeAll(async () => {
    startErrorReporting({
      service: 'lvn-api',
      env: 'development',
      release: 'test-sha',
      dsn: 'https://publickey@o0.ingest.sentry.io/0',
      transport: () => ({ send: async (envelope: unknown) => (sent.push(envelope as Envelope), {}), flush: async () => true }),
    })
    t = await createTestApp()
  })
  afterAll(() => t.close())

  const events = () => sent.flatMap(([, items]) => items.filter(([h]) => h.type === 'event').map(([, payload]) => payload))

  const signIn = (requestId: string) =>
    request(t.app.getHttpServer())
      .post('/graphql')
      .set('content-type', 'application/json')
      .set('x-request-id', requestId)
      .set('authorization', 'Bearer not-a-real-token')
      .set('cookie', 'lvn_rt=cookie-secret')
      .send({
        operationName: 'SignIn',
        query: 'mutation SignIn($input: SignInInput!) { signIn(input: $input) { session { accessToken } userErrors { message } } }',
        variables: { input: { email: 'reported-person@example.com', password: 'a reported secret passphrase' } },
      })

  it('reports an unexpected failure with its request id and operation, and nothing personal', async () => {
    const db = t.app.get(PrismaService)
    const spy = jest.spyOn(db.user, 'findUnique').mockRejectedValueOnce(new Error('connection terminated unexpectedly'))
    await signIn('report-req-0001')
    spy.mockRestore()
    await flushErrors()
    const event = events().find((e) => (e.tags as Record<string, string> | undefined)?.requestId === 'report-req-0001')
    expect(event).toBeDefined()
    expect(event).toMatchObject({ environment: 'development', release: 'test-sha', tags: { service: 'lvn-api', operation: 'SignIn', requestId: 'report-req-0001' } })
    expect(JSON.stringify(event)).toContain('connection terminated unexpectedly')
    // No local variables or source lines (either could hold the password), no cookies, headers or body.
    const text = JSON.stringify(sent)
    for (const secret of ['a reported secret passphrase', 'reported-person@example.com', 'cookie-secret', 'not-a-real-token']) expect(text).not.toContain(secret)
    expect(text).not.toMatch(/"vars"|"pre_context"|"context_line"/)
  })

  it('does not report expected outcomes: wrong passwords, validation and authorisation errors', async () => {
    const before = events().length
    await signIn('report-req-0002')
    await t.gql('{ viewer { id } }')
    await t.gql('mutation { createUploadIntent(input: { fileName: "a", mimeType: "image/png", sizeBytes: 1, purpose: AVATAR }) { intent { fileId } } }')
    await t.gql('{ nonsense }')
    await flushErrors()
    expect(events().slice(before)).toEqual([])
  })
})

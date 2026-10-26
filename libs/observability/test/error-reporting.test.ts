import * as Sentry from '@sentry/node'
import type { ErrorEvent, NodeOptions } from '@sentry/node'
import { logContext } from '../src/log-context'
import { flushErrors, reportError, scrubEvent, setBackendErrorSink, startErrorReporting } from '../src/error-reporting'

type Envelope = [Record<string, unknown>, [{ type: string }, Record<string, unknown>][]]

const OWNER = '22222222-2222-4222-8222-222222222222'

describe('error reporting', () => {
  afterEach(() => setBackendErrorSink(null))

  it('keeps user.id and drops email, username and ip', () => {
    const event = {
      user: { id: 'user-1', email: 'ada@college.edu', username: 'Ada', ip_address: '203.0.113.8' },
      request: {
        url: 'https://api.example/graphql?token=secret',
        cookies: { lvn_rt: 'cookie' },
        data: { password: 'secret' },
        query_string: 'token=secret',
        headers: { cookie: 'c', authorization: 'Bearer x', 'user-agent': 'ua' },
      },
    }
    const out = scrubEvent(event as unknown as ErrorEvent)
    expect(out.user).toEqual({ id: 'user-1' })
    expect(out.request?.url).toBe('https://api.example/graphql')
    expect(out.request?.cookies).toBeUndefined()
    expect(out.request?.headers).toEqual({ 'user-agent': 'ua' })
    expect(JSON.stringify(out)).not.toContain('ada@college.edu')
  })

  it('writes our error log when Sentry is off, with a scrubbed message and the user id', () => {
    const seen: { userId?: string; message: string; route?: string; code: string }[] = []
    setBackendErrorSink((event) => void seen.push(event))
    logContext.run({ userId: '11111111-1111-4111-8111-111111111111', operation: 'Viewer' }, () => {
      reportError(new Error('failed for ada@college.edu bearer tok'))
    })
    expect(seen).toEqual([
      expect.objectContaining({
        userId: '11111111-1111-4111-8111-111111111111',
        route: 'Viewer',
        code: 'INTERNAL',
        message: expect.stringContaining('[email]'),
      }),
    ])
    expect(seen[0]!.message).not.toContain('ada@college.edu')
    expect(seen[0]!.message).not.toContain('tok')
  })

  it('writes a failed scan to the error log with the file owner, even with no request', () => {
    const seen: { userId?: string; route?: string; code: string; message: string }[] = []
    setBackendErrorSink((event) => void seen.push(event))
    reportError(Object.assign(new Error('scan service did not return a verdict'), { userId: OWNER }), {
      queue: 'file-scan',
      job: 'scan',
      jobId: 'file-1',
      userId: OWNER,
    })
    expect(seen).toEqual([
      expect.objectContaining({
        userId: OWNER,
        route: 'file-scan/scan',
        code: 'INTERNAL',
        message: 'scan service did not return a verdict',
      }),
    ])
  })
})

describe('reportError user id', () => {
  const sent: Envelope[] = []

  beforeAll(() => {
    startErrorReporting({
      service: 'lvn-worker',
      env: 'development',
      dsn: 'https://publickey@o0.ingest.sentry.io/0',
      transport: () => ({ send: async (envelope: unknown) => (sent.push(envelope as Envelope), {}), flush: async () => true }),
    })
  })

  it('sends every error, samples no traces, and tags the environment', () => {
    const options = Sentry.getClient()?.getOptions() as NodeOptions | undefined
    expect(options?.environment).toBe('development')
    expect(options?.sampleRate).toBe(1)
    expect(options?.tracesSampleRate).toBeUndefined()
    expect(options?.enableOpenTelemetrySetup).toBe(false)
  })

  const events = () => sent.flatMap(([, items]) => items.filter(([h]) => h.type === 'event').map(([, payload]) => payload))

  it('keeps only the user id and drops email and address', async () => {
    Sentry.withScope((scope) => {
      scope.setUser({ id: 'user-1', email: 'person@example.com', ip_address: '203.0.113.5' })
      Sentry.captureException(new Error('scan down'))
    })
    await flushErrors()
    const event = events().at(-1)
    expect(event?.user).toEqual({ id: 'user-1' })
    expect(JSON.stringify(event)).not.toContain('person@example.com')
    expect(JSON.stringify(event)).not.toContain('203.0.113.5')
  })

  it('sets the user id from the tags a failed scan reports', async () => {
    reportError(Object.assign(new Error('scan service did not return a verdict'), { userId: 'user-2' }), { queue: 'file-scan', job: 'scan', userId: 'user-2' })
    await flushErrors()
    const event = events().at(-1)
    expect(event?.user).toEqual({ id: 'user-2' })
    expect(event?.tags).toMatchObject({ queue: 'file-scan', job: 'scan', userId: 'user-2' })
  })
})

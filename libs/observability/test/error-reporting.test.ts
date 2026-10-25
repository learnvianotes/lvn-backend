import * as Sentry from '@sentry/node'
import { flushErrors, reportError, startErrorReporting } from '../src'

type Envelope = [Record<string, unknown>, [{ type: string }, Record<string, unknown>][]]

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
    reportError(Object.assign(new Error('scan service did not return a verdict'), { userId: 'user-2' }), { queue: 'notes.media', job: 'process-file', userId: 'user-2' })
    await flushErrors()
    const event = events().at(-1)
    expect(event?.user).toEqual({ id: 'user-2' })
    expect(event?.tags).toMatchObject({ queue: 'notes.media', job: 'process-file', userId: 'user-2' })
  })
})

import type { ErrorEvent } from '@sentry/node'
import { logContext } from '../src/log-context'
import { reportError, scrubEvent, setBackendErrorSink } from '../src/error-reporting'

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
})

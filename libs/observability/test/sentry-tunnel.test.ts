import { envelopeUserId, parseSentryDsn, prepareSentryTunnel } from '../src/sentry-tunnel'

const DSN = 'https://public@o0.ingest.sentry.io/123'

function envelope(headerDsn = DSN, user: Record<string, string> | null = { id: 'user-1', email: 'ada@school.edu', ip_address: '203.0.113.8' }): string {
  const event = { message: 'boom', ...(user ? { user } : {}), request: { headers: { 'user-agent': 'ua', 'x-forwarded-for': '203.0.113.8', 'x-real-ip': '203.0.113.8' }, ip: '203.0.113.8' } }
  const payload = JSON.stringify(event)
  return `${JSON.stringify({ dsn: headerDsn, sent_at: '2026-11-11T00:00:00Z' })}\n${JSON.stringify({ type: 'event', length: Buffer.byteLength(payload) })}\n${payload}`
}

describe('Sentry tunnel', () => {
  it('forwards an adult envelope only to the configured project', () => {
    const decision = prepareSentryTunnel({ configuredDsn: DSN, body: envelope(), maxBytes: 100_000, subject: 'adult', minorEventsEnabled: true })
    expect(decision).toMatchObject({ action: 'forward', url: 'https://o0.ingest.sentry.io/api/123/envelope/' })
    if (decision.action === 'forward') expect(decision.body).toContain('user-1')
    expect(parseSentryDsn(DSN)?.projectId).toBe('123')
  })

  it('strips user and IP fields for a minor and for an unknown age', () => {
    for (const subject of ['minor', 'anonymous'] as const) {
      const decision = prepareSentryTunnel({ configuredDsn: DSN, body: envelope(), maxBytes: 100_000, subject: subject === 'anonymous' ? 'minor' : subject, minorEventsEnabled: true })
      expect(decision.action).toBe('forward')
      if (decision.action !== 'forward') continue
      expect(decision.url).toBe('https://o0.ingest.sentry.io/api/123/envelope/')
      expect(decision.body).not.toContain('user-1')
      expect(decision.body).not.toContain('ada@school.edu')
      expect(decision.body).not.toContain('203.0.113.8')
      expect(decision.body).not.toContain('x-forwarded-for')
      const [, itemHeader, payload] = decision.body.split('\n')
      expect((JSON.parse(itemHeader!) as { length: number }).length).toBe(Buffer.byteLength(payload!))
    }
  })

  it('drops a minor when the admin switch is off', () => {
    expect(prepareSentryTunnel({ configuredDsn: DSN, body: envelope(), maxBytes: 100_000, subject: 'minor', minorEventsEnabled: false })).toEqual({ action: 'drop' })
    expect(prepareSentryTunnel({ configuredDsn: DSN, body: envelope(), maxBytes: 100_000, subject: 'adult', minorEventsEnabled: false }).action).toBe('forward')
  })

  it('rejects a different host, project or public key, an empty body, and a missing DSN', () => {
    expect(prepareSentryTunnel({ configuredDsn: DSN, body: envelope('https://public@evil.example/123'), maxBytes: 100_000, subject: 'adult', minorEventsEnabled: true })).toMatchObject({ action: 'reject', status: 400 })
    expect(prepareSentryTunnel({ configuredDsn: DSN, body: envelope('https://public@o0.ingest.sentry.io/999'), maxBytes: 100_000, subject: 'adult', minorEventsEnabled: true })).toMatchObject({ action: 'reject', status: 400 })
    expect(prepareSentryTunnel({ configuredDsn: DSN, body: envelope('https://other@o0.ingest.sentry.io/123'), maxBytes: 100_000, subject: 'adult', minorEventsEnabled: true })).toMatchObject({ action: 'reject', status: 400 })
    expect(prepareSentryTunnel({ configuredDsn: DSN, body: '', maxBytes: 100_000, subject: 'adult', minorEventsEnabled: true })).toMatchObject({ action: 'reject', status: 413 })
    expect(prepareSentryTunnel({ configuredDsn: DSN, body: envelope(), maxBytes: 10, subject: 'adult', minorEventsEnabled: true })).toMatchObject({ action: 'reject', status: 413 })
    expect(prepareSentryTunnel({ configuredDsn: undefined, body: envelope(), maxBytes: 100_000, subject: 'adult', minorEventsEnabled: true })).toMatchObject({ action: 'reject', status: 400 })
    expect(prepareSentryTunnel({ configuredDsn: 'not a dsn', body: envelope(), maxBytes: 100_000, subject: 'adult', minorEventsEnabled: true })).toMatchObject({ action: 'reject', status: 400 })
    expect(envelopeUserId(envelope())).toBe('user-1')
    expect(envelopeUserId(envelope(DSN, null))).toBeNull()
  })
})

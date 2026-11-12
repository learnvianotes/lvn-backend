import { Controller, Inject, Post, Req, Res } from '@nestjs/common'
import { AccessTokenVerifier } from '@lvn-backend/auth-guard'
import { envelopeUserId, prepareSentryTunnel, type TunnelSubject } from '@lvn-backend/observability'
import { RateLimiter, SessionRevocations } from '@lvn-backend/redis'
import { PlatformSettingsStore, UsersService } from '@lvn-backend/users'
import type { Request, Response } from 'express'
import { viewerFromRequest } from '../graphql/request-context'

/** The API's Sentry DSN. The tunnel never forwards to any other host. */
export const SENTRY_DSN = Symbol('SENTRY_DSN')

const DEFAULT_MAX_BYTES = 1_000_000
const DEFAULT_PER_MINUTE = 30

/**
 * `POST /monitoring` (ADR-0112). The web Sentry SDK posts envelopes here so the browser does not talk to Sentry
 * directly. The body is forwarded only to the DSN configured for this API, after the project, host and public key
 * match. A minor or an unknown age loses user and IP fields. `sentry_minor_events_enabled` drops those envelopes.
 */
@Controller()
export class MonitoringController {
  constructor(
    private readonly users: UsersService,
    private readonly settings: PlatformSettingsStore,
    private readonly limiter: RateLimiter,
    private readonly revocations: SessionRevocations,
    @Inject(AccessTokenVerifier) private readonly verifier: AccessTokenVerifier,
    @Inject(SENTRY_DSN) private readonly dsn: string | undefined,
  ) {}

  @Post('monitoring')
  async tunnel(@Req() req: Request, @Res() res: Response): Promise<void> {
    const body = envelopeBody(req)
    const userId = await this.accountId(req, body)
    const perMinute = this.settings.integer('sentry_tunnel_per_minute', DEFAULT_PER_MINUTE) ?? DEFAULT_PER_MINUTE
    const hit = await this.limiter.hit(`sentry-tunnel:${userId ?? req.ip ?? 'anon'}`, { max: perMinute, windowSeconds: 60 }).catch(() => null)
    if (hit && !hit.allowed) {
      res.status(429).end()
      return
    }
    const subject = await this.subject(userId)
    const maxBytes = this.settings.integer('sentry_tunnel_max_bytes', DEFAULT_MAX_BYTES) ?? DEFAULT_MAX_BYTES
    const decision = prepareSentryTunnel({
      configuredDsn: this.dsn,
      body,
      maxBytes,
      subject,
      minorEventsEnabled: this.settings.boolean('sentry_minor_events_enabled', true),
    })
    if (decision.action === 'reject') {
      res.status(decision.status).end()
      return
    }
    if (decision.action === 'drop') {
      res.status(204).end()
      return
    }
    try {
      const upstream = await fetch(decision.url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-sentry-envelope' },
        body: decision.body,
        signal: AbortSignal.timeout(10_000),
      })
      res.status(upstream.ok ? 200 : 502).end()
    } catch {
      res.status(502).end()
    }
  }

  /** A valid access token wins. Otherwise the account id the SDK put on the event. A revoked session is not that account. */
  private async accountId(req: Request, body: string): Promise<string | null> {
    const viewer = viewerFromRequest(req as Parameters<typeof viewerFromRequest>[0], this.verifier)
    if (viewer && !(await this.revocations.isRevoked(viewer.sessionId).catch(() => false))) return viewer.userId
    return envelopeUserId(body)
  }

  /** Confirmed adults stay adults. Everyone else, including a missing account, is scrubbed as a minor. */
  private async subject(userId: string | null): Promise<TunnelSubject> {
    if (!userId) return 'minor'
    try {
      const standing = await this.users.familiesStanding(userId)
      return standing && !standing.minor ? 'adult' : 'minor'
    } catch {
      return 'minor'
    }
  }
}

function envelopeBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  const raw = (req as Request & { rawBody?: Buffer }).rawBody
  if (raw) return raw.toString('utf8')
  return typeof req.body === 'string' ? req.body : ''
}

import { randomUUID } from 'node:crypto'
import type { AccessTokenVerifier, RequestContext, Viewer } from '@lvn-backend/auth-guard'

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/

type Req = RequestContext['req'] & { headers: Record<string, string | string[] | undefined> }

/** The viewer from `Authorization: Bearer <access token>`; null when absent, invalid or expired. */
export function viewerFromRequest(req: Req, verifier: AccessTokenVerifier): Viewer | null {
  const header = req.headers.authorization
  const value = Array.isArray(header) ? header[0] : header
  if (!value?.startsWith('Bearer ')) return null
  const result = verifier.verify(value.slice(7).trim())
  if (!result.ok) return null
  return { userId: result.claims.sub, sessionId: result.claims.sid, roles: result.claims.roles }
}

/** Request ids propagate from the client to the logs (§7.2); a malformed one is replaced. */
export function requestIdOf(req: Req): string {
  const header = req.headers['x-request-id']
  const value = Array.isArray(header) ? header[0] : header
  return value && REQUEST_ID.test(value) ? value : randomUUID()
}

export function buildRequestContext(verifier: AccessTokenVerifier) {
  return ({ req, res }: { req: unknown; res: unknown }): RequestContext => {
    const r = req as Req
    return { req: r, res: res as RequestContext['res'], requestId: requestIdOf(r), viewer: viewerFromRequest(r, verifier) }
  }
}

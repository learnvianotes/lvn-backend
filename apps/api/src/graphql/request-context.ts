import type { AccessTokenVerifier, RequestContext, Viewer } from '@lvn-backend/auth-guard'
import { noteViewer, requestIdFrom } from '@lvn-backend/observability'

/** Answers whether a session family was revoked within the access-token lifetime (Redis in apps/api). */
export interface RevocationCheck {
  isRevoked(sessionFamilyId: string): Promise<boolean>
}

type Req = RequestContext['req'] & { headers: Record<string, string | string[] | undefined>; id?: unknown }

/** The viewer from `Authorization: Bearer <access token>`; null when absent, invalid or expired. */
export function viewerFromRequest(req: Req, verifier: AccessTokenVerifier): Viewer | null {
  const header = req.headers.authorization
  const value = Array.isArray(header) ? header[0] : header
  if (!value?.startsWith('Bearer ')) return null
  const result = verifier.verify(value.slice(7).trim())
  if (!result.ok) return null
  return { userId: result.claims.sub, sessionId: result.claims.sid, roles: result.claims.roles }
}

/** The id the access log gave this request (from X-Request-Id when well-formed, §7.2), so both name it the same. */
export function requestIdOf(req: Req): string {
  return typeof req.id === 'string' ? req.id : requestIdFrom(req.headers['x-request-id'])
}

/** The viewer is dropped when their session was revoked (sign-out, reuse, reset) even if the token has not expired. */
export function buildRequestContext(verifier: AccessTokenVerifier, revocations: RevocationCheck) {
  return async ({ req, res }: { req: unknown; res: unknown }): Promise<RequestContext> => {
    const r = req as Req
    let viewer = viewerFromRequest(r, verifier)
    if (viewer && (await revocations.isRevoked(viewer.sessionId))) viewer = null
    noteViewer(viewer?.userId)
    return { req: r, res: res as RequestContext['res'], requestId: requestIdOf(r), viewer }
  }
}

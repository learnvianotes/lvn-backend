import type { RequestContext } from '@lvn-backend/auth-guard'
import type { DeviceInfo, IssuedSession } from '../application/session.service'
import type { UsersService } from '../application/users.service'
import { SESSION_TTL_DAYS } from '../domain/rules'
import type { Session } from './schema.types'

/** The web client's refresh token: HttpOnly, SameSite=Lax, only ever sent to /graphql (§7.1). */
export const REFRESH_COOKIE = 'lvn_rt'

/** Express `maxAge` is milliseconds. The Set-Cookie Max-Age is this many seconds, the same length as the session. */
export const REFRESH_COOKIE_MAX_AGE_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000

export interface RefreshCookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: string
}

/**
 * Secure whenever the API is served over HTTPS — its public origin, JWT_ISSUER, says so (sandbox and production).
 * Browsers drop Secure cookies from plain-HTTP origins other than localhost, so a development API reached at the
 * machine's LAN or VPN address over HTTP must send the cookie without it.
 *
 * SameSite=Lax still sends the cookie on a credentialed POST from https://app.learnvianotes.in to
 * https://api.learnvianotes.in/graphql: the two hosts share the registrable domain learnvianotes.in, so the request
 * is same-site.
 *
 * Domain must never be set. A Domain of `.learnvianotes.in` would send this cookie to every subdomain. The cookie
 * stays host-only: set by the API host and sent only back to it. The name stays `lvn_rt`, not `__Host-`, because
 * that prefix requires Path=/.
 */
export const refreshCookieOptions = (apiOrigin: string): RefreshCookieOptions => ({
  httpOnly: true,
  secure: apiOrigin.startsWith('https://'),
  sameSite: 'lax',
  path: '/graphql',
})

const header = (ctx: RequestContext, name: string): string | undefined => {
  const v = ctx.req.headers[name]
  return Array.isArray(v) ? v[0] : v
}

/** Mobile identifies itself (X-LVN-Client: mobile); everyone else is treated as a browser and gets the cookie. */
export const deviceOf = (ctx: RequestContext): DeviceInfo => ({
  client: header(ctx, 'x-lvn-client') === 'mobile' ? 'mobile' : 'web',
  userAgent: header(ctx, 'user-agent')?.slice(0, 200),
})

/**
 * Browsers set `Sec-Fetch-*` on every request and page script cannot remove them. A native client does not send them.
 * The mobile header alone is not proof of a native app: a page can set it and would then read the long-lived refresh
 * token out of the JSON, which the HttpOnly cookie is there to prevent.
 */
export const browserRequest = (ctx: RequestContext): boolean =>
  header(ctx, 'sec-fetch-site') !== undefined || header(ctx, 'sec-fetch-mode') !== undefined || header(ctx, 'sec-fetch-dest') !== undefined

/** Session payload: the refresh token goes in the body for a native client and in the cookie for a browser. */
export async function deliverSession(ctx: RequestContext, cookie: RefreshCookieOptions, users: UsersService, s: IssuedSession): Promise<Session> {
  const native = deviceOf(ctx).client === 'mobile' && !browserRequest(ctx)
  // Domain must never be set on this cookie. maxAge sits beside expires; clearCookie does not receive maxAge,
  // because a Max-Age would override the past Expires that removes the cookie.
  if (!native) ctx.res.cookie(REFRESH_COOKIE, s.refreshToken, { ...cookie, expires: s.refreshTokenExpiresAt, maxAge: REFRESH_COOKIE_MAX_AGE_MS })
  const user = await users.viewerProfile(s.userId)
  return { accessToken: s.accessToken, accessTokenExpiresAt: s.accessTokenExpiresAt, refreshToken: native ? s.refreshToken : null, user: user! }
}

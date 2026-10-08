import type { RequestContext } from '@lvn-backend/auth-guard'
import type { DeviceInfo, IssuedSession } from '../application/session.service'
import type { UsersService } from '../application/users.service'
import type { Session } from './schema.types'

/** The web client's refresh token: HttpOnly, Secure, SameSite=Lax, only ever sent to /graphql (§7.1). */
export const REFRESH_COOKIE = 'lvn_rt'
export const refreshCookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/graphql' }

const header = (ctx: RequestContext, name: string): string | undefined => {
  const v = ctx.req.headers[name]
  return Array.isArray(v) ? v[0] : v
}

/** Mobile identifies itself (X-LVN-Client: mobile); everyone else is treated as a browser and gets the cookie. */
export const deviceOf = (ctx: RequestContext): DeviceInfo => ({
  client: header(ctx, 'x-lvn-client') === 'mobile' ? 'mobile' : 'web',
  userAgent: header(ctx, 'user-agent')?.slice(0, 200),
})

/** Session payload: the refresh token goes in the body for mobile and in the cookie for web. */
export async function deliverSession(ctx: RequestContext, users: UsersService, s: IssuedSession): Promise<Session> {
  const mobile = deviceOf(ctx).client === 'mobile'
  if (!mobile) ctx.res.cookie(REFRESH_COOKIE, s.refreshToken, { ...refreshCookieOptions, expires: s.refreshTokenExpiresAt })
  const user = await users.viewerProfile(s.userId)
  return { accessToken: s.accessToken, accessTokenExpiresAt: s.accessTokenExpiresAt, refreshToken: mobile ? s.refreshToken : null, user: user! }
}

import type { RequestContext } from '@lvn-backend/auth-guard'
import type { IssuedSession } from '../../src/application/session.service'
import { browserRequest, deliverSession, REFRESH_COOKIE, REFRESH_COOKIE_MAX_AGE_MS, refreshCookieOptions, type RefreshCookieOptions } from '../../src/graphql/session-delivery'
import { SESSION_TTL_DAYS } from '../../src/domain/rules'

const cookieOptions: RefreshCookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/graphql' }
const session: IssuedSession = {
  userId: 'u',
  accessToken: 'access',
  accessTokenExpiresAt: new Date('2026-11-07T00:15:00Z'),
  refreshToken: 'refresh-token-value',
  refreshTokenExpiresAt: new Date('2026-12-07T00:00:00Z'),
  mfaRequired: false,
  mfaFactors: [],
}

function ctx(headers: Record<string, string>): { context: RequestContext; set: { name: string; value: string; options: object }[] } {
  const set: { name: string; value: string; options: object }[] = []
  return {
    set,
    context: {
      req: { headers },
      res: {
        cookie: (name, value, options) => set.push({ name, value, options }),
        clearCookie: () => undefined,
      },
      requestId: 'r',
      viewer: null,
    },
  }
}

const users = { viewerProfile: async () => ({ id: 'u' }) } as never

describe('refresh token delivery', () => {
  it('puts the refresh token in the body only for a native client', async () => {
    const native = ctx({ 'x-lvn-client': 'mobile' })
    const delivered = await deliverSession(native.context, cookieOptions, users, session)
    expect(delivered.refreshToken).toBe(session.refreshToken)
    expect(native.set).toEqual([])
    expect(browserRequest(native.context)).toBe(false)
  })

  it('keeps the refresh token in the HttpOnly cookie when a browser claims to be mobile', async () => {
    const browser = ctx({ 'x-lvn-client': 'mobile', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' })
    const delivered = await deliverSession(browser.context, cookieOptions, users, session)
    expect(delivered.refreshToken).toBeNull()
    expect(browser.set).toEqual([{ name: REFRESH_COOKIE, value: session.refreshToken, options: { ...cookieOptions, expires: session.refreshTokenExpiresAt, maxAge: REFRESH_COOKIE_MAX_AGE_MS } }])
    expect(browser.set[0]?.options).not.toHaveProperty('domain')
  })

  it('keeps the cookie host-only for an https issuer and sets Max-Age to the session length', () => {
    const https = refreshCookieOptions('https://api.learnvianotes.in')
    expect(https).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/graphql' })
    expect(https).not.toHaveProperty('domain')
    expect(refreshCookieOptions('http://192.168.1.20:4000').secure).toBe(false)
    expect(REFRESH_COOKIE_MAX_AGE_MS).toBe(SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
    expect(REFRESH_COOKIE).toBe('lvn_rt')
  })

  it('treats a request without the mobile header as a browser', async () => {
    const web = ctx({})
    const delivered = await deliverSession(web.context, cookieOptions, users, session)
    expect(delivered.refreshToken).toBeNull()
    expect(web.set[0]?.name).toBe(REFRESH_COOKIE)
  })
})

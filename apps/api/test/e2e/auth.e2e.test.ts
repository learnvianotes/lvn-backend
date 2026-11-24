import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Mailbox } from '@lvn-backend/testing'
import request from 'supertest'
import { createTestApp, infra, type TestApp } from '../support/app'

/** Email + password accounts, sessions and password reset end to end (spec §7, ADR-0017). */

const SIGN_UP = `mutation ($input: SignUpInput!) {
  signUp(input: $input) {
    session { accessToken accessTokenExpiresAt refreshToken user { id email emailVerified registrationComplete verified handle } }
    userErrors { field message code }
  }
}`
const SIGN_IN = `mutation ($input: SignInInput!) {
  signIn(input: $input) { session { accessToken refreshToken user { id } } userErrors { field message code } }
}`
const REFRESH = `mutation ($input: RefreshSessionInput!) { refreshSession(input: $input) { session { accessToken refreshToken } userErrors { code } } }`
const VIEWER = '{ viewer { id emailVerified } }'

let seq = 0
const newEmail = () => `learner${Date.now()}${seq++}@example.com`
const signUpInput = (over: Record<string, unknown> = {}) => ({
  email: newEmail(),
  password: 'correct horse battery staple',
  displayName: 'Asha Rao',
  age: 22,
  acceptedTermsVersion: '2026-11-12',
  ...over,
})

/** The date `years` ago today (UTC), as sign-up forms from before ADR-0104 send it. */
const yearsAgo = (years: number) => {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString().slice(0, 10)
}

type SignUpResult = { signUp: { session: { accessToken: string; refreshToken: string | null; user: { id: string; email: string; emailVerified: boolean; registrationComplete: boolean; verified: boolean; handle: string } } | null; userErrors: { field: string[] | null; message: string; code: string }[] } }

/** 30 days, SESSION_TTL_DAYS. Express sends it as Max-Age in seconds. */
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60

const refreshSetCookie = (res: request.Response): string => {
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('lvn_rt='))
  expect(cookie).toBeDefined()
  return cookie!
}

/** Host-only lvn_rt: HttpOnly, SameSite=Lax, Path=/graphql, Max-Age, and no Domain attribute. */
const expectRefreshCookie = (cookie: string, secure: boolean) => {
  expect(cookie).toMatch(/HttpOnly/)
  expect(cookie).toMatch(/SameSite=Lax/)
  expect(cookie).toMatch(/Path=\/graphql/)
  expect(cookie).toMatch(new RegExp(`Max-Age=${REFRESH_MAX_AGE}\\b`))
  expect(cookie.split(';').some((part) => part.trim().toLowerCase().startsWith('domain='))).toBe(false)
  if (secure) expect(cookie).toMatch(/;\s*Secure\b/)
  else expect(cookie).not.toMatch(/Secure/)
}

describe('auth', () => {
  let t: TestApp
  let mail: Mailbox
  const http = () => request(t.app.getHttpServer())
  /** A GraphQL call as the mobile app makes it: refresh tokens in the body, no cookie. */
  const mobile = (query: string, variables: object, token?: string) => {
    const req = http().post('/graphql').set('x-lvn-client', 'mobile')
    if (token) req.set('authorization', `Bearer ${token}`)
    return req.send({ query, variables })
  }

  beforeAll(async () => {
    t = await createTestApp()
    mail = new Mailbox(infra().mail.apiUrl)
  })

  afterAll(() => t.close())

  describe('signUp', () => {
    it('creates the account, signs it in and emails a verification link', async () => {
      const input = signUpInput()
      const res = await t.gql<SignUpResult>(SIGN_UP, { input })
      const session = res.data!.signUp.session!
      expect(res.data!.signUp.userErrors).toEqual([])
      expect(session.user).toMatchObject({ email: input.email, emailVerified: false, registrationComplete: true, verified: false, handle: 'asharao' })
      expect(session.refreshToken).toBeNull() // web: the refresh token is in the cookie
      // ADR-0104: the typed age and when it was given are kept; no date of birth.
      const row = await t.app.get(PrismaService).user.findUniqueOrThrow({ where: { id: session.user.id } })
      expect(row).toMatchObject({ declaredAge: 22, dateOfBirth: null })
      expect(Date.now() - row.ageDeclaredAt!.getTime()).toBeLessThan(60_000)

      expect((await t.gql(VIEWER, {}, session.accessToken)).data).toEqual({ viewer: { id: session.user.id, emailVerified: false } })

      const email = await mail.latestTo(input.email)
      expect(email.subject).toBe('Confirm your email')
      const token = new URL(/href="([^"]+\/verify\?token=[^"]+)"/.exec(email.html)![1]!.replace(/&amp;/g, '&')).searchParams.get('token')!
      const verified = await t.gql<{ verifyEmail: { ok: boolean; user: { id: string; emailVerified: boolean; verified: boolean } | null } }>('mutation ($t: String!) { verifyEmail(input: { token: $t }) { ok user { id emailVerified verified } userErrors { code } } }', { t: token })
      expect(verified.data!.verifyEmail.ok).toBe(true)
      expect(verified.data!.verifyEmail.user).toEqual({ id: session.user.id, emailVerified: true, verified: false })
      expect((await t.gql(VIEWER, {}, session.accessToken)).data).toEqual({ viewer: { id: session.user.id, emailVerified: true } })

      const again = await t.gql<{ verifyEmail: { ok: boolean; userErrors: { code: string }[] } }>('mutation ($t: String!) { verifyEmail(input: { token: $t }) { ok userErrors { code } } }', { t: token })
      expect(again.data!.verifyEmail).toEqual({ ok: false, userErrors: [{ code: 'VALIDATION' }] })
    })

    it('sets an HttpOnly, SameSite=Lax refresh cookie scoped to /graphql for the web, not Secure on a plain-HTTP API, and never a Domain', async () => {
      // JWT_ISSUER (the API's public origin) is http:// here: browsers would drop a Secure cookie from it.
      const res = await http().post('/graphql').send({ query: SIGN_UP, variables: { input: signUpInput() } })
      expectRefreshCookie(refreshSetCookie(res), false)
    })

    it('makes the refresh cookie Secure when the API is served over HTTPS, still with no Domain', async () => {
      const https = await createTestApp({ JWT_ISSUER: 'https://api.example.test' })
      try {
        const res = await request(https.app.getHttpServer()).post('/graphql').send({ query: SIGN_UP, variables: { input: signUpInput() } })
        expectRefreshCookie(refreshSetCookie(res), true)
      } finally {
        await https.close()
      }
    })

    it('gives the mobile app its refresh token in the body and no cookie', async () => {
      const res = await mobile(SIGN_UP, { input: signUpInput() })
      expect(res.body.data.signUp.session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(res.headers['set-cookie']).toBeUndefined()
    })

    it('keeps the refresh token in the cookie when a browser sends the mobile header', async () => {
      // Sec-Fetch-* is set by the browser and script cannot remove it, so the header is not a way to read lvn_rt.
      const res = await http().post('/graphql').set('x-lvn-client', 'mobile').set('sec-fetch-site', 'same-origin').set('sec-fetch-mode', 'cors').send({ query: SIGN_UP, variables: { input: signUpInput() } })
      expect(res.body.data.signUp.session.refreshToken).toBeNull()
      const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('lvn_rt='))
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).toMatch(/SameSite=Lax/)
    })

    it.each([
      [{ password: 'short' }, ['input', 'password'], /at least 10/],
      [{ age: 0 }, ['input', 'age'], /from 1 to 120/],
      [{ age: 121 }, ['input', 'age'], /from 1 to 120/],
      [{ age: -5 }, ['input', 'age'], /from 1 to 120/],
      [{ age: undefined }, ['input', 'age'], /Enter your age/],
      [{ age: null, dateOfBirth: null }, ['input', 'age'], /Enter your age/],
      // The deprecated dateOfBirth of apps from before ADR-0104 is still checked as before.
      [{ age: undefined, dateOfBirth: '2004-02-30' }, ['input', 'dateOfBirth'], /real date/],
      [{ age: undefined, dateOfBirth: '2999-01-01' }, ['input', 'dateOfBirth'], /future/],
      [{ age: undefined, dateOfBirth: yearsAgo(0) }, ['input', 'dateOfBirth'], /real date of birth/],
      [{ email: 'not-an-email' }, ['input', 'email'], /valid email/],
      [{ displayName: '   ' }, ['input', 'displayName'], /name/],
      [{ acceptedTermsVersion: '2020-01-01' }, ['input', 'acceptedTermsVersion'], /Terms/],
    ])('refuses %j', async (over, field, message) => {
      const res = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput(over) })
      expect(res.data!.signUp.session).toBeNull()
      expect(res.data!.signUp.userErrors).toEqual([{ code: 'VALIDATION', field, message: expect.stringMatching(message) }])
    })

    it.each([17.5, '18', true])('refuses the age %p as VALIDATION before anything is stored', async (age) => {
      // GraphQL's Int takes whole numbers only; the API reports the bad variable as VALIDATION.
      const input = signUpInput({ age })
      const res = await t.gql<SignUpResult>(SIGN_UP, { input })
      expect(res.data).toBeUndefined()
      expect(res.errors?.[0]?.extensions.code).toBe('VALIDATION')
      expect(res.errors?.[0]?.message).toMatch(/input\.age/)
      expect(await t.app.get(PrismaService).user.count({ where: { email: input.email as string } })).toBe(0)
    })

    it.each([
      ['an age', { age: 7 }, 'age'],
      ['the date of birth an older app sends', { age: undefined, dateOfBirth: yearsAgo(7) }, 'dateOfBirth'],
    ])('keeps %s below the minimum age as AGE_BLOCKED and returns AGE_RESTRICTED', async (_what, over, field) => {
      const input = signUpInput(over)
      const res = await t.gql<{ signUp: { session: { accessToken: string } | null; userErrors: { field: string[] | null; message: string; code: string; supportEmail: string | null }[] } }>(
        `mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken } userErrors { field message code supportEmail } } }`,
        { input },
      )
      expect(res.data!.signUp.session).toBeNull()
      expect(res.data!.signUp.userErrors).toEqual([{
        code: 'AGE_RESTRICTED',
        field: ['input', field],
        message: expect.stringMatching(/Contact an admin at support@learnvianotes\.in/),
        supportEmail: 'support@learnvianotes.in',
      }])
      const user = await t.app.get(PrismaService).user.findUnique({ where: { email: input.email as string } })
      expect(user).toMatchObject({ accountStatus: 'AGE_BLOCKED', statusReason: 'Below the minimum age for an account.', analyticsOptOut: true })
      // Only the age is kept, whichever input it came from (ADR-0104).
      expect(user).toMatchObject({ declaredAge: 7, dateOfBirth: null })
      expect(user!.deletedAt).toBeNull()
      expect(user!.registrationCompletedAt).not.toBeNull()
      expect(await t.app.get(PrismaService).session.count({ where: { userId: user!.id } })).toBe(0)
    })

    it('lets someone in who is eighteen', async () => {
      const res = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput({ age: 18 }) })
      expect(res.data!.signUp.userErrors).toEqual([])
      expect(res.data!.signUp.session).not.toBeNull()
    })

    it.each([13, 17])('lets a %s-year-old sign up as a restricted minor, records auto_unverified consent, and sign in again', async (age) => {
      const input = signUpInput({ age, displayName: `Age ${age}`, parentEmail: `parent-${age}@example.com` })
      const res = await t.gql<SignUpResult>(SIGN_UP, { input })
      expect(res.data!.signUp.userErrors).toEqual([])
      const session = res.data!.signUp.session!
      const db = t.app.get(PrismaService)
      const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id }, include: { consents: true, guardianConsents: true } })
      expect(user).toMatchObject({ accountStatus: 'ACTIVE', declaredAge: age, dateOfBirth: null, analyticsOptOut: true, statusReason: null })
      expect(user.consents.map((c) => c.kind).sort()).toEqual(['PRIVACY', 'PUBLIC_CONTENT_LICENCE', 'TERMS'])
      expect(user.consents.some((c) => c.kind === 'GUARDIAN')).toBe(false)
      expect(user.email).toBe(input.email)
      expect(user.guardianConsents).toEqual([expect.objectContaining({ kind: 'GUARDIAN', method: 'auto_unverified', ageBand: age === 13 ? '13_15' : '16_17', noticeVersion: '2026-11-12', parentEmail: `parent-${age}@example.com`, verifiedAt: null })])
      const viewer = await t.gql<{ viewer: { restrictedMinor: boolean; analyticsOptOut: boolean } }>(
        '{ viewer { restrictedMinor analyticsOptOut } }',
        {},
        session.accessToken,
      )
      expect(viewer.data!.viewer).toEqual({ restrictedMinor: true, analyticsOptOut: true })
      const stranger = await t.gql<{ userByHandle: { id: string } | null }>('query ($h: String!) { userByHandle(handle: $h) { id } }', { h: session.user.handle })
      expect(stranger.data!.userByHandle).toBeNull()
      const own = await t.gql<{ userByHandle: { id: string } | null }>('query ($h: String!) { userByHandle(handle: $h) { id } }', { h: session.user.handle }, session.accessToken)
      expect(own.data!.userByHandle).toEqual({ id: session.user.id })
      const again = await t.gql<{ signIn: { session: { user: { id: string } } | null; userErrors: { code: string }[] } }>(SIGN_IN, { input: { email: input.email, password: input.password } })
      expect(again.data!.signIn.userErrors).toEqual([])
      expect(again.data!.signIn.session!.user.id).toBe(session.user.id)
      const optedIn = await t.gql<{ setAnalyticsOptOut: { ok: boolean } }>('mutation { setAnalyticsOptOut(optOut: false) { ok } }', {}, session.accessToken)
      expect(optedIn.data!.setAnalyticsOptOut.ok).toBe(true)
      expect(await db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { analyticsOptOut: true } })).toEqual({ analyticsOptOut: true })
      expect((await t.gql<{ viewer: { analyticsOptOut: boolean } }>('{ viewer { analyticsOptOut } }', {}, session.accessToken)).data!.viewer.analyticsOptOut).toBe(true)
    })

    it('lets someone in on their eighteenth birthday from an older app, and stores the age, not the date', async () => {
      const res = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput({ age: undefined, dateOfBirth: yearsAgo(18) }) })
      expect(res.data!.signUp.userErrors).toEqual([])
      const row = await t.app.get(PrismaService).user.findUniqueOrThrow({ where: { id: res.data!.signUp.session!.user.id } })
      expect(row).toMatchObject({ declaredAge: 18, dateOfBirth: null })
    })

    it('uses the age when an app sends both, and ignores the date of birth', async () => {
      const res = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput({ age: 30, dateOfBirth: yearsAgo(10) }) })
      expect(res.data!.signUp.userErrors).toEqual([])
      const row = await t.app.get(PrismaService).user.findUniqueOrThrow({ where: { id: res.data!.signUp.session!.user.id } })
      expect(row).toMatchObject({ declaredAge: 30, dateOfBirth: null })
      const young = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput({ age: 7, dateOfBirth: yearsAgo(40) }) })
      expect(young.data!.signUp.userErrors[0]).toMatchObject({ code: 'AGE_RESTRICTED', field: ['input', 'age'] })
    })

    it('refuses an email that already has an account, in any letter case', async () => {
      const input = signUpInput()
      await t.gql(SIGN_UP, { input })
      const res = await t.gql<SignUpResult>(SIGN_UP, { input: { ...input, email: input.email.toUpperCase() } })
      expect(res.data!.signUp.userErrors[0]).toMatchObject({ code: 'CONFLICT', field: ['input', 'email'] })
    })

    it('exposes the terms version new accounts must accept', async () => {
      expect((await t.gql('{ termsVersion }')).data).toEqual({ termsVersion: '2026-11-12' })
    })
  })

  describe('signIn', () => {
    it('signs in with the right password and refuses a wrong one without saying which part was wrong', async () => {
      const input = signUpInput()
      await t.gql(SIGN_UP, { input })
      const ok = await t.gql<{ signIn: { session: { user: { id: string } } } }>(SIGN_IN, { input: { email: input.email.toUpperCase(), password: input.password } })
      expect(ok.data!.signIn.session.user.id).toBeDefined()
      const wrong = await t.gql<{ signIn: { session: null; userErrors: { message: string; code: string }[] } }>(SIGN_IN, { input: { email: input.email, password: 'wrong password!!' } })
      const unknown = await t.gql<{ signIn: { session: null; userErrors: { message: string; code: string }[] } }>(SIGN_IN, { input: { email: newEmail(), password: 'wrong password!!' } })
      expect(wrong.data!.signIn.userErrors).toEqual(unknown.data!.signIn.userErrors)
      expect(wrong.data!.signIn.userErrors[0]).toMatchObject({ code: 'VALIDATION', message: 'Email or password is incorrect.' })
    })

    it('sets the same host-only refresh cookie on sign-in', async () => {
      const input = signUpInput()
      await http().post('/graphql').send({ query: SIGN_UP, variables: { input } })
      const res = await http().post('/graphql').send({ query: SIGN_IN, variables: { input: { email: input.email, password: input.password } } })
      expect(res.body.data.signIn.session.accessToken).toBeTruthy()
      expect(res.body.data.signIn.session.refreshToken).toBeNull()
      expectRefreshCookie(refreshSetCookie(res), false)
    })

    it('allows 5 attempts per account per 15 minutes (§7.1)', async () => {
      const input = signUpInput()
      await t.gql(SIGN_UP, { input })
      for (let i = 0; i < 5; i++) await t.gql(SIGN_IN, { input: { email: input.email, password: 'wrong password!!' } })
      const res = await t.gql<{ signIn: { userErrors: { code: string }[] } }>(SIGN_IN, { input: { email: input.email, password: input.password } })
      expect(res.data!.signIn.userErrors[0]!.code).toBe('RATE_LIMITED')
    })
  })

  describe('sessions', () => {
    it('rotates the refresh token on every use', async () => {
      const first = (await mobile(SIGN_UP, { input: signUpInput() })).body.data.signUp.session
      const second = (await mobile(REFRESH, { input: { refreshToken: first.refreshToken } })).body.data.refreshSession.session
      expect(second.refreshToken).not.toBe(first.refreshToken)
      expect((await t.gql<{ viewer: { id: string } }>(VIEWER, {}, second.accessToken)).data!.viewer).not.toBeNull()
    })

    it('revokes the whole family when a rotated token is reused, and its access tokens stop working at once', async () => {
      const first = (await mobile(SIGN_UP, { input: signUpInput() })).body.data.signUp.session
      const second = (await mobile(REFRESH, { input: { refreshToken: first.refreshToken } })).body.data.refreshSession.session
      const reuse = await mobile(REFRESH, { input: { refreshToken: first.refreshToken } })
      expect(reuse.body.errors[0].extensions.code).toBe('UNAUTHENTICATED')
      const afterReuse = await mobile(REFRESH, { input: { refreshToken: second.refreshToken } })
      expect(afterReuse.body.errors[0].extensions.code).toBe('UNAUTHENTICATED')
      expect((await t.gql(VIEWER, {}, second.accessToken)).data).toEqual({ viewer: null })
    })

    it('lets only one of two concurrent refreshes win', async () => {
      const first = (await mobile(SIGN_UP, { input: signUpInput() })).body.data.signUp.session
      const results = await Promise.all([1, 2].map(() => mobile(REFRESH, { input: { refreshToken: first.refreshToken } })))
      expect(results.filter((r) => r.body.data?.refreshSession?.session).length).toBeLessThanOrEqual(1)
    })

    it('refreshes the web session from the cookie, rotating the cookie', async () => {
      // Passed by hand: supertest keeps no cookie jar.
      const cookieOf = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('lvn_rt='))!.split(';')[0]!
      const signUp = await http().post('/graphql').send({ query: SIGN_UP, variables: { input: signUpInput() } })
      const res = await http().post('/graphql').set('cookie', cookieOf(signUp)).send({ query: REFRESH, variables: { input: {} } })
      expect(res.body.data.refreshSession.session.accessToken).toBeDefined()
      expect(res.body.data.refreshSession.session.refreshToken).toBeNull()
      expect(cookieOf(res)).not.toBe(cookieOf(signUp))
      const stale = await http().post('/graphql').set('cookie', cookieOf(signUp)).send({ query: REFRESH, variables: { input: {} } })
      expect(stale.body.errors[0].extensions.code).toBe('UNAUTHENTICATED')
      expect(([] as string[]).concat(stale.headers['set-cookie'] ?? []).join()).toMatch(/lvn_rt=;/)
    })

    it('refuses a refresh with no token', async () => {
      const res = await t.gql(REFRESH, { input: {} })
      expect(res.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    })

    it('signs this device out: its access token and refresh token both stop working', async () => {
      const s = (await mobile(SIGN_UP, { input: signUpInput() })).body.data.signUp.session
      const out = await mobile('mutation { signOut { ok } }', {}, s.accessToken)
      expect(out.body.data.signOut.ok).toBe(true)
      expect((await t.gql(VIEWER, {}, s.accessToken)).data).toEqual({ viewer: null })
      expect((await mobile(REFRESH, { input: { refreshToken: s.refreshToken } })).body.errors[0].extensions.code).toBe('UNAUTHENTICATED')
    })

    it('requires a session to sign out', async () => {
      expect((await t.gql('mutation { signOut { ok } }')).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    })

    it('clears the refresh cookie on sign-out with the same Path and no Domain', async () => {
      const signUp = await http().post('/graphql').send({ query: SIGN_UP, variables: { input: signUpInput() } })
      const set = refreshSetCookie(signUp)
      expectRefreshCookie(set, false)
      const access = signUp.body.data.signUp.session.accessToken as string
      const out = await http().post('/graphql').set('cookie', set.split(';')[0]!).set('authorization', `Bearer ${access}`).send({ query: 'mutation { signOut { ok } }' })
      expect(out.body.data.signOut.ok).toBe(true)
      const cleared = refreshSetCookie(out)
      expect(cleared).toMatch(/^lvn_rt=;/)
      expect(cleared).toMatch(/Path=\/graphql/)
      expect(cleared.split(';').some((part) => part.trim().toLowerCase().startsWith('domain='))).toBe(false)
    })
  })

  describe('password reset', () => {
    const RESET_REQ = 'mutation ($e: String!) { requestPasswordReset(input: { email: $e }) { ok userErrors { code } } }'
    const RESET = 'mutation ($t: String!, $p: String!) { resetPassword(input: { token: $t, password: $p }) { ok userErrors { code field message } } }'

    it('answers ok for an unknown email, sends nothing and stores no token', async () => {
      const email = newEmail()
      const db = t.app.get(PrismaService)
      const before = await db.emailToken.count()
      const res = await t.gql<{ requestPasswordReset: { ok: boolean; userErrors: unknown[] } }>(RESET_REQ, { e: email })
      expect(res.data!.requestPasswordReset).toEqual({ ok: true, userErrors: [] })
      expect(await mail.countTo(email)).toBe(0)
      expect(await db.emailToken.count()).toBe(before)
    })

    it('resets the password from the emailed link and signs out every device', async () => {
      const input = signUpInput()
      const s = (await mobile(SIGN_UP, { input })).body.data.signUp.session
      await t.gql(RESET_REQ, { e: input.email })
      const email = await mail.latestTo(input.email)
      expect(email.subject).toBe('Reset your password')
      const token = new URL(/href="([^"]+\/reset\?token=[^"]+)"/.exec(email.html)![1]!.replace(/&amp;/g, '&')).searchParams.get('token')!

      const weak = await t.gql<{ resetPassword: { ok: boolean; userErrors: { field: string[] }[] } }>(RESET, { t: token, p: 'short' })
      expect(weak.data!.resetPassword.userErrors[0]!.field).toEqual(['input', 'password'])

      const done = await t.gql<{ resetPassword: { ok: boolean } }>(RESET, { t: token, p: 'a brand new passphrase' })
      expect(done.data!.resetPassword.ok).toBe(true)
      expect((await t.gql(VIEWER, {}, s.accessToken)).data).toEqual({ viewer: null })
      expect((await mobile(REFRESH, { input: { refreshToken: s.refreshToken } })).body.errors[0].extensions.code).toBe('UNAUTHENTICATED')
      expect((await mail.latestTo(input.email)).subject).toBe('Your password was changed')

      const signIn = await t.gql<{ signIn: { session: unknown } }>(SIGN_IN, { input: { email: input.email, password: 'a brand new passphrase' } })
      expect(signIn.data!.signIn.session).not.toBeNull()
      const reused = await t.gql<{ resetPassword: { ok: boolean; userErrors: { code: string }[] } }>(RESET, { t: token, p: 'another new passphrase' })
      expect(reused.data!.resetPassword).toMatchObject({ ok: false, userErrors: [{ code: 'VALIDATION' }] })
    })

    it('allows 3 reset requests per hour per email (§7.1)', async () => {
      const email = newEmail()
      for (let i = 0; i < 3; i++) await t.gql(RESET_REQ, { e: email })
      const res = await t.gql<{ requestPasswordReset: { userErrors: { code: string }[] } }>(RESET_REQ, { e: email })
      expect(res.data!.requestPasswordReset.userErrors[0]!.code).toBe('RATE_LIMITED')
    })
  })
})

describe('breached-password check (§7.1)', () => {
  let t: TestApp
  let stub: Server
  let requested: string[] = []

  beforeAll(async () => {
    // A stand-in for the Have I Been Pwned range API that knows one leaked password.
    const leaked = createHash('sha1').update('password1234567').digest('hex').toUpperCase()
    stub = createServer((req, res) => {
      requested.push(req.url!)
      const prefix = req.url!.split('/').pop()!
      res.end(prefix === leaked.slice(0, 5) ? `${leaked.slice(5)}:3861493\r\n0000000000000000000000000000000000A:0` : '')
    })
    await new Promise<void>((r) => stub.listen(0, '127.0.0.1', r))
    const { port } = stub.address() as AddressInfo
    t = await createTestApp({ PASSWORD_BREACH_API_URL: `http://127.0.0.1:${port}/range` })
  })

  afterAll(async () => {
    await t.close()
    stub.close()
  })

  it('refuses a leaked password and sends only the first 5 characters of its hash', async () => {
    requested = []
    const res = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput({ password: 'password1234567' }) })
    expect(res.data!.signUp.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'password'], message: expect.stringMatching(/breach/) })
    expect(requested).toEqual([`/range/${createHash('sha1').update('password1234567').digest('hex').toUpperCase().slice(0, 5)}`])
  })

  it('accepts a password that is not in the list', async () => {
    const res = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput({ password: 'an unusual sentence of words' }) })
    expect(res.data!.signUp.userErrors).toEqual([])
  })
})

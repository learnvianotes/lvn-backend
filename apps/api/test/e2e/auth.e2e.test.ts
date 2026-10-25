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
  dateOfBirth: '2004-05-01',
  acceptedTermsVersion: '2026-10-08',
  ...over,
})

/** The date `years` ago today (UTC), as the sign-up forms send it. */
const yearsAgo = (years: number) => {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString().slice(0, 10)
}

type SignUpResult = { signUp: { session: { accessToken: string; refreshToken: string | null; user: { id: string; email: string; emailVerified: boolean; registrationComplete: boolean; verified: boolean; handle: string } } | null; userErrors: { field: string[] | null; message: string; code: string }[] } }

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

      expect((await t.gql(VIEWER, {}, session.accessToken)).data).toEqual({ viewer: { id: session.user.id, emailVerified: false } })

      const email = await mail.latestTo(input.email)
      expect(email.subject).toBe('Confirm your email')
      const token = new URL(/href="([^"]+\/verify\?token=[^"]+)"/.exec(email.html)![1]!.replace(/&amp;/g, '&')).searchParams.get('token')!
      const verified = await t.gql<{ verifyEmail: { ok: boolean } }>('mutation ($t: String!) { verifyEmail(input: { token: $t }) { ok userErrors { code } } }', { t: token })
      expect(verified.data!.verifyEmail.ok).toBe(true)
      expect((await t.gql(VIEWER, {}, session.accessToken)).data).toEqual({ viewer: { id: session.user.id, emailVerified: true } })

      const again = await t.gql<{ verifyEmail: { ok: boolean; userErrors: { code: string }[] } }>('mutation ($t: String!) { verifyEmail(input: { token: $t }) { ok userErrors { code } } }', { t: token })
      expect(again.data!.verifyEmail).toEqual({ ok: false, userErrors: [{ code: 'VALIDATION' }] })
    })

    it('sets an HttpOnly, SameSite=Lax refresh cookie scoped to /graphql for the web, not Secure on a plain-HTTP API', async () => {
      // JWT_ISSUER (the API's public origin) is http:// here: browsers would drop a Secure cookie from it.
      const res = await http().post('/graphql').send({ query: SIGN_UP, variables: { input: signUpInput() } })
      const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('lvn_rt='))!
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).not.toMatch(/Secure/)
      expect(cookie).toMatch(/SameSite=Lax/)
      expect(cookie).toMatch(/Path=\/graphql/)
    })

    it('makes the refresh cookie Secure when the API is served over HTTPS', async () => {
      const https = await createTestApp({ JWT_ISSUER: 'https://api.example.test' })
      try {
        const res = await request(https.app.getHttpServer()).post('/graphql').send({ query: SIGN_UP, variables: { input: signUpInput() } })
        const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('lvn_rt='))!
        expect(cookie).toMatch(/HttpOnly/)
        expect(cookie).toMatch(/; Secure/)
      } finally {
        await https.close()
      }
    })

    it('gives the mobile app its refresh token in the body and no cookie', async () => {
      const res = await mobile(SIGN_UP, { input: signUpInput() })
      expect(res.body.data.signUp.session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(res.headers['set-cookie']).toBeUndefined()
    })

    it.each([
      [{ password: 'short' }, ['input', 'password'], /at least 10/],
      [{ dateOfBirth: '2004-02-30' }, ['input', 'dateOfBirth'], /real date/],
      [{ dateOfBirth: '2999-01-01' }, ['input', 'dateOfBirth'], /future/],
      [{ email: 'not-an-email' }, ['input', 'email'], /valid email/],
      [{ displayName: '   ' }, ['input', 'displayName'], /name/],
      [{ acceptedTermsVersion: '2020-01-01' }, ['input', 'acceptedTermsVersion'], /Terms/],
    ])('refuses %j', async (over, field, message) => {
      const res = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput(over) })
      expect(res.data!.signUp.session).toBeNull()
      expect(res.data!.signUp.userErrors).toEqual([{ code: 'VALIDATION', field, message: expect.stringMatching(message) }])
    })

    it('keeps a date of birth below the minimum age as AGE_BLOCKED and returns AGE_RESTRICTED', async () => {
      const input = signUpInput({ dateOfBirth: yearsAgo(17) })
      const res = await t.gql<{ signUp: { session: { accessToken: string } | null; userErrors: { field: string[] | null; message: string; code: string; supportEmail: string | null }[] } }>(
        `mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken } userErrors { field message code supportEmail } } }`,
        { input },
      )
      expect(res.data!.signUp.session).toBeNull()
      expect(res.data!.signUp.userErrors).toEqual([{
        code: 'AGE_RESTRICTED',
        field: ['input', 'dateOfBirth'],
        message: expect.stringMatching(/Contact an admin at support@learnvianotes\.in/),
        supportEmail: 'support@learnvianotes.in',
      }])
      const user = await t.app.get(PrismaService).user.findUnique({ where: { email: input.email } })
      expect(user).toMatchObject({ accountStatus: 'AGE_BLOCKED', statusReason: 'Below the minimum age for an account.', analyticsOptOut: true })
      expect(user!.deletedAt).toBeNull()
      expect(user!.registrationCompletedAt).not.toBeNull()
      expect(await t.app.get(PrismaService).session.count({ where: { userId: user!.id } })).toBe(0)
    })

    it('lets someone in on their eighteenth birthday', async () => {
      const res = await t.gql<SignUpResult>(SIGN_UP, { input: signUpInput({ dateOfBirth: yearsAgo(18) }) })
      expect(res.data!.signUp.userErrors).toEqual([])
      expect(res.data!.signUp.session).not.toBeNull()
    })

    it('refuses an email that already has an account, in any letter case', async () => {
      const input = signUpInput()
      await t.gql(SIGN_UP, { input })
      const res = await t.gql<SignUpResult>(SIGN_UP, { input: { ...input, email: input.email.toUpperCase() } })
      expect(res.data!.signUp.userErrors[0]).toMatchObject({ code: 'CONFLICT', field: ['input', 'email'] })
    })

    it('exposes the terms version new accounts must accept', async () => {
      expect((await t.gql('{ termsVersion }')).data).toEqual({ termsVersion: '2026-10-08' })
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
  })

  describe('password reset', () => {
    const RESET_REQ = 'mutation ($e: String!) { requestPasswordReset(input: { email: $e }) { ok userErrors { code } } }'
    const RESET = 'mutation ($t: String!, $p: String!) { resetPassword(input: { token: $t, password: $p }) { ok userErrors { code field message } } }'

    it('answers ok for an unknown email and sends nothing', async () => {
      const email = newEmail()
      expect((await t.gql<{ requestPasswordReset: { ok: boolean } }>(RESET_REQ, { e: email })).data!.requestPasswordReset.ok).toBe(true)
      expect(await mail.countTo(email)).toBe(0)
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

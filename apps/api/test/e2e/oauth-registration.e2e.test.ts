import { createHash } from 'node:crypto'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { STUDY_PUBLISHER_EMAIL, STUDY_PUBLISHER_ID } from '@lvn-backend/users'
import { Mailbox } from '@lvn-backend/testing'
import request from 'supertest'
import { createTestApp, infra, type TestApp } from '../support/app'
import { OAuthStub } from '../support/oauth-stub'
import { seedUser, tokenFor } from '../support/seed'

/** Provider sign-in, account linking, registration details and the institutional email (ADR-0007, ADR-0017). */

const CLIENT = { id: 'lvn-test-client', secret: 'lvn-test-secret' }
const REDIRECT = 'http://localhost:3000/oauth/callback'
const VERIFIER = 'v'.repeat(43)

const GOOGLE = `mutation ($t: String!) { signInWithGoogle(input: { idToken: $t }) {
  session { accessToken user { id email emailVerified verified registrationComplete displayName globalRole signInMethods } } userErrors { field message code } } }`
const EXCHANGE = `mutation ($input: OAuthExchangeInput!) { oauthExchange(input: $input) {
  session { accessToken user { id email displayName emailVerified registrationComplete } } userErrors { field message code } } }`
const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) { emailLinkPending session { accessToken user { id } } userErrors { field message code } } }`
const SIGN_IN = `mutation ($input: SignInInput!) { signIn(input: $input) { session { accessToken user { id } } userErrors { code } } }`
const VERIFY = `mutation ($t: String!) { verifyEmail(input: { token: $t }) { ok userErrors { code message } } }`
const COMPLETE = `mutation ($input: CompleteRegistrationInput!) { completeRegistration(input: $input) { ok userErrors { field message code } } }`
const VIEWER = `{ viewer { id verified verificationMethod registrationComplete restrictedMinor institutionalEmail institutionalEmailStatus institution { name verified } } }`
const SET_INST = `mutation ($e: String!) { setInstitutionalEmail(input: { email: $e }) { ok userErrors { field message code } } }`
const VERIFY_INST = `mutation ($c: String!) { verifyInstitutionalEmail(input: { code: $c }) { ok userErrors { field message code } } }`
const RESEND = `mutation { resendInstitutionalEmailCode { ok userErrors { code message } } }`

let seq = 0
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${seq++}`
const terms = '2026-11-03'

type Payload<K extends string> = Record<K, { emailLinkPending?: boolean; session: { accessToken: string; user: Record<string, unknown> } | null; userErrors: { field: string[] | null; message: string; code: string }[] }>
type Ok<K extends string> = Record<K, { ok: boolean; userErrors: { field: string[] | null; message: string; code: string }[] }>

describe('provider sign-in and registration', () => {
  let t: TestApp
  let stub: OAuthStub
  let mail: Mailbox

  beforeAll(async () => {
    stub = await new OAuthStub(CLIENT).start()
    t = await createTestApp({
      FIREBASE_PROJECT_ID: 'lvn-test',
      GITHUB_CLIENT_ID: CLIENT.id,
      GITHUB_CLIENT_SECRET: CLIENT.secret,
      GITHUB_OAUTH_URL: stub.url,
      GITHUB_API_URL: `${stub.url}/api`,
      LINKEDIN_CLIENT_ID: CLIENT.id,
      LINKEDIN_CLIENT_SECRET: CLIENT.secret,
      LINKEDIN_OAUTH_URL: `${stub.url}/oauth/v2`,
      LINKEDIN_API_URL: `${stub.url}/v2`,
      OAUTH_REDIRECT_URIS: `${REDIRECT},lvn://oauth`,
    })
    mail = new Mailbox(infra().mail.apiUrl)
  })

  afterAll(async () => {
    await t.close()
    stub.stop()
  })

  it('lists the sign-in methods this deployment offers', async () => {
    expect((await t.gql('{ signInOptions { emailPassword google github linkedin } }')).data).toEqual({
      signInOptions: { emailPassword: true, google: true, github: true, linkedin: true },
    })
  })

  describe('Google (ADR-0007)', () => {
    it('creates an account that owes its registration details, then completes it once', async () => {
      const email = `${unique('g')}@gmail.com`
      const res = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${unique('uid')}:${email}:Meera Iyer` })
      const s = res.data!.signInWithGoogle.session!
      expect(s.user).toMatchObject({ email, emailVerified: true, registrationComplete: false, displayName: 'Meera Iyer' })
      expect((await t.gql<{ viewer: { restrictedMinor: boolean } }>(VIEWER, {}, s.accessToken)).data!.viewer.restrictedMinor).toBe(true)

      const bad = await t.gql<Ok<'completeRegistration'>>(COMPLETE, { input: { displayName: 'Meera', dateOfBirth: 'yesterday', acceptedTermsVersion: terms } }, s.accessToken)
      expect(bad.data!.completeRegistration.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'dateOfBirth'] })

      const done = await t.gql<Ok<'completeRegistration'>>(COMPLETE, { input: { displayName: 'Meera Iyer', dateOfBirth: '2001-03-09', acceptedTermsVersion: terms } }, s.accessToken)
      expect(done.data!.completeRegistration).toEqual({ ok: true, userErrors: [] })
      const viewer = (await t.gql<{ viewer: Record<string, unknown> }>(VIEWER, {}, s.accessToken)).data!.viewer
      expect(viewer).toMatchObject({ registrationComplete: true, restrictedMinor: false, verified: false, institutionalEmailStatus: 'NONE' })

      const again = await t.gql<Ok<'completeRegistration'>>(COMPLETE, { input: { displayName: 'X', dateOfBirth: '2001-03-09', acceptedTermsVersion: terms } }, s.accessToken)
      expect(again.data!.completeRegistration.userErrors[0]!.code).toBe('CONFLICT')
    })

    it('keeps an unfinished account whose own answer is under the minimum age, and signs that Google account in no further', async () => {
      const db = t.app.get(PrismaService)
      const uid = unique('young')
      const res = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${uid}:${uid}@gmail.com:Young One` })
      const s = res.data!.signInWithGoogle.session!
      const id = s.user.id as string
      const young = new Date()
      young.setUTCFullYear(young.getUTCFullYear() - 16)

      const refused = await t.gql<Ok<'completeRegistration'>>(COMPLETE, { input: { displayName: 'Young One', dateOfBirth: young.toISOString().slice(0, 10), acceptedTermsVersion: terms } }, s.accessToken)
      expect(refused.data!.completeRegistration).toEqual({ ok: false, userErrors: [{ code: 'AGE_RESTRICTED', field: ['input', 'dateOfBirth'], message: expect.stringMatching(/only for adults/) }] })
      const user = await db.user.findUniqueOrThrow({ where: { id } })
      expect(user).toMatchObject({ displayName: 'Young One', accountStatus: 'AGE_BLOCKED', statusReason: 'Below the minimum age for an account.' })
      expect(user.dateOfBirth).not.toBeNull()
      expect(user.registrationCompletedAt).not.toBeNull()
      expect(user.deletedAt).toBeNull()
      expect(await db.oAuthAccount.count({ where: { userId: id } })).toBe(1)
      expect(await db.session.count({ where: { userId: id, revokedAt: null } })).toBe(0)
      expect((await t.gql(VIEWER, {}, s.accessToken)).data?.viewer ?? null).toBeNull()

      const again = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${uid}:${uid}@gmail.com:Young One` })
      expect(again.data!.signInWithGoogle.session).toBeNull()
      expect(again.data!.signInWithGoogle.userErrors[0]!.code).toBe('AGE_RESTRICTED')
      expect(await db.user.count({ where: { email: `${uid}@gmail.com` } })).toBe(1)
    })

    it('signs the same Google account into the same LVN account', async () => {
      const token = `google:${unique('uid')}:${unique('same')}@gmail.com`
      const a = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: token })
      const b = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: token })
      expect(b.data!.signInWithGoogle.session!.user.id).toBe(a.data!.signInWithGoogle.session!.user.id)
    })

    it('refuses a token Firebase would not accept', async () => {
      const res = await t.gql(GOOGLE, { t: 'forged.token.value' })
      expect(res.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    })

    it('links Google to an existing verified email and keeps the password, role, name and sessions', async () => {
      const email = `${unique('link')}@example.com`
      const password = 'my own long password'
      const signUp = await request(t.app.getHttpServer()).post('/graphql').send({
        query: SIGN_UP,
        variables: { input: { email, password, displayName: 'Ravi', dateOfBirth: '2002-01-01', acceptedTermsVersion: terms } },
      })
      const userId = signUp.body.data.signUp.session.user.id as string
      const accessToken = signUp.body.data.signUp.session.accessToken as string
      const db = t.app.get(PrismaService)
      await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date(), globalRole: 'TEACHER' } })
      const before = await db.user.count()
      const g = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${unique('uid')}: ${email.toUpperCase()} :Someone Else` })
      expect(g.data!.signInWithGoogle.session!.user).toMatchObject({ id: userId, displayName: 'Ravi', globalRole: 'TEACHER', emailVerified: true })
      expect((await t.gql<{ viewer: { signInMethods: string[] } }>('{ viewer { signInMethods } }', {}, g.data!.signInWithGoogle.session!.accessToken)).data!.viewer.signInMethods).toEqual(['EMAIL', 'GOOGLE'])
      expect(await db.user.count()).toBe(before)
      expect(await db.oAuthAccount.count({ where: { userId, provider: 'GOOGLE' } })).toBe(1)
      expect((await t.gql<{ viewer: { id: string } }>(VIEWER, {}, accessToken)).data!.viewer.id).toBe(userId)
      expect((await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email, password } })).data!.signIn.session!.user.id).toBe(userId)

      const stranger = await seedUser(t.app, { verified: true })
      const seen = await t.gql<{ userByHandle: { signInMethods: string[] | null } | null }>(
        `query ($h: String!) { userByHandle(handle: $h) { signInMethods } }`,
        { h: (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { handle: true } })).handle },
        tokenFor(t.config, stranger.id),
      )
      expect(seen.data!.userByHandle!.signInMethods).toBeNull()
    })

    it('links Google to an account whose email is not verified, marks the login email verified, and does not create another user', async () => {
      const email = `${unique('victim')}@example.com`
      const password = 'attacker chosen password'
      const attacker = await t.gql<Payload<'signUp'>>(SIGN_UP, {
        input: { email, password, displayName: 'Not the owner', dateOfBirth: '2000-01-01', acceptedTermsVersion: terms },
      })
      const attackerToken = attacker.data!.signUp.session!.accessToken
      const userId = attacker.data!.signUp.session!.user.id as string
      const db = t.app.get(PrismaService)
      const before = await db.user.count()
      const g = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${unique('uid')}:${email}` })
      expect(g.data!.signInWithGoogle.userErrors).toEqual([])
      expect(g.data!.signInWithGoogle.session!.user).toMatchObject({ id: userId, emailVerified: true, verified: false, displayName: 'Not the owner' })
      expect(await db.user.count()).toBe(before)
      expect(await db.oAuthAccount.count({ where: { userId, provider: 'GOOGLE' } })).toBe(1)
      const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
      expect(user.emailVerifiedAt).not.toBeNull()
      expect(user.verifiedAt).toBeNull()
      expect(user.passwordHash).not.toBeNull()
      expect((await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email, password } })).data!.signIn.session!.user.id).toBe(userId)
      expect((await t.gql<{ viewer: { id: string; emailVerified: boolean; verified: boolean } }>(`{ viewer { id emailVerified verified } }`, {}, attackerToken)).data!.viewer).toEqual({ id: userId, emailVerified: true, verified: false })
    })

    it('refuses a Google token whose email is not verified, and stores nothing', async () => {
      const email = `${unique('nv')}@gmail.com`
      const db = t.app.get(PrismaService)
      const before = await db.user.count()
      const res = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google-unverified:${unique('uid')}:${email}` })
      expect(res.data!.signInWithGoogle.session).toBeNull()
      expect(res.data!.signInWithGoogle.userErrors[0]!.message).toMatch(/no verified email/)
      expect(await db.user.count()).toBe(before)
      expect(await db.user.findUnique({ where: { email } })).toBeNull()
    })

    it('attaches a password to an existing Google account only after the emailed link is used', async () => {
      const email = `${unique('both')}@gmail.com`
      const password = 'a long enough passphrase'
      const g = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${unique('uid')}:${email}:Meera Iyer` })
      const googleToken = g.data!.signInWithGoogle.session!.accessToken
      const userId = g.data!.signInWithGoogle.session!.user.id as string
      const db = t.app.get(PrismaService)
      const before = await db.user.count()
      const form = { email, password, displayName: 'Other Name', dateOfBirth: '2001-03-09', acceptedTermsVersion: terms }

      const young = new Date()
      young.setUTCFullYear(young.getUTCFullYear() - 16)
      const minor = await t.gql<Payload<'signUp'>>(SIGN_UP, { input: { ...form, dateOfBirth: young.toISOString().slice(0, 10) } })
      expect(minor.data!.signUp.userErrors[0]!.code).toBe('AGE_RESTRICTED')
      expect(await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true, deletedAt: true, displayName: true } })).toMatchObject({
        passwordHash: null,
        deletedAt: null,
        displayName: 'Meera Iyer',
      })

      const pending = await t.gql<Payload<'signUp'>>(SIGN_UP, { input: { ...form, email: ` ${email.toUpperCase()} ` } })
      expect(pending.data!.signUp).toMatchObject({ session: null, emailLinkPending: true, userErrors: [] })
      expect(await db.user.count()).toBe(before)
      expect((await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email, password } })).data!.signIn.session).toBeNull()

      const sent = await mail.latestTo(email)
      expect(sent.subject).toBe('Add a password to your account')
      const token = new URL(/href="([^"]+\/verify\?token=[^"]+)"/.exec(sent.html)![1]!.replace(/&amp;/g, '&')).searchParams.get('token')!
      expect((await t.gql<{ verifyEmail: { ok: boolean } }>(VERIFY, { t: token })).data!.verifyEmail.ok).toBe(true)

      const signedIn = await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email, password } })
      expect(signedIn.data!.signIn.session!.user.id).toBe(userId)
      expect((await t.gql<{ viewer: { id: string; displayName: string; signInMethods: string[]; registrationComplete: boolean } }>(
        `{ viewer { id displayName signInMethods registrationComplete } }`,
        {},
        googleToken,
      )).data!.viewer).toEqual({ id: userId, displayName: 'Meera Iyer', signInMethods: ['EMAIL', 'GOOGLE'], registrationComplete: false })

      const again = await t.gql<Payload<'signUp'>>(SIGN_UP, { input: { ...form, password: 'a different long password' } })
      expect(again.data!.signUp.emailLinkPending).toBe(false)
      expect(again.data!.signUp.userErrors[0]).toMatchObject({ code: 'CONFLICT', field: ['input', 'email'] })
      expect((await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email, password } })).data!.signIn.session!.user.id).toBe(userId)
    })
  })

  describe('Google switch (ADR-0100)', () => {
    const SET = `mutation ($enabled: Boolean!) { setGoogleSignInEnabled(input: { enabled: $enabled }) { settings { googleConfigured googleEnabled } userErrors { code } } }`

    it('lets a platform admin turn Google off while Firebase stays configured, and back on', async () => {
      const admin = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
      const adminToken = tokenFor(t.config, admin.id, undefined, ['PLATFORM_ADMIN'])
      const student = await seedUser(t.app, { verified: true })
      const studentToken = tokenFor(t.config, student.id)
      try {
        expect((await t.gql(`{ authSettings { googleConfigured googleEnabled } }`)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
        expect((await t.gql(`{ authSettings { googleConfigured googleEnabled } }`, {}, studentToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
        expect((await t.gql<{ authSettings: { googleConfigured: boolean; googleEnabled: boolean } }>(`{ authSettings { googleConfigured googleEnabled } }`, {}, adminToken)).data!.authSettings).toEqual({
          googleConfigured: true,
          googleEnabled: true,
        })

        const off = await t.gql<{ setGoogleSignInEnabled: { settings: { googleConfigured: boolean; googleEnabled: boolean } } }>(SET, { enabled: false }, adminToken)
        expect(off.data!.setGoogleSignInEnabled.settings).toEqual({ googleConfigured: true, googleEnabled: false })
        expect((await t.gql<{ signInOptions: { google: boolean } }>('{ signInOptions { google } }')).data!.signInOptions.google).toBe(false)
        const refused = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${unique('uid')}:${unique('off')}@gmail.com` })
        expect(refused.data!.signInWithGoogle.session).toBeNull()
        expect(refused.data!.signInWithGoogle.userErrors[0]!.message).toMatch(/not available/)
        expect((await t.gql(SET, { enabled: true }, studentToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      } finally {
        const on = await t.gql<{ setGoogleSignInEnabled: { settings: { googleEnabled: boolean } } }>(SET, { enabled: true }, adminToken)
        expect(on.data!.setGoogleSignInEnabled.settings.googleEnabled).toBe(true)
        expect((await t.gql<{ signInOptions: { google: boolean } }>('{ signInOptions { google } }')).data!.signInOptions.google).toBe(true)
      }
    })
  })

  describe('GitHub and LinkedIn (Authorization Code + PKCE)', () => {
    const githubUser = (email: string, verified = true) => ({ id: String(Math.floor(Math.random() * 1e9)), name: 'Kiran Rao', emails: [{ email, primary: true, verified }] })

    it('signs in with a GitHub code and its verifier, and again into the same account', async () => {
      const user = githubUser(`${unique('gh')}@example.com`)
      stub.issue('code-1', { user, codeVerifier: VERIFIER, redirectUri: REDIRECT })
      const first = await t.gql<Payload<'oauthExchange'>>(EXCHANGE, { input: { provider: 'GITHUB', code: 'code-1', codeVerifier: VERIFIER, redirectUri: REDIRECT } })
      expect(first.data!.oauthExchange.session!.user).toMatchObject({ email: user.emails[0]!.email, displayName: 'Kiran Rao', emailVerified: true, registrationComplete: false })
      stub.issue('code-2', { user, codeVerifier: VERIFIER, redirectUri: REDIRECT })
      const second = await t.gql<Payload<'oauthExchange'>>(EXCHANGE, { input: { provider: 'GITHUB', code: 'code-2', codeVerifier: VERIFIER, redirectUri: REDIRECT } })
      expect(second.data!.oauthExchange.session!.user.id).toBe(first.data!.oauthExchange.session!.user.id)
    })

    it('refuses a code used with the wrong verifier (stolen code)', async () => {
      stub.issue('code-3', { user: githubUser(`${unique('gh')}@example.com`), codeVerifier: VERIFIER, redirectUri: REDIRECT })
      const res = await t.gql(EXCHANGE, { input: { provider: 'GITHUB', code: 'code-3', codeVerifier: 'w'.repeat(43), redirectUri: REDIRECT } })
      expect(res.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    })

    it.each([
      [{ redirectUri: 'https://evil.example/callback' }, ['input', 'redirectUri']],
      [{ codeVerifier: 'too-short' }, ['input', 'codeVerifier']],
    ])('refuses %j before calling the provider', async (over, field) => {
      const res = await t.gql<Payload<'oauthExchange'>>(EXCHANGE, { input: { provider: 'GITHUB', code: 'x', codeVerifier: VERIFIER, redirectUri: REDIRECT, ...over } })
      expect(res.data!.oauthExchange.userErrors[0]).toMatchObject({ code: 'VALIDATION', field })
    })

    it('needs a verified email on the provider account', async () => {
      stub.issue('code-4', { user: githubUser(`${unique('gh')}@example.com`, false), codeVerifier: VERIFIER, redirectUri: REDIRECT })
      const res = await t.gql<Payload<'oauthExchange'>>(EXCHANGE, { input: { provider: 'GITHUB', code: 'code-4', codeVerifier: VERIFIER, redirectUri: REDIRECT } })
      expect(res.data!.oauthExchange.userErrors[0]!.message).toMatch(/no verified email/)
    })

    it('signs in with LinkedIn through the app deep link', async () => {
      const email = `${unique('li')}@example.com`
      stub.issue('li-1', { user: { id: unique('li-sub'), name: 'Divya S', emails: [{ email, primary: true, verified: true }] }, codeVerifier: VERIFIER, redirectUri: 'lvn://oauth' })
      const res = await t.gql<Payload<'oauthExchange'>>(EXCHANGE, { input: { provider: 'LINKEDIN', code: 'li-1', codeVerifier: VERIFIER, redirectUri: 'lvn://oauth' } })
      expect(res.data!.oauthExchange.session!.user).toMatchObject({ email, displayName: 'Divya S' })
    })
  })

  describe('institutional email (ADR-0017)', () => {
    const signUp = async (over: Record<string, unknown> = {}) => {
      const res = await t.gql<Payload<'signUp'>>(SIGN_UP, {
        input: { email: `${unique('s')}@example.com`, password: 'a long enough passphrase', displayName: 'Asha Rao', dateOfBirth: '2004-05-01', acceptedTermsVersion: terms, ...over },
      })
      return res.data!.signUp
    }
    const codeFrom = async (address: string) => {
      const m = await mail.latestTo(address)
      expect(m.subject).toMatch(/^\d{6} is your LearnViaNotes code$/)
      return m.subject.slice(0, 6)
    }

    it('verifies the account with the code sent at sign-up (academic domain)', async () => {
      const address = `${unique('asha')}@iitb.ac.in`
      const s = (await signUp({ institutionalEmail: address })).session!
      expect((await t.gql<{ viewer: Record<string, unknown> }>(VIEWER, {}, s.accessToken)).data!.viewer).toMatchObject({ institutionalEmail: address, institutionalEmailStatus: 'CODE_SENT', verified: false })
      const code = await codeFrom(address)
      const wrong = await t.gql<Ok<'verifyInstitutionalEmail'>>(VERIFY_INST, { c: code === '000000' ? '111111' : '000000' }, s.accessToken)
      expect(wrong.data!.verifyInstitutionalEmail.userErrors[0]!.message).toMatch(/4 tries left/)
      const ok = await t.gql<Ok<'verifyInstitutionalEmail'>>(VERIFY_INST, { c: code }, s.accessToken)
      expect(ok.data!.verifyInstitutionalEmail).toEqual({ ok: true, userErrors: [] })
      expect((await t.gql<{ viewer: Record<string, unknown> }>(VIEWER, {}, s.accessToken)).data!.viewer).toMatchObject({
        verified: true,
        verificationMethod: 'INSTITUTIONAL_EMAIL',
        institutionalEmailStatus: 'CONFIRMED',
      })
    })

    it.each([
      [`x@gmail.com`, /personal/],
      [`x@mailinator.com`, /personal/],
      [`x@nomail.example`, /does not receive email/],
      ['not an email', /valid email/],
    ])('refuses %s at sign-up without creating the account', async (address, message) => {
      const result = await signUp({ institutionalEmail: address })
      expect(result.session).toBeNull()
      expect(result.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'institutionalEmail'], message: expect.stringMatching(message) })
    })

    it('links a known organisation, including its sub-domains', async () => {
      const db = t.app.get(PrismaService)
      await db.organization.create({ data: { id: newId(), name: 'IIT Madras', emailDomains: ['iitm.ac.in'] } })
      const s = (await signUp()).session!
      const address = `${unique('cs')}@cse.iitm.ac.in`
      expect((await t.gql<Ok<'setInstitutionalEmail'>>(SET_INST, { e: address }, s.accessToken)).data!.setInstitutionalEmail.ok).toBe(true)
      await t.gql(VERIFY_INST, { c: await codeFrom(address) }, s.accessToken)
      const viewer = (await t.gql<{ viewer: { id: string; institution: unknown; verified: boolean } }>(VIEWER, {}, s.accessToken)).data!.viewer
      expect(viewer).toMatchObject({ verified: true, institution: { name: 'IIT Madras', verified: true } })
      expect(await db.membership.findFirst({ where: { userId: viewer.id } })).toMatchObject({ role: 'STUDENT' })
    })

    it('confirms an unknown company domain but leaves verification to platform-admin review', async () => {
      const s = (await signUp()).session!
      const address = `${unique('dev')}@acme-labs.com`
      await t.gql(SET_INST, { e: address }, s.accessToken)
      await t.gql(VERIFY_INST, { c: await codeFrom(address) }, s.accessToken)
      expect((await t.gql<{ viewer: Record<string, unknown> }>(VIEWER, {}, s.accessToken)).data!.viewer).toMatchObject({ verified: false, institutionalEmailStatus: 'PENDING_REVIEW' })
      expect(await t.app.get(PrismaService).domainReview.findUnique({ where: { domain: 'acme-labs.com' } })).toMatchObject({ status: 'NEEDS_REVIEW' })
    })

    it('lets one confirmed address verify only one account', async () => {
      const address = `${unique('one')}@iitd.ac.in`
      const first = (await signUp({ institutionalEmail: address })).session!
      await t.gql(VERIFY_INST, { c: await codeFrom(address) }, first.accessToken)
      const second = (await signUp()).session!
      const res = await t.gql<Ok<'setInstitutionalEmail'>>(SET_INST, { e: address }, second.accessToken)
      expect(res.data!.setInstitutionalEmail.userErrors[0]).toMatchObject({ code: 'CONFLICT', field: ['input', 'email'] })
    })

    it('locks a code after 5 wrong tries, and a new code starts over', async () => {
      const address = `${unique('lock')}@iisc.ac.in`
      const s = (await signUp({ institutionalEmail: address })).session!
      const code = await codeFrom(address)
      const wrongCode = code === '123456' ? '654321' : '123456'
      for (let i = 0; i < 5; i++) await t.gql(VERIFY_INST, { c: wrongCode }, s.accessToken)
      const locked = await t.gql<Ok<'verifyInstitutionalEmail'>>(VERIFY_INST, { c: code }, s.accessToken)
      expect(locked.data!.verifyInstitutionalEmail.userErrors[0]!.message).toMatch(/Too many wrong codes/)
      expect((await t.gql<Ok<'resendInstitutionalEmailCode'>>(RESEND, {}, s.accessToken)).data!.resendInstitutionalEmailCode.ok).toBe(true)
      const fresh = await codeFrom(address)
      expect((await t.gql<Ok<'verifyInstitutionalEmail'>>(VERIFY_INST, { c: fresh }, s.accessToken)).data!.verifyInstitutionalEmail.ok).toBe(true)
    })

    it('expires codes after 15 minutes', async () => {
      const address = `${unique('late')}@iitk.ac.in`
      const s = (await signUp({ institutionalEmail: address })).session!
      const code = await codeFrom(address)
      await t.app.get(PrismaService).institutionalEmail.updateMany({ where: { email: address }, data: { codeExpiresAt: new Date(Date.now() - 1000) } })
      const res = await t.gql<Ok<'verifyInstitutionalEmail'>>(VERIFY_INST, { c: code }, s.accessToken)
      expect(res.data!.verifyInstitutionalEmail.userErrors[0]!.message).toMatch(/expired/)
    })

    it('sends at most 3 codes an hour', async () => {
      const address = `${unique('many')}@nitk.ac.in`
      const s = (await signUp({ institutionalEmail: address })).session!
      await t.gql(RESEND, {}, s.accessToken)
      await t.gql(RESEND, {}, s.accessToken)
      const res = await t.gql<Ok<'resendInstitutionalEmailCode'>>(RESEND, {}, s.accessToken)
      expect(res.data!.resendInstitutionalEmailCode.userErrors[0]!.code).toBe('RATE_LIMITED')
    })

    it('requires a session', async () => {
      expect((await t.gql(SET_INST, { e: 'a@iitb.ac.in' })).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('study publisher', () => {
    const RESET_REQ = 'mutation ($e: String!) { requestPasswordReset(input: { email: $e }) { ok userErrors { code } } }'
    const RESET = 'mutation ($t: String!, $p: String!) { resetPassword(input: { token: $t, password: $p }) { ok userErrors { code } } }'
    const REFRESH = 'mutation ($input: RefreshSessionInput!) { refreshSession(input: $input) { session { accessToken } } }'
    const tokenHash = (token: string) => Uint8Array.from(createHash('sha256').update(token).digest())

    it('cannot gain a password or a session by reset, email link, Google or a planted token', async () => {
      const db = t.app.get(PrismaService)
      await db.user.create({
        data: {
          id: STUDY_PUBLISHER_ID,
          email: STUDY_PUBLISHER_EMAIL,
          handle: 'learnvianotes',
          displayName: 'LearnViaNotes',
          emailVerifiedAt: new Date(),
        },
      })
      try {
        const form = { email: ` ${STUDY_PUBLISHER_EMAIL.toUpperCase()} `, password: 'correct horse battery staple', displayName: 'Attacker', dateOfBirth: '2001-03-09', acceptedTermsVersion: terms }
        const signUp = await t.gql<Payload<'signUp'>>(SIGN_UP, { input: form })
        expect(signUp.data!.signUp).toMatchObject({ session: null, emailLinkPending: false, userErrors: [{ code: 'CONFLICT', field: ['input', 'email'] }] })
        expect(await db.user.findUniqueOrThrow({ where: { id: STUDY_PUBLISHER_ID }, select: { passwordHash: true } })).toMatchObject({ passwordHash: null })
        expect(await db.emailToken.count({ where: { userId: STUDY_PUBLISHER_ID } })).toBe(0)

        const reset = await t.gql<{ requestPasswordReset: { ok: boolean; userErrors: { code: string }[] } }>(RESET_REQ, { e: STUDY_PUBLISHER_EMAIL })
        expect(reset.data!.requestPasswordReset).toEqual({ ok: true, userErrors: [] })
        expect(await db.emailToken.count({ where: { userId: STUDY_PUBLISHER_ID } })).toBe(0)
        expect(await mail.countTo(STUDY_PUBLISHER_EMAIL)).toBe(0)

        const signIn = await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email: STUDY_PUBLISHER_EMAIL, password: form.password } })
        expect(signIn.data!.signIn.session).toBeNull()
        expect(signIn.data!.signIn.userErrors[0]!.code).toBe('VALIDATION')

        const resetToken = 'planted-reset-token'
        await db.emailToken.create({
          data: { id: newId(), userId: STUDY_PUBLISHER_ID, purpose: 'RESET_PASSWORD', tokenHash: tokenHash(resetToken), expiresAt: new Date(Date.now() + 3_600_000) },
        })
        const resetDone = await t.gql<{ resetPassword: { ok: boolean; userErrors: { code: string }[] } }>(RESET, { t: resetToken, p: form.password })
        expect(resetDone.data!.resetPassword).toMatchObject({ ok: false, userErrors: [{ code: 'VALIDATION' }] })
        expect(await db.user.findUniqueOrThrow({ where: { id: STUDY_PUBLISHER_ID }, select: { passwordHash: true, emailVerifiedAt: true } })).toMatchObject({ passwordHash: null })

        const linkToken = 'planted-link-token'
        await db.emailToken.create({
          data: { id: newId(), userId: STUDY_PUBLISHER_ID, purpose: 'LINK_EMAIL', tokenHash: tokenHash(linkToken), passwordHash: 'not-a-real-hash', expiresAt: new Date(Date.now() + 3_600_000) },
        })
        const linked = await t.gql<{ verifyEmail: { ok: boolean; userErrors: { code: string }[] } }>(VERIFY, { t: linkToken })
        expect(linked.data!.verifyEmail).toMatchObject({ ok: false, userErrors: [{ code: 'VALIDATION' }] })
        expect(await db.user.findUniqueOrThrow({ where: { id: STUDY_PUBLISHER_ID }, select: { passwordHash: true } })).toMatchObject({ passwordHash: null })

        const google = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:publisher-uid:${STUDY_PUBLISHER_EMAIL}:LearnViaNotes` })
        expect(google.data?.signInWithGoogle?.session ?? null).toBeNull()
        expect(google.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
        expect(await db.oAuthAccount.count({ where: { userId: STUDY_PUBLISHER_ID } })).toBe(0)
        expect(await db.session.count({ where: { userId: STUDY_PUBLISHER_ID } })).toBe(0)

        const donor = await t.gql<Payload<'signUp'>>(SIGN_UP, { input: { ...form, email: `${unique('donor')}@example.com` } })
        const donorId = donor.data!.signUp.session!.user.id as string
        const donorHash = (await db.user.findUniqueOrThrow({ where: { id: donorId }, select: { passwordHash: true } })).passwordHash
        await db.user.update({ where: { id: STUDY_PUBLISHER_ID }, data: { passwordHash: donorHash } })
        const withPassword = await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email: STUDY_PUBLISHER_EMAIL, password: form.password } })
        expect(withPassword.data!.signIn.session).toBeNull()
        expect(withPassword.data!.signIn.userErrors[0]!.code).toBe('VALIDATION')
        expect((await db.user.findUniqueOrThrow({ where: { id: STUDY_PUBLISHER_ID }, select: { passwordHash: true } })).passwordHash).toBe(donorHash)

        const refreshToken = 'planted-refresh-token'
        const sessionId = newId()
        await db.session.create({
          data: { id: sessionId, userId: STUDY_PUBLISHER_ID, familyId: newId(), refreshTokenHash: tokenHash(refreshToken), expiresAt: new Date(Date.now() + 86_400_000) },
        })
        const refreshed = await t.gql(REFRESH, { input: { refreshToken } })
        expect(refreshed.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
        expect(await db.session.findUniqueOrThrow({ where: { id: sessionId } })).toMatchObject({ revokedAt: null, replacedById: null })
        expect(await db.session.count({ where: { userId: STUDY_PUBLISHER_ID } })).toBe(1)
      } finally {
        await db.user.delete({ where: { id: STUDY_PUBLISHER_ID } })
      }
    })
  })
})

describe('Google sign-in when Firebase is not configured', () => {
  let app: TestApp

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(() => app.close())

  it('turns itself off and still reports the admin switch separately from the missing project', async () => {
    expect((await app.gql('{ signInOptions { emailPassword google } }')).data).toEqual({ signInOptions: { emailPassword: true, google: false } })
    const refused = await app.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${unique('uid')}:person@gmail.com` })
    expect(refused.data!.signInWithGoogle.session).toBeNull()
    expect(refused.data!.signInWithGoogle.userErrors[0]).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/not available/) })

    const admin = await seedUser(app.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    const settings = await app.gql<{ authSettings: { googleConfigured: boolean; googleEnabled: boolean } }>(
      '{ authSettings { googleConfigured googleEnabled } }',
      {},
      tokenFor(app.config, admin.id, undefined, ['PLATFORM_ADMIN']),
    )
    expect(settings.data!.authSettings).toEqual({ googleConfigured: false, googleEnabled: true })
    expect((await app.gql<{ signInOptions: { google: boolean } }>('{ signInOptions { google } }')).data!.signInOptions.google).toBe(false)
  })
})

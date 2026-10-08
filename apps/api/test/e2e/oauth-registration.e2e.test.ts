import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Mailbox } from '@lvn-backend/testing'
import request from 'supertest'
import { createTestApp, infra, type TestApp } from '../support/app'
import { OAuthStub } from '../support/oauth-stub'

/** Provider sign-in, account linking, registration details and the institutional email (ADR-0007, ADR-0017). */

const CLIENT = { id: 'lvn-test-client', secret: 'lvn-test-secret' }
const REDIRECT = 'http://localhost:3000/oauth/callback'
const VERIFIER = 'v'.repeat(43)

const GOOGLE = `mutation ($t: String!) { signInWithGoogle(input: { idToken: $t }) {
  session { accessToken user { id email emailVerified registrationComplete displayName } } userErrors { field message code } } }`
const EXCHANGE = `mutation ($input: OAuthExchangeInput!) { oauthExchange(input: $input) {
  session { accessToken user { id email displayName emailVerified registrationComplete } } userErrors { field message code } } }`
const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } userErrors { field message code } } }`
const SIGN_IN = `mutation ($input: SignInInput!) { signIn(input: $input) { session { accessToken } userErrors { code } } }`
const COMPLETE = `mutation ($input: CompleteRegistrationInput!) { completeRegistration(input: $input) { ok userErrors { field message code } } }`
const VIEWER = `{ viewer { id verified verificationMethod registrationComplete restrictedMinor institutionalEmail institutionalEmailStatus institution { name verified } } }`
const SET_INST = `mutation ($e: String!) { setInstitutionalEmail(input: { email: $e }) { ok userErrors { field message code } } }`
const VERIFY_INST = `mutation ($c: String!) { verifyInstitutionalEmail(input: { code: $c }) { ok userErrors { field message code } } }`
const RESEND = `mutation { resendInstitutionalEmailCode { ok userErrors { code message } } }`

let seq = 0
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${seq++}`
const terms = '2026-10-08'

type Payload<K extends string> = Record<K, { session: { accessToken: string; user: Record<string, unknown> } | null; userErrors: { field: string[] | null; message: string; code: string }[] }>
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

    it('links to an existing account by verified email and keeps its verified password', async () => {
      const email = `${unique('link')}@example.com`
      const password = 'my own long password'
      const signUp = await request(t.app.getHttpServer()).post('/graphql').send({
        query: SIGN_UP,
        variables: { input: { email, password, displayName: 'Ravi', dateOfBirth: '2002-01-01', acceptedTermsVersion: terms } },
      })
      const userId = signUp.body.data.signUp.session.user.id
      await t.app.get(PrismaService).user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
      const g = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${unique('uid')}:${email}` })
      expect(g.data!.signInWithGoogle.session!.user.id).toBe(userId)
      expect((await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email, password } })).data!.signIn.session).not.toBeNull()
    })

    it('defeats account pre-hijacking: an unverified password on the email is dropped when Google proves ownership', async () => {
      const email = `${unique('victim')}@example.com`
      const attacker = await t.gql<Payload<'signUp'>>(SIGN_UP, {
        input: { email, password: 'attacker chosen password', displayName: 'Not the owner', dateOfBirth: '2000-01-01', acceptedTermsVersion: terms },
      })
      const attackerToken = attacker.data!.signUp.session!.accessToken
      const g = await t.gql<Payload<'signInWithGoogle'>>(GOOGLE, { t: `google:${unique('uid')}:${email}` })
      expect(g.data!.signInWithGoogle.session!.user.id).toBe(attacker.data!.signUp.session!.user.id)
      expect((await t.gql<Payload<'signIn'>>(SIGN_IN, { input: { email, password: 'attacker chosen password' } })).data!.signIn.session).toBeNull()
      expect((await t.gql(VIEWER, {}, attackerToken)).data).toEqual({ viewer: null })
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
})

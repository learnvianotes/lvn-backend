import { PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { Mailbox } from '@lvn-backend/testing'
import { createTestApp, infra, type TestApp } from '../support/app'

/** ADR-0115 and ADR-0116: sign in with an emailed code, passkey sign-in refuses what it cannot verify, password pause. */

const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id email } } userErrors { code } } }`
const SIGN_IN = `mutation ($input: SignInInput!) { signIn(input: $input) { session { accessToken } userErrors { code message } } }`
const REQUEST = `mutation ($input: RequestSignInCodeInput!) { requestSignInCode(input: $input) { ok userErrors { code } } }`
const WITH_CODE = `mutation ($input: SignInWithCodeInput!) { signInWithCode(input: $input) { session { accessToken user { id emailVerified } } userErrors { code message } } }`
const OPTIONS = '{ signInOptions { emailPassword google github linkedin emailCode passkey } }'
const START_PASSKEY = 'mutation { startPasskeySignIn { attemptId optionsJson } }'
const FINISH_PASSKEY = `mutation ($input: FinishPasskeySignInInput!) { finishPasskeySignIn(input: $input) { session { accessToken } userErrors { code message } } }`
const START_REG = 'mutation { startPasskeyRegistration { optionsJson } }'
const MY_PASSKEYS = '{ myPasskeys { id } }'

let seq = 0
const signUpInput = () => ({ email: `code-${Date.now()}-${seq++}@example.com`, password: 'correct horse battery staple', displayName: 'Code Rao', age: 30, acceptedTermsVersion: '2026-11-12' })

describe('sign in without a password', () => {
  let t: TestApp
  let mail: Mailbox

  beforeAll(async () => {
    t = await createTestApp()
    mail = new Mailbox(infra().mail.apiUrl)
  })
  afterAll(() => t.close())

  const codeFrom = async (email: string, previous?: string) => {
    const deadline = Date.now() + 5000
    for (;;) {
      const message = await mail.latestTo(email).catch(() => null)
      const code = message?.text.match(/\b(\d{6})\b/)?.[1]
      if (code && code !== previous) return code
      if (Date.now() > deadline) throw new Error('no code in the mail')
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  it('offers email codes and passkeys, and no longer GitHub or LinkedIn', async () => {
    const res = await t.gql<{ signInOptions: Record<string, boolean> }>(OPTIONS)
    expect(res.data!.signInOptions).toMatchObject({ emailPassword: true, github: false, linkedin: false, emailCode: true, passkey: true })
  })

  it('emails a code and signs in with it once; a wrong code does not', async () => {
    const input = signUpInput()
    const created = await t.gql<{ signUp: { session: { user: { id: string } } } }>(SIGN_UP, { input })
    const userId = created.data!.signUp.session.user.id
    await t.app.get(PrismaService).user.update({ where: { id: userId }, data: { emailVerifiedAt: null } })

    const asked = await t.gql<{ requestSignInCode: { ok: boolean } }>(REQUEST, { input: { email: input.email.toUpperCase() } })
    expect(asked.data!.requestSignInCode.ok).toBe(true)
    const code = await codeFrom(input.email)

    const wrong = await t.gql<{ signInWithCode: { session: null; userErrors: { code: string }[] } }>(WITH_CODE, { input: { email: input.email, code: code === '000000' ? '111111' : '000000' } })
    expect(wrong.data!.signInWithCode.session).toBeNull()
    expect(wrong.data!.signInWithCode.userErrors[0]!.code).toBe('VALIDATION')

    const right = await t.gql<{ signInWithCode: { session: { accessToken: string; user: { id: string; emailVerified: boolean } } } }>(WITH_CODE, { input: { email: input.email, code } })
    expect(right.data!.signInWithCode.session.user).toEqual({ id: userId, emailVerified: true })

    const again = await t.gql<{ signInWithCode: { session: null } }>(WITH_CODE, { input: { email: input.email, code } })
    expect(again.data!.signInWithCode.session).toBeNull()
  })

  it('answers ok for an address with no account and sends nothing', async () => {
    const email = `nobody-${Date.now()}@example.com`
    const asked = await t.gql<{ requestSignInCode: { ok: boolean } }>(REQUEST, { input: { email } })
    expect(asked.data!.requestSignInCode.ok).toBe(true)
    await new Promise((r) => setTimeout(r, 500))
    expect(await mail.latestTo(email).catch(() => null)).toBeNull()
  })

  it('pauses password sign-in after many wrong passwords, while a code still works and lifts the pause', async () => {
    const input = signUpInput()
    await t.gql(SIGN_UP, { input })
    const limiter = t.app.get(RateLimiter)
    // The short per-address window (5 per 15 minutes) would stop this first; clear it between tries, as time passing would.
    for (let i = 0; i < 20; i++) {
      await limiter.reset(`signin:${input.email}`)
      await t.gql(SIGN_IN, { input: { email: input.email, password: `wrong password ${i}` } })
    }
    await limiter.reset(`signin:${input.email}`)
    const paused = await t.gql<{ signIn: { session: null; userErrors: { code: string; message: string }[] } }>(SIGN_IN, { input: { email: input.email, password: input.password } })
    expect(paused.data!.signIn.session).toBeNull()
    expect(paused.data!.signIn.userErrors[0]!.message).toMatch(/paused/)

    await t.gql(REQUEST, { input: { email: input.email } })
    const code = await codeFrom(input.email)
    const viaCode = await t.gql<{ signInWithCode: { session: { accessToken: string } | null } }>(WITH_CODE, { input: { email: input.email, code } })
    expect(viaCode.data!.signInWithCode.session).not.toBeNull()
    await limiter.reset(`signin:${input.email}`)
    const unpaused = await t.gql<{ signIn: { session: { accessToken: string } | null } }>(SIGN_IN, { input: { email: input.email, password: input.password } })
    expect(unpaused.data!.signIn.session).not.toBeNull()
  })

  it('starts a passkey sign-in, refuses an answer it cannot verify, and keeps registration for signed-in people', async () => {
    const started = await t.gql<{ startPasskeySignIn: { attemptId: string; optionsJson: string } }>(START_PASSKEY)
    const options = JSON.parse(started.data!.startPasskeySignIn.optionsJson) as { challenge: string; userVerification: string }
    expect(options.challenge.length).toBeGreaterThan(20)
    expect(options.userVerification).toBe('required')
    const forged = await t.gql<{ finishPasskeySignIn: { session: null; userErrors: { code: string }[] } }>(FINISH_PASSKEY, {
      input: { attemptId: started.data!.startPasskeySignIn.attemptId, responseJson: JSON.stringify({ id: 'AAAA', rawId: 'AAAA', type: 'public-key', response: {}, clientExtensionResults: {} }) },
    })
    expect(forged.data!.finishPasskeySignIn.session).toBeNull()
    expect(forged.data!.finishPasskeySignIn.userErrors[0]!.code).toBe('VALIDATION')

    const anonymous = await t.gql(START_REG)
    expect(anonymous.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED')
    const input = signUpInput()
    const created = await t.gql<{ signUp: { session: { accessToken: string } } }>(SIGN_UP, { input })
    const reg = await t.gql<{ startPasskeyRegistration: { optionsJson: string } }>(START_REG, {}, created.data!.signUp.session.accessToken)
    expect(JSON.parse(reg.data!.startPasskeyRegistration.optionsJson)).toMatchObject({ rp: { name: 'LearnViaNotes' }, authenticatorSelection: { residentKey: 'required' } })
    const none = await t.gql<{ myPasskeys: unknown[] }>(MY_PASSKEYS, {}, created.data!.signUp.session.accessToken)
    expect(none.data!.myPasskeys).toEqual([])
  })
})

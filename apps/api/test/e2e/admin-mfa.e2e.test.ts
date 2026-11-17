import { PrismaService } from '@lvn-backend/prisma-base'
import { Mailbox } from '@lvn-backend/testing'
import { createTestApp, infra, type TestApp } from '../support/app'

/**
 * Admin and staff email OTP, with the flag on. Other e2e files leave ADMIN_MFA_REQUIRED unset, so a normal
 * account and a token minted for a test stay as they were. This file reads the code from Mailpit.
 */

const SIGN_UP = `mutation ($input: SignUpInput!) {
  signUp(input: $input) { session { accessToken user { id email } } mfaRequired userErrors { code } }
}`
const SIGN_IN = `mutation ($input: SignInInput!) {
  signIn(input: $input) { session { accessToken user { id } } mfaRequired mfaFactors userErrors { code } }
}`
const START = `mutation ($factor: MfaFactorType!) {
  startMfaChallenge(factor: $factor) { challengeId expiresAt userErrors { code message } }
}`
const VERIFY = `mutation ($id: UUID!, $code: String!) {
  verifyMfaChallenge(challengeId: $id, code: $code) { session { accessToken } userErrors { code message } }
}`
const METRICS = '{ adminMetrics { users { total } } }'
const VIEWER = '{ viewer { id } }'

let seq = 0
const signUpInput = (over: Record<string, unknown> = {}) => ({
  email: `admin-mfa-${Date.now()}-${seq++}@example.com`,
  password: 'correct horse battery staple',
  displayName: 'Admin Rao',
  age: 30,
  acceptedTermsVersion: '2026-11-12',
  ...over,
})

describe('admin email OTP', () => {
  let t: TestApp
  let mail: Mailbox

  beforeAll(async () => {
    t = await createTestApp({ ADMIN_MFA_REQUIRED: 'true', FIREBASE_PROJECT_ID: 'demo' })
    mail = new Mailbox(infra().mail.apiUrl)
  })
  afterAll(() => t.close())

  const promote = async (id: string, role: 'PLATFORM_ADMIN' | 'MANAGER' | 'STUDENT' = 'PLATFORM_ADMIN') => {
    await t.app.get(PrismaService).user.update({ where: { id }, data: { globalRole: role } })
  }

  const account = async (role: 'PLATFORM_ADMIN' | 'MANAGER' | 'STUDENT' = 'STUDENT') => {
    const input = signUpInput()
    const created = await t.gql<{ signUp: { session: { accessToken: string; user: { id: string; email: string } } } }>(SIGN_UP, { input })
    const user = created.data!.signUp.session!.user
    if (role !== 'STUDENT') await promote(user.id, role)
    const signed = await t.gql<{ signIn: { session: { accessToken: string } | null; mfaRequired: boolean; mfaFactors: string[]; userErrors: { code: string }[] } }>(SIGN_IN, { input: { email: input.email, password: input.password } })
    return { email: input.email, password: input.password, id: user.id, ...signed.data!.signIn, token: signed.data!.signIn.session!.accessToken }
  }

  const codeFrom = async (email: string, previous?: string) => {
    const deadline = Date.now() + 5000
    for (;;) {
      const message = await mail.latestTo(email)
      expect(message.subject).toBe('Your LVN admin sign-in code')
      const code = message.text.match(/\b(\d{6})\b/)?.[1]
      if (code && code !== previous) return code
      if (Date.now() > deadline) throw new Error('no new code in the mail')
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  const challenge = async (token: string) => {
    const started = await t.gql<{ startMfaChallenge: { challengeId: string | null; userErrors: { code: string }[] } }>(START, { factor: 'EMAIL_OTP' }, token)
    return started.data!.startMfaChallenge
  }

  it('blocks an admin until the emailed code, then lets the new token through', async () => {
    const admin = await account('PLATFORM_ADMIN')
    expect(admin.mfaRequired).toBe(true)
    expect(admin.mfaFactors).toEqual(['EMAIL_OTP'])
    const blocked = await t.gql(METRICS, {}, admin.token)
    expect(blocked.errors?.[0]?.extensions.code).toBe('ADMIN_MFA_REQUIRED')

    const started = await challenge(admin.token)
    expect(started.userErrors).toEqual([])
    const code = await codeFrom(admin.email)
    const verified = await t.gql<{ verifyMfaChallenge: { session: { accessToken: string } | null; userErrors: { code: string }[] } }>(VERIFY, { id: started.challengeId, code }, admin.token)
    expect(verified.data!.verifyMfaChallenge.userErrors).toEqual([])
    const token = verified.data!.verifyMfaChallenge.session!.accessToken
    expect((await t.gql<{ adminMetrics: { users: { total: number } } }>(METRICS, {}, token)).data!.adminMetrics.users.total).toBeGreaterThan(0)

    const again = await t.gql<{ verifyMfaChallenge: { userErrors: { code: string }[] } }>(VERIFY, { id: started.challengeId, code }, token)
    expect(again.data!.verifyMfaChallenge.userErrors[0]?.code).toBe('VALIDATION')
  })

  it('locks the code after five wrong attempts, and an expired code fails', async () => {
    const admin = await account('PLATFORM_ADMIN')
    const started = await challenge(admin.token)
    const code = await codeFrom(admin.email)
    expect((await mail.latestTo(admin.email)).text).toMatch(/10 minutes/)
    for (let i = 0; i < 4; i++) {
      const wrong = await t.gql<{ verifyMfaChallenge: { userErrors: { message: string }[] } }>(VERIFY, { id: started.challengeId, code: '000000' }, admin.token)
      expect(wrong.data!.verifyMfaChallenge.userErrors[0]?.message).toMatch(/incorrect/)
    }
    const locked = await t.gql<{ verifyMfaChallenge: { userErrors: { message: string }[] } }>(VERIFY, { id: started.challengeId, code: '000000' }, admin.token)
    expect(locked.data!.verifyMfaChallenge.userErrors[0]?.message).toMatch(/new code/)
    const after = await t.gql<{ verifyMfaChallenge: { userErrors: { message: string }[] } }>(VERIFY, { id: started.challengeId, code }, admin.token)
    expect(after.data!.verifyMfaChallenge.userErrors[0]?.message).toMatch(/new code/)

    const second = await challenge(admin.token)
    if (!second.challengeId) throw new Error('no challenge')
    await t.app.get(PrismaService).$executeRawUnsafe(`UPDATE users."mfa_challenges" SET "expiresAt" = NOW() - interval '1 minute' WHERE id = $1::uuid`, second.challengeId)
    const expired = await t.gql<{ verifyMfaChallenge: { userErrors: { message: string }[] } }>(VERIFY, { id: second.challengeId, code: await codeFrom(admin.email, code) }, admin.token)
    expect(expired.data!.verifyMfaChallenge.userErrors[0]?.message).toMatch(/expired/)
  })

  it('does not affect a normal account', async () => {
    const student = await account('STUDENT')
    expect(student.mfaRequired).toBe(false)
    expect(student.mfaFactors).toEqual([])
    expect((await t.gql(VIEWER, {}, student.token)).data).toEqual({ viewer: { id: student.id } })
    const metrics = await t.gql(METRICS, {}, student.token)
    expect(metrics.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    const started = await challenge(student.token)
    expect(started.userErrors[0]?.code).toBe('VALIDATION')
  })

  it('rate-limits sending codes', async () => {
    const admin = await account('MANAGER')
    expect(admin.mfaRequired).toBe(true)
    for (let i = 0; i < 5; i++) expect((await challenge(admin.token)).userErrors).toEqual([])
    const limited = await challenge(admin.token)
    expect(limited.userErrors[0]?.code).toBe('RATE_LIMITED')
  })

  it('records the admin mutation and lets another admin clear a lockout', async () => {
    const owner = await account('PLATFORM_ADMIN')
    const started = await challenge(owner.token)
    const verified = await t.gql<{ verifyMfaChallenge: { session: { accessToken: string } } }>(VERIFY, { id: started.challengeId, code: await codeFrom(owner.email) }, owner.token)
    const token = verified.data!.verifyMfaChallenge.session.accessToken
    const saved = await t.gql<{ setGoogleSignInEnabled: { userErrors: { code: string }[] } }>(
      'mutation { setGoogleSignInEnabled(input: { enabled: true }) { settings { googleEnabled } userErrors { code } } }',
      {},
      token,
    )
    expect(saved.data!.setGoogleSignInEnabled.userErrors).toEqual([])
    const activity = await t.gql<{ adminActivity: { entries: { action: string; actorId: string; actorEmail: string; ip: string }[] } }>(
      '{ adminActivity(filter: { action: "admin.mutation.setGoogleSignInEnabled" }) { entries { action actorId actorEmail ip targetType createdAt } } }',
      {},
      token,
    )
    expect(activity.data!.adminActivity.entries[0]).toMatchObject({ action: 'admin.mutation.setGoogleSignInEnabled', actorId: owner.id, actorEmail: owner.email })
    expect(activity.data!.adminActivity.entries[0]!.ip).toBeTruthy()
    const summary = await t.gql<{ adminActivitySummary: { total: number; byAction: { action: string; count: number }[] } }>('{ adminActivitySummary { total byAction { action count } byDay { day count } } }', {}, token)
    expect(summary.data!.adminActivitySummary.byAction.some((row) => row.action === 'admin.mutation.setGoogleSignInEnabled' && row.count >= 1)).toBe(true)

    const lockedOut = await account('PLATFORM_ADMIN')
    const pending = await challenge(lockedOut.token)
    for (let i = 0; i < 5; i++) await t.gql(VERIFY, { id: pending.challengeId, code: '111111' }, lockedOut.token)
    const recovered = await t.gql<{ adminRecoverMfa: { ok: boolean; userErrors: { code: string }[] } }>(
      'mutation ($id: UUID!) { adminRecoverMfa(input: { userId: $id, reason: "Mailbox is down" }) { ok userErrors { code } } }',
      { id: lockedOut.id },
      token,
    )
    expect(recovered.data!.adminRecoverMfa).toEqual({ ok: true, userErrors: [] })
    const back = await t.gql<{ signIn: { mfaRequired: boolean; session: { accessToken: string } } }>(SIGN_IN, { input: { email: lockedOut.email, password: lockedOut.password } })
    expect(back.data!.signIn.mfaRequired).toBe(false)
    expect((await t.gql(METRICS, {}, back.data!.signIn.session.accessToken)).errors).toBeUndefined()

    const self = await t.gql<{ adminRecoverMfa: { userErrors: { code: string }[] } }>('mutation ($id: UUID!) { adminRecoverMfa(input: { userId: $id, reason: "Myself" }) { ok userErrors { code } } }', { id: owner.id }, token)
    expect(self.data!.adminRecoverMfa.userErrors[0]?.code).toBe('VALIDATION')
  })

  it('asks a Google admin for a code too', async () => {
    const email = `google-admin-${Date.now()}@example.com`
    const uid = `uid-mfa-${seq}`
    const first = await t.gql<{ signInWithGoogle: { session: { user: { id: string } }; mfaRequired: boolean } }>(
      'mutation ($token: String!) { signInWithGoogle(input: { idToken: $token }) { session { accessToken user { id } } mfaRequired userErrors { code } } }',
      { token: `google:${uid}:${email}:Ada Admin` },
    )
    const id = first.data!.signInWithGoogle.session.user.id
    await promote(id, 'PLATFORM_ADMIN')
    const again = await t.gql<{ signInWithGoogle: { mfaRequired: boolean; mfaFactors: string[] } }>(
      'mutation ($token: String!) { signInWithGoogle(input: { idToken: $token }) { mfaRequired mfaFactors session { accessToken } userErrors { code } } }',
      { token: `google:${uid}:${email}:Ada Admin` },
    )
    expect(again.data!.signInWithGoogle.mfaRequired).toBe(true)
    expect(again.data!.signInWithGoogle.mfaFactors).toEqual(['EMAIL_OTP'])
  })
})

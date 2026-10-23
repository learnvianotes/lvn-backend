import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Mailbox } from '@lvn-backend/testing'
import request from 'supertest'
import { createTestApp, infra, type TestApp } from '../support/app'
import { OAuthStub } from '../support/oauth-stub'
import { seedUser, tokenFor } from '../support/seed'

/** Beta access allowlist (contracts 0.71.0): the admin switch, every sign-in path, guards, seed and role sync. */

const CLIENT = { id: 'lvn-test-client', secret: 'lvn-test-secret' }
const REDIRECT = 'http://localhost:3000/oauth/callback'
const VERIFIER = 'v'.repeat(43)
const TERMS = '2026-10-08'
const INVITE = 'LearnViaNotes beta is invite-only. Ask an admin to add your email.'

const POLICY = '{ accessPolicy { inviteOnly } }'
const LIST = `query ($search: String) { adminAccessAllowlist(search: $search) { id email role note hasAccount addedByEmail } }`
const ADD = `mutation ($input: AddAccessAllowlistEntryInput!) { addAccessAllowlistEntry(input: $input) {
  entry { id email role note hasAccount addedByEmail } userErrors { code field message } } }`
const UPDATE = `mutation ($input: UpdateAccessAllowlistEntryInput!) { updateAccessAllowlistEntry(input: $input) {
  entry { id email role note hasAccount } userErrors { code field message } } }`
const REMOVE = `mutation ($id: UUID!) { removeAccessAllowlistEntry(id: $id) { ok userErrors { code message } } }`
const SET = `mutation ($input: UpdateAdminSettingInput!) { updateAdminSetting(input: $input) { setting { key value } userErrors { code field message } } }`
const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) {
  emailLinkPending session { accessToken refreshToken user { id email globalRole } } userErrors { field message code } } }`
const SIGN_IN = `mutation ($input: SignInInput!) { signIn(input: $input) {
  session { accessToken refreshToken user { id globalRole } } userErrors { field message code } } }`
const REFRESH = `mutation ($input: RefreshSessionInput!) { refreshSession(input: $input) { session { accessToken } userErrors { code } } }`
const GOOGLE = `mutation ($t: String!) { signInWithGoogle(input: { idToken: $t }) {
  session { accessToken user { id email globalRole } } userErrors { field message code } } }`
const EXCHANGE = `mutation ($input: OAuthExchangeInput!) { oauthExchange(input: $input) {
  session { accessToken user { id email globalRole } } userErrors { field message code } } }`
const RESET_REQ = 'mutation ($e: String!) { requestPasswordReset(input: { email: $e }) { ok userErrors { code message } } }'
const RESET = 'mutation ($t: String!, $p: String!) { resetPassword(input: { token: $t, password: $p }) { ok userErrors { code field message } } }'
const VERIFY = 'mutation ($t: String!) { verifyEmail(input: { token: $t }) { ok userErrors { code field message } } }'
const VIEWER = '{ viewer { id globalRole } }'

const SEED_SQL = readFileSync(path.resolve(__dirname, '../../../../prisma/migrations/20261109120000_access_allowlist/migration.sql'), 'utf8')
const SEED_INSERT = SEED_SQL.slice(SEED_SQL.indexOf('INSERT INTO'))

let seq = 0
const emailOf = (prefix: string) => `${prefix}${Date.now().toString(36)}${seq++}@example.com`
const yearsAgo = (years: number) => {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString().slice(0, 10)
}
const signUpInput = (email: string, over: Record<string, unknown> = {}) => ({
  email,
  password: 'correct horse battery staple',
  displayName: 'Asha Rao',
  dateOfBirth: '2004-05-01',
  acceptedTermsVersion: TERMS,
  ...over,
})

type Err = { field: string[] | null; message: string; code: string }
type Entry = { id: string; email: string; role: string; note: string | null; hasAccount: boolean; addedByEmail: string | null }

describe('beta access allowlist', () => {
  let t: TestApp
  let stub: OAuthStub
  let mail: Mailbox
  let admin: { id: string; token: string; email: string }
  let db: PrismaService

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
      OAUTH_REDIRECT_URIS: REDIRECT,
    })
    mail = new Mailbox(infra().mail.apiUrl)
    db = t.app.get(PrismaService)
    const row = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true, email: emailOf('admin') })
    admin = { id: row.id, token: tokenFor(t.config, row.id, undefined, ['PLATFORM_ADMIN']), email: row.email }
  })

  afterAll(async () => {
    await t.close()
    stub.stop()
  })

  const enable = (on: boolean) =>
    t.gql<{ updateAdminSetting: { setting: { value: string } | null; userErrors: Err[] } }>(SET, { input: { key: 'access_allowlist_enabled', value: on ? 'true' : 'false' } }, admin.token)

  const allow = (email: string, role: 'STUDENT' | 'TEACHER' | 'PLATFORM_ADMIN' = 'STUDENT', note?: string) =>
    t.gql<{ addAccessAllowlistEntry: { entry: Entry | null; userErrors: Err[] } }>(ADD, { input: { email, role, note } }, admin.token)

  const http = () => request(t.app.getHttpServer())

  it('is off by default, public, and the toggle is audited', async () => {
    expect((await t.gql<{ accessPolicy: { inviteOnly: boolean } }>(POLICY)).data).toEqual({ accessPolicy: { inviteOnly: false } })
    const turnedOn = await enable(true)
    expect(turnedOn.data!.updateAdminSetting.userErrors).toEqual([])
    expect(turnedOn.data!.updateAdminSetting.setting).toMatchObject({ key: 'access_allowlist_enabled', value: 'true' })
    expect((await t.gql<{ accessPolicy: { inviteOnly: boolean } }>(POLICY)).data!.accessPolicy.inviteOnly).toBe(true)
    expect(await db.auditLog.findFirst({ where: { action: 'settings.updated', actorId: admin.id, metadata: { path: ['key'], equals: 'access_allowlist_enabled' } } })).toMatchObject({
      metadata: { key: 'access_allowlist_enabled', value: 'true', enabled: true },
    })
    await enable(false)
  })

  it('lets everyone sign up and sign in while the switch is off, and applies a listed role', async () => {
    await enable(false)
    const open = emailOf('open')
    const created = await t.gql<{ signUp: { session: { user: { globalRole: string } } | null; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput(open) })
    expect(created.data!.signUp.userErrors).toEqual([])
    expect(created.data!.signUp.session!.user.globalRole).toBe('STUDENT')
    const signedIn = await t.gql<{ signIn: { session: { user: { id: string } } | null; userErrors: Err[] } }>(SIGN_IN, { input: { email: open.toUpperCase(), password: 'correct horse battery staple' } })
    expect(signedIn.data!.signIn.session).not.toBeNull()

    const teacherEmail = emailOf('teacher')
    expect((await allow(teacherEmail, 'TEACHER')).data!.addAccessAllowlistEntry.userErrors).toEqual([])
    const asTeacher = await t.gql<{ signUp: { session: { user: { globalRole: string } } | null; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput(teacherEmail) })
    expect(asTeacher.data!.signUp.userErrors).toEqual([])
    expect(asTeacher.data!.signUp.session!.user.globalRole).toBe('TEACHER')
  })

  it('blocks email sign-up and sign-in when the switch is on, until the email is listed', async () => {
    await enable(true)
    const blocked = emailOf('blocked')
    const signUp = await t.gql<{ signUp: { session: null; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput(blocked) })
    expect(signUp.data!.signUp.session).toBeNull()
    expect(signUp.data!.signUp.userErrors).toEqual([{ code: 'FORBIDDEN', field: ['email'], message: INVITE }])
    expect(await db.user.findFirst({ where: { email: blocked } })).toBeNull()

    const signIn = await t.gql<{ signIn: { session: null; userErrors: Err[] } }>(SIGN_IN, { input: { email: blocked, password: 'correct horse battery staple' } })
    expect(signIn.data!.signIn.userErrors).toEqual([{ code: 'FORBIDDEN', field: ['email'], message: INVITE }])

    const added = await allow(`  ${blocked.toUpperCase()}  `, 'STUDENT', 'cohort 1')
    expect(added.data!.addAccessAllowlistEntry.userErrors).toEqual([])
    expect(added.data!.addAccessAllowlistEntry.entry).toMatchObject({ email: blocked, role: 'STUDENT', note: 'cohort 1', hasAccount: false, addedByEmail: admin.email })
    const again = await allow(blocked, 'STUDENT')
    expect(again.data!.addAccessAllowlistEntry.userErrors[0]).toMatchObject({ code: 'CONFLICT', field: ['input', 'email'] })
    const bad = await allow('not-an-email', 'STUDENT')
    expect(bad.data!.addAccessAllowlistEntry.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'email'] })

    const created = await t.gql<{ signUp: { session: { accessToken: string; user: { id: string; globalRole: string } } | null; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput(blocked) })
    expect(created.data!.signUp.userErrors).toEqual([])
    expect(created.data!.signUp.session!.user.globalRole).toBe('STUDENT')
    const wrong = await t.gql<{ signIn: { userErrors: Err[] } }>(SIGN_IN, { input: { email: blocked, password: 'wrong password!!' } })
    expect(wrong.data!.signIn.userErrors[0]).toMatchObject({ code: 'VALIDATION', message: 'Email or password is incorrect.' })
    const ok = await t.gql<{ signIn: { session: { user: { id: string } } | null; userErrors: Err[] } }>(SIGN_IN, { input: { email: blocked, password: 'correct horse battery staple' } })
    expect(ok.data!.signIn.userErrors).toEqual([])
    expect(ok.data!.signIn.session!.user.id).toBe(created.data!.signUp.session!.user.id)

    // Adults-only still wins over the invite list.
    const child = emailOf('child')
    await allow(child, 'STUDENT')
    const young = await t.gql<{ signUp: { session: null; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput(child, { dateOfBirth: yearsAgo(17) }) })
    expect(young.data!.signUp.userErrors[0]!.code).toBe('UNDER_MINIMUM_AGE')
    expect(await db.user.findFirst({ where: { email: child } })).toBeNull()
  })

  it('refuses a refresh after the email is removed, and revokes the session at once', async () => {
    await enable(true)
    const email = emailOf('session')
    await allow(email, 'STUDENT')
    const res = await http().post('/graphql').set('x-lvn-client', 'mobile').send({ query: SIGN_UP, variables: { input: signUpInput(email) } })
    const session = res.body.data.signUp.session
    expect(session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const entry = (await t.gql<{ adminAccessAllowlist: Entry[] }>(LIST, { search: email }, admin.token)).data!.adminAccessAllowlist[0]!
    const removed = await t.gql<{ removeAccessAllowlistEntry: { ok: boolean; userErrors: Err[] } }>(REMOVE, { id: entry.id }, admin.token)
    expect(removed.data!.removeAccessAllowlistEntry).toEqual({ ok: true, userErrors: [] })
    expect(await db.auditLog.findFirst({ where: { action: 'access_allowlist.removed', targetId: entry.id } })).toMatchObject({ metadata: { email } })
    expect((await t.gql(VIEWER, {}, session.accessToken)).data).toEqual({ viewer: null })
    const refresh = await http().post('/graphql').set('x-lvn-client', 'mobile').send({ query: REFRESH, variables: { input: { refreshToken: session.refreshToken } } })
    expect(refresh.body.errors[0].extensions.code).toBe('UNAUTHENTICATED')
  })

  it('does not reveal the list through password reset, and blocks the emailed link', async () => {
    await enable(true)
    const email = emailOf('reset')
    await allow(email, 'STUDENT')
    await t.gql(SIGN_UP, { input: signUpInput(email) })
    await t.gql(RESET_REQ, { e: email })
    const message = await mail.latestTo(email)
    const token = new URL(/href="([^"]+\/reset\?token=[^"]+)"/.exec(message.html)![1]!.replace(/&amp;/g, '&')).searchParams.get('token')!
    const entry = (await t.gql<{ adminAccessAllowlist: Entry[] }>(LIST, { search: email }, admin.token)).data!.adminAccessAllowlist[0]!
    await t.gql(REMOVE, { id: entry.id }, admin.token)

    const unknown = emailOf('unknown')
    const listedGone = await t.gql<{ requestPasswordReset: { ok: boolean; userErrors: Err[] } }>(RESET_REQ, { e: email })
    const notListed = await t.gql<{ requestPasswordReset: { ok: boolean; userErrors: Err[] } }>(RESET_REQ, { e: unknown })
    expect(listedGone.data!.requestPasswordReset).toEqual({ ok: true, userErrors: [] })
    expect(notListed.data!.requestPasswordReset).toEqual(listedGone.data!.requestPasswordReset)
    expect(await mail.countTo(unknown)).toBe(0)

    const reset = await t.gql<{ resetPassword: { ok: boolean; userErrors: Err[] } }>(RESET, { t: token, p: 'a brand new passphrase' })
    expect(reset.data!.resetPassword.ok).toBe(false)
    expect(reset.data!.resetPassword.userErrors[0]).toMatchObject({ code: 'VALIDATION' })
    expect(reset.data!.resetPassword.userErrors[0]!.message).not.toContain('invite')
    await enable(false)
    const oldPassword = await t.gql<{ signIn: { session: unknown; userErrors: Err[] } }>(SIGN_IN, { input: { email, password: 'correct horse battery staple' } })
    expect(oldPassword.data!.signIn.userErrors).toEqual([])
    expect(oldPassword.data!.signIn.session).not.toBeNull()
  })

  it('blocks the password-link email unless the address is listed', async () => {
    await enable(true)
    const email = emailOf('link')
    await allow(email, 'STUDENT')
    const google = await t.gql<{ signInWithGoogle: { session: { user: { id: string } } | null; userErrors: Err[] } }>(GOOGLE, { t: `google:uid-${email}:${email}:Linker` })
    expect(google.data!.signInWithGoogle.userErrors).toEqual([])
    const entry = (await t.gql<{ adminAccessAllowlist: Entry[] }>(LIST, { search: email }, admin.token)).data!.adminAccessAllowlist[0]!
    await t.gql(REMOVE, { id: entry.id }, admin.token)
    const blocked = await t.gql<{ signUp: { emailLinkPending: boolean; session: null; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput(email) })
    expect(blocked.data!.signUp).toMatchObject({ emailLinkPending: false, session: null, userErrors: [{ code: 'FORBIDDEN', field: ['email'], message: INVITE }] })

    await allow(email, 'STUDENT')
    const pending = await t.gql<{ signUp: { emailLinkPending: boolean; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput(email) })
    expect(pending.data!.signUp).toMatchObject({ emailLinkPending: true, userErrors: [] })
    const linkMail = await mail.latestTo(email)
    const token = new URL(/href="([^"]+\/verify\?token=[^"]+)"/.exec(linkMail.html)![1]!.replace(/&amp;/g, '&')).searchParams.get('token')!
    await t.gql(REMOVE, { id: (await t.gql<{ adminAccessAllowlist: Entry[] }>(LIST, { search: email }, admin.token)).data!.adminAccessAllowlist[0]!.id }, admin.token)
    const verify = await t.gql<{ verifyEmail: { ok: boolean; userErrors: Err[] } }>(VERIFY, { t: token })
    expect(verify.data!.verifyEmail.ok).toBe(false)
    expect(verify.data!.verifyEmail.userErrors[0]).toMatchObject({ code: 'FORBIDDEN', field: ['email'], message: INVITE })
    await allow(email, 'STUDENT')
    expect((await t.gql<{ verifyEmail: { ok: boolean; userErrors: Err[] } }>(VERIFY, { t: token })).data!.verifyEmail.ok).toBe(true)
  })

  it('blocks Google sign-up, sign-in and account linking, and copies the role onto a new account', async () => {
    await enable(true)
    const fresh = emailOf('gnew')
    const denied = await t.gql<{ signInWithGoogle: { session: null; userErrors: Err[] } }>(GOOGLE, { t: `google:uid-${fresh}:${fresh}:New Person` })
    expect(denied.data!.signInWithGoogle.userErrors).toEqual([{ code: 'FORBIDDEN', field: ['email'], message: INVITE }])
    expect(await db.user.findFirst({ where: { email: fresh } })).toBeNull()

    await allow(fresh, 'TEACHER')
    const created = await t.gql<{ signInWithGoogle: { session: { user: { globalRole: string } } | null; userErrors: Err[] } }>(GOOGLE, { t: `google:uid-${fresh}:${fresh.toUpperCase()}:New Person` })
    expect(created.data!.signInWithGoogle.userErrors).toEqual([])
    expect(created.data!.signInWithGoogle.session!.user.globalRole).toBe('TEACHER')

    const existing = emailOf('glink')
    await allow(existing, 'STUDENT')
    const passwordAccount = await t.gql<{ signUp: { session: { user: { id: string } } } }>(SIGN_UP, { input: signUpInput(existing) })
    await db.user.update({ where: { id: passwordAccount.data!.signUp.session.user.id }, data: { emailVerifiedAt: new Date() } })
    const linked = await t.gql<{ signInWithGoogle: { session: { user: { email: string } } | null; userErrors: Err[] } }>(GOOGLE, { t: `google:uid-${existing}:${existing}:Someone` })
    expect(linked.data!.signInWithGoogle.userErrors).toEqual([])
    expect(linked.data!.signInWithGoogle.session!.user.email).toBe(existing)
    const entry = (await t.gql<{ adminAccessAllowlist: Entry[] }>(LIST, { search: existing }, admin.token)).data!.adminAccessAllowlist[0]!
    await t.gql(REMOVE, { id: entry.id }, admin.token)
    const again = await t.gql<{ signInWithGoogle: { session: null; userErrors: Err[] } }>(GOOGLE, { t: `google:uid-${existing}:${existing}:Someone` })
    expect(again.data!.signInWithGoogle.userErrors).toEqual([{ code: 'FORBIDDEN', field: ['email'], message: INVITE }])
  })

  it('blocks GitHub and LinkedIn the same way, including linking', async () => {
    await enable(true)
    const githubEmail = emailOf('gh')
    const code = `code-${githubEmail}`
    stub.issue(code, { user: { id: '4242', name: 'Gh User', emails: [{ email: githubEmail, primary: true, verified: true }] }, codeVerifier: VERIFIER, redirectUri: REDIRECT })
    const denied = await t.gql<{ oauthExchange: { session: null; userErrors: Err[] } }>(EXCHANGE, { input: { provider: 'GITHUB', code, codeVerifier: VERIFIER, redirectUri: REDIRECT } })
    expect(denied.data!.oauthExchange.userErrors).toEqual([{ code: 'FORBIDDEN', field: ['email'], message: INVITE }])

    await allow(githubEmail, 'STUDENT')
    const code2 = `code2-${githubEmail}`
    stub.issue(code2, { user: { id: '4242', name: 'Gh User', emails: [{ email: githubEmail, primary: true, verified: true }] }, codeVerifier: VERIFIER, redirectUri: REDIRECT })
    const created = await t.gql<{ oauthExchange: { session: { user: { email: string } } | null; userErrors: Err[] } }>(EXCHANGE, { input: { provider: 'GITHUB', code: code2, codeVerifier: VERIFIER, redirectUri: REDIRECT } })
    expect(created.data!.oauthExchange.userErrors).toEqual([])
    expect(created.data!.oauthExchange.session!.user.email).toBe(githubEmail)

    const li = emailOf('li')
    await allow(li, 'STUDENT')
    const liAccount = await t.gql<{ signUp: { session: { user: { id: string } } } }>(SIGN_UP, { input: signUpInput(li) })
    await db.user.update({ where: { id: liAccount.data!.signUp.session.user.id }, data: { emailVerifiedAt: new Date() } })
    const liCode = `li-${li}`
    stub.issue(liCode, { user: { id: 'li-1', name: 'Li User', emails: [{ email: li, primary: true, verified: true }] }, codeVerifier: VERIFIER, redirectUri: REDIRECT })
    const link = await t.gql<{ oauthExchange: { session: { accessToken: string; user: { id: string } } | null; userErrors: Err[] } }>(EXCHANGE, { input: { provider: 'LINKEDIN', code: liCode, codeVerifier: VERIFIER, redirectUri: REDIRECT } })
    expect(link.data!.oauthExchange.userErrors).toEqual([])
    const methods = await t.gql<{ viewer: { id: string } }>(VIEWER, {}, link.data!.oauthExchange.session!.accessToken)
    expect(methods.data!.viewer.id).toBeDefined()
  })

  it('applies a role to an existing account immediately and signs it out', async () => {
    await enable(false)
    const email = emailOf('sync')
    const created = await t.gql<{ signUp: { session: { accessToken: string; user: { id: string } } } }>(SIGN_UP, { input: signUpInput(email) })
    const userId = created.data!.signUp.session.user.id
    const added = await allow(email, 'TEACHER', 'promoted')
    expect(added.data!.addAccessAllowlistEntry.userErrors).toEqual([])
    expect(await db.user.findUnique({ where: { id: userId }, select: { globalRole: true } })).toEqual({ globalRole: 'TEACHER' })
    expect((await t.gql(VIEWER, {}, created.data!.signUp.session.accessToken)).data).toEqual({ viewer: null })
    const entryId = added.data!.addAccessAllowlistEntry.entry!.id
    expect(await db.auditLog.findFirst({ where: { action: 'access_allowlist.added', targetId: entryId } })).toMatchObject({ metadata: { email, role: 'TEACHER' } })

    const updated = await t.gql<{ updateAccessAllowlistEntry: { entry: { role: string; note: string | null } | null; userErrors: Err[] } }>(UPDATE, { input: { id: entryId, role: 'STUDENT' } }, admin.token)
    expect(updated.data!.updateAccessAllowlistEntry.userErrors).toEqual([])
    expect(updated.data!.updateAccessAllowlistEntry.entry).toMatchObject({ role: 'STUDENT' })
    expect(await db.user.findUnique({ where: { id: userId }, select: { globalRole: true } })).toEqual({ globalRole: 'STUDENT' })
    expect(await db.auditLog.findFirst({ where: { action: 'access_allowlist.updated', targetId: entryId } })).toMatchObject({ metadata: { role: 'STUDENT', previousRole: 'TEACHER' } })
  })

  it('refuses self-removal, self-demotion and removing the last platform admin', async () => {
    const other = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true, email: emailOf('admin2') })
    const otherEntry = await allow(other.email, 'PLATFORM_ADMIN')
    const otherId = otherEntry.data!.addAccessAllowlistEntry.entry!.id
    const removeLast = await t.gql(REMOVE, { id: otherId }, admin.token)
    expect(removeLast.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect(removeLast.errors?.[0]?.message).toMatch(/last platform admin/)
    const demoteLast = await t.gql(UPDATE, { input: { id: otherId, role: 'STUDENT' } }, admin.token)
    expect(demoteLast.errors?.[0]?.message).toMatch(/last platform admin/)

    const mine = await allow(admin.email, 'PLATFORM_ADMIN')
    const id = mine.data!.addAccessAllowlistEntry.entry!.id
    const demoted = await t.gql<{ updateAccessAllowlistEntry: { userErrors: Err[] } }>(UPDATE, { input: { id: otherId, role: 'STUDENT' } }, admin.token)
    expect(demoted.data!.updateAccessAllowlistEntry.userErrors).toEqual([])
    expect(await db.user.findUnique({ where: { id: other.id }, select: { globalRole: true } })).toEqual({ globalRole: 'STUDENT' })

    const demote = await t.gql(UPDATE, { input: { id, role: 'TEACHER' } }, admin.token)
    expect(demote.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect(demote.errors?.[0]?.message).toMatch(/own role/)
    const note = await t.gql<{ updateAccessAllowlistEntry: { entry: { note: string | null; role: string } | null; userErrors: Err[] } }>(UPDATE, { input: { id, note: 'kept' } }, admin.token)
    expect(note.data!.updateAccessAllowlistEntry.userErrors).toEqual([])
    expect(note.data!.updateAccessAllowlistEntry.entry).toMatchObject({ role: 'PLATFORM_ADMIN', note: 'kept' })
    const removeSelf = await t.gql(REMOVE, { id }, admin.token)
    expect(removeSelf.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect(removeSelf.errors?.[0]?.message).toMatch(/own access/)

    const student = await seedUser(t.app, { email: emailOf('student') })
    const studentToken = tokenFor(t.config, student.id)
    expect((await t.gql(LIST, {}, studentToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql(ADD, { input: { email: emailOf('nope'), role: 'STUDENT' } }, studentToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql(LIST, {})).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('seeds every live account at its current role and skips deleted ones', async () => {
    const teacher = await seedUser(t.app, { globalRole: 'TEACHER', email: `Mix${seq++}@Example.com` })
    const deleted = await seedUser(t.app, { email: emailOf('gone') })
    await db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
    await db.accessAllowlistEntry.deleteMany({ where: { email: { in: [teacher.email, deleted.email] } } })
    await db.$executeRawUnsafe(SEED_INSERT)
    await db.$executeRawUnsafe(SEED_INSERT)
    const rows = await db.accessAllowlistEntry.findMany({ where: { email: { in: [teacher.email.toLowerCase(), deleted.email] } } })
    expect(rows).toEqual([expect.objectContaining({ email: teacher.email.toLowerCase(), role: 'TEACHER', addedById: null })])
    expect(rows).toHaveLength(1)
  })

  it('keeps the system publisher account usable and does not treat it as a sign-in bypass', async () => {
    await enable(true)
    const publisher = 'publisher@learnvianotes.invalid'
    await seedUser(t.app, { email: publisher })
    const signUp = await t.gql<{ signUp: { session: null; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput(publisher) })
    expect(signUp.data!.signUp.userErrors).toEqual([{ code: 'FORBIDDEN', field: ['email'], message: INVITE }])
    expect(await db.user.findFirst({ where: { email: publisher }, select: { id: true, deletedAt: true } })).toMatchObject({ deletedAt: null })
  })
})

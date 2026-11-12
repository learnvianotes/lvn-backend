import { createHash } from 'node:crypto'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import request from 'supertest'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Age-blocked sign-up stays recoverable, and a platform admin can correct it, block, or permanently delete it.
 * Docker (Postgres, Redis, S3, Mailpit) is required to run this file. `pnpm --filter @lvn-backend/api typecheck` covers the types.
 */

const SIGN_UP = `mutation ($input: SignUpInput!) {
  signUp(input: $input) { session { accessToken user { id handle } } userErrors { field message code supportEmail } } }`
const SIGN_IN = `mutation ($input: SignInInput!) {
  signIn(input: $input) { session { accessToken user { id } } userErrors { field message code supportEmail } } }`
const REFRESH = `mutation ($input: RefreshSessionInput!) { refreshSession(input: $input) { session { accessToken } userErrors { code } } }`
const BY_HANDLE = `query ($h: String!) { userByHandle(handle: $h) { id } }`
const LIST = `query ($status: AdminUserStatusFilter!, $search: String) {
  adminUsers(status: $status, search: $search, first: 20) { total users { id email displayName dateOfBirth age accountStatus statusReason } } }`
const UPDATE = `mutation ($input: AdminUpdateUserInput!) {
  adminUpdateUser(input: $input) { user { id email displayName dateOfBirth age accountStatus statusReason } userErrors { code field message } } }`
const STANDING = `mutation ($input: AdminSetAccountStandingInput!) {
  adminSetAccountStanding(input: $input) { user { accountStatus statusReason } userErrors { code field message } } }`
const DELETE = `mutation ($input: AdminDeleteUserInput!) { adminDeleteUser(input: $input) { ok userErrors { code field message } } }`

type Err = { code: string; field: string[] | null; message: string; supportEmail?: string | null }
type Managed = { id: string; email: string; displayName: string; dateOfBirth: string | null; age: number | null; accountStatus: string; statusReason: string | null }

const yearsAgo = (years: number) => {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString().slice(0, 10)
}

describe('age-restricted accounts', () => {
  let t: TestApp
  let db: PrismaService
  let admin: { id: string; email: string; token: string }
  let studentToken: string
  const email = `young-${newId().slice(0, 8)}@example.com`
  const password = 'correct horse battery staple'
  let userId = ''
  let handle = ''
  let refreshToken = ''

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const a = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true, displayName: 'Platform Admin' })
    admin = { id: a.id, email: a.email, token: tokenFor(t.config, a.id, undefined, ['PLATFORM_ADMIN']) }
    const s = await seedUser(t.app)
    studentToken = tokenFor(t.config, s.id)
  })

  afterAll(() => t.close())

  it('keeps an under-age sign-up private and tells the client who to contact', async () => {
    const res = await t.gql<{ signUp: { session: { user: { id: string; handle: string } } | null; userErrors: Err[] } }>(SIGN_UP, {
      input: { email, password, displayName: 'Young One', age: 7, acceptedTermsVersion: '2026-11-12' },
    })
    expect(res.data!.signUp.session).toBeNull()
    expect(res.data!.signUp.userErrors).toEqual([{
      code: 'AGE_RESTRICTED',
      field: ['input', 'age'],
      message: expect.stringContaining('Contact an admin at support@learnvianotes.in'),
      supportEmail: 'support@learnvianotes.in',
    }])
    const user = await db.user.findUniqueOrThrow({ where: { email } })
    userId = user.id
    handle = user.handle
    expect(user).toMatchObject({ accountStatus: 'AGE_BLOCKED', statusReason: 'Below the minimum age for an account.', analyticsOptOut: true, deletedAt: null })
    expect(user).toMatchObject({ declaredAge: 7, dateOfBirth: null })
    expect(await db.session.count({ where: { userId } })).toBe(0)
    expect((await t.gql<{ userByHandle: { id: string } | null }>(BY_HANDLE, { h: handle })).data!.userByHandle).toBeNull()
    const signIn = await t.gql<{ signIn: { session: null; userErrors: Err[] } }>(SIGN_IN, { input: { email, password } })
    expect(signIn.data!.signIn.session).toBeNull()
    expect(signIn.data!.signIn.userErrors[0]).toMatchObject({ code: 'AGE_RESTRICTED', supportEmail: 'support@learnvianotes.in' })
  })

  it('lets only a platform admin list and correct the age', async () => {
    expect((await t.gql(LIST, { status: 'AGE_BLOCKED', search: email }, studentToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    const listed = await t.gql<{ adminUsers: { total: number; users: Managed[] } }>(LIST, { status: 'AGE_BLOCKED', search: 'Young' }, admin.token)
    expect(listed.data!.adminUsers.users.map((u) => u.id)).toContain(userId)
    // ADR-0104: the age the person gave; there is no date of birth to show.
    expect(listed.data!.adminUsers.users.find((u) => u.id === userId)).toMatchObject({ accountStatus: 'AGE_BLOCKED', email, age: 7, dateOfBirth: null })

    const blank = await t.gql<{ adminUpdateUser: { user: null; userErrors: Err[] } }>(UPDATE, { input: { userId, age: 30, reason: '   ' } }, admin.token)
    expect(blank.data!.adminUpdateUser.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'reason'] })
    expect(await db.user.findUnique({ where: { id: userId }, select: { accountStatus: true } })).toMatchObject({ accountStatus: 'AGE_BLOCKED' })

    for (const age of [0, 121]) {
      const out = await t.gql<{ adminUpdateUser: { user: null; userErrors: Err[] } }>(UPDATE, { input: { userId, age, reason: 'Typo' } }, admin.token)
      expect(out.data!.adminUpdateUser.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'age'] })
    }
    const both = await t.gql<{ adminUpdateUser: { user: null; userErrors: Err[] } }>(UPDATE, { input: { userId, age: 30, dateOfBirth: yearsAgo(30), reason: 'Both' } }, admin.token)
    expect(both.data!.adminUpdateUser.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'age'] })

    const stillYoung = await t.gql<{ adminUpdateUser: { user: Managed; userErrors: Err[] } }>(UPDATE, { input: { userId, age: 6, reason: 'Still at school' } }, admin.token)
    expect(stillYoung.data!.adminUpdateUser.userErrors).toEqual([])
    expect(stillYoung.data!.adminUpdateUser.user).toMatchObject({ accountStatus: 'AGE_BLOCKED', statusReason: 'Below the minimum age for an account.', age: 6 })

    const forced = await t.gql<{ adminSetAccountStanding: { user: null; userErrors: Err[] } }>(STANDING, { input: { userId, status: 'ACTIVE', reason: 'Let them in anyway' } }, admin.token)
    expect(forced.data!.adminSetAccountStanding.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'age'] })
    const handSet = await t.gql<{ adminSetAccountStanding: { userErrors: Err[] } }>(STANDING, { input: { userId, status: 'AGE_BLOCKED', reason: 'By hand' } }, admin.token)
    expect(handSet.data!.adminSetAccountStanding.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'status'] })

    const passed = await t.gql<{ adminUpdateUser: { user: Managed; userErrors: Err[] } }>(UPDATE, {
      input: { userId, age: 20, displayName: 'Older Now', reason: 'Document shows an adult' },
    }, admin.token)
    expect(passed.data!.adminUpdateUser.userErrors).toEqual([])
    expect(passed.data!.adminUpdateUser.user).toMatchObject({ accountStatus: 'ACTIVE', statusReason: null, displayName: 'Older Now', age: 20, dateOfBirth: null })
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ declaredAge: 20, dateOfBirth: null })
    expect((await t.gql<{ userByHandle: { id: string } | null }>(BY_HANDLE, { h: handle })).data!.userByHandle).toEqual({ id: userId })
    const audit = await db.auditLog.findFirst({ where: { action: 'account.admin.updated', targetId: userId, actorId: admin.id }, orderBy: { createdAt: 'desc' } })
    expect(audit!.metadata).toMatchObject({ reason: 'Document shows an adult', fields: ['displayName', 'age'], ageUnblocked: true })
  })

  it('corrects an account registered with a date of birth through its date of birth, which it keeps', async () => {
    const legacy = await seedUser(t.app, { displayName: 'Legacy Young' })
    await db.user.update({ where: { id: legacy.id }, data: { dateOfBirth: new Date(`${yearsAgo(7)}T00:00:00Z`), accountStatus: 'AGE_BLOCKED', statusReason: 'Below the minimum age for an account.' } })
    const listed = await t.gql<{ adminUsers: { users: Managed[] } }>(LIST, { status: 'AGE_BLOCKED', search: legacy.email }, admin.token)
    expect(listed.data!.adminUsers.users).toEqual([expect.objectContaining({ id: legacy.id, dateOfBirth: yearsAgo(7), age: 7 })])

    // The date of birth decides the age, so an age cannot be set beside it, and nothing is changed.
    const byAge = await t.gql<{ adminUpdateUser: { user: null; userErrors: Err[] } }>(UPDATE, { input: { userId: legacy.id, age: 30, reason: 'Says 30' } }, admin.token)
    expect(byAge.data!.adminUpdateUser.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'age'] })
    const forced = await t.gql<{ adminSetAccountStanding: { userErrors: Err[] } }>(STANDING, { input: { userId: legacy.id, status: 'ACTIVE', reason: 'Let them in' } }, admin.token)
    expect(forced.data!.adminSetAccountStanding.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'dateOfBirth'] })
    expect(await db.user.findUniqueOrThrow({ where: { id: legacy.id } })).toMatchObject({ dateOfBirth: new Date(`${yearsAgo(7)}T00:00:00Z`), declaredAge: null, accountStatus: 'AGE_BLOCKED' })

    const passed = await t.gql<{ adminUpdateUser: { user: Managed; userErrors: Err[] } }>(UPDATE, { input: { userId: legacy.id, dateOfBirth: yearsAgo(20), reason: 'Document shows an adult date of birth' } }, admin.token)
    expect(passed.data!.adminUpdateUser.userErrors).toEqual([])
    expect(passed.data!.adminUpdateUser.user).toMatchObject({ accountStatus: 'ACTIVE', dateOfBirth: yearsAgo(20), age: 20 })
  })

  it('blocks and suspends with sessions revoked, then restores', async () => {
    const signed = await request(t.app.getHttpServer()).post('/graphql').set('x-lvn-client', 'mobile').send({ query: SIGN_IN, variables: { input: { email, password } } })
    expect(signed.body.data.signIn.userErrors).toEqual([])
    refreshToken = signed.body.data.signIn.session.refreshToken as string
    const blocked = await t.gql<{ adminSetAccountStanding: { user: { accountStatus: string }; userErrors: Err[] } }>(STANDING, { input: { userId, status: 'BLOCKED', reason: 'Spam reports' } }, admin.token)
    expect(blocked.data!.adminSetAccountStanding).toEqual({ user: { accountStatus: 'BLOCKED', statusReason: 'Spam reports' }, userErrors: [] })
    const again = await t.gql<{ signIn: { session: null; userErrors: Err[] } }>(SIGN_IN, { input: { email, password } })
    expect(again.data!.signIn.userErrors[0]).toMatchObject({ code: 'VALIDATION', supportEmail: 'support@learnvianotes.in' })
    const refresh = await request(t.app.getHttpServer()).post('/graphql').set('x-lvn-client', 'mobile').send({ query: REFRESH, variables: { input: { refreshToken } } })
    expect(refresh.body.errors[0].extensions.code).toBe('UNAUTHENTICATED')
    expect((await t.gql<{ userByHandle: { id: string } | null }>(BY_HANDLE, { h: handle })).data!.userByHandle).toBeNull()

    const self = await t.gql<{ adminSetAccountStanding: { userErrors: Err[] } }>(STANDING, { input: { userId: admin.id, status: 'BLOCKED', reason: 'Myself' } }, admin.token)
    expect(self.data!.adminSetAccountStanding.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'userId'] })

    const until = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const restored = await t.gql<{ adminSetAccountStanding: { userErrors: Err[] } }>(STANDING, { input: { userId, status: 'ACTIVE', reason: 'Mistake' } }, admin.token)
    expect(restored.data!.adminSetAccountStanding.userErrors).toEqual([])
    const suspended = await t.gql<{ adminSetAccountStanding: { user: { accountStatus: string; statusReason: string }; userErrors: Err[] } }>(STANDING, { input: { userId, status: 'SUSPENDED', reason: 'Until the review', until } }, admin.token)
    expect(suspended.data!.adminSetAccountStanding.user).toEqual({ accountStatus: 'SUSPENDED', statusReason: 'Until the review' })
    const held = await t.gql<{ adminUsers: { users: Managed[] } }>(LIST, { status: 'BLOCKED_OR_SUSPENDED', search: email }, admin.token)
    expect(held.data!.adminUsers.users.map((u) => u.id)).toContain(userId)
    await t.gql(STANDING, { input: { userId, status: 'ACTIVE', reason: 'Review finished' } }, admin.token)
  })

  it('permanently deletes with a typed confirmation and keeps only a hashed tombstone', async () => {
    const fileId = newId()
    await db.fileObject.create({
      data: { id: fileId, ownerId: userId, parentType: 'NOTE', purpose: 'ATTACHMENT', bucket: 'lvn-files', storageKey: `development/${userId}/${fileId}/original`, mimeType: 'image/png', sizeBytes: 40n, originalFileName: 'id.png', status: 'READY' },
    })
    await db.user.update({ where: { id: userId }, data: { avatarFileId: fileId } })

    const wrong = await t.gql<{ adminDeleteUser: { ok: boolean; userErrors: Err[] } }>(DELETE, { input: { userId, reason: 'Asked to be removed', confirm: 'delete' } }, admin.token)
    expect(wrong.data!.adminDeleteUser).toMatchObject({ ok: false, userErrors: [{ code: 'VALIDATION', field: ['input', 'confirm'] }] })
    const self = await t.gql<{ adminDeleteUser: { userErrors: Err[] } }>(DELETE, { input: { userId: admin.id, reason: 'Myself', confirm: 'DELETE' } }, admin.token)
    expect(self.data!.adminDeleteUser.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'userId'] })

    const gone = await t.gql<{ adminDeleteUser: { ok: boolean; userErrors: Err[] } }>(DELETE, { input: { userId, reason: 'Asked to be removed', confirm: 'DELETE' } }, admin.token)
    expect(gone.data!.adminDeleteUser).toEqual({ ok: true, userErrors: [] })
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user).toMatchObject({ displayName: 'Deleted user', dateOfBirth: null, declaredAge: null, ageDeclaredAt: null, accountStatus: 'ACTIVE', deletedAt: expect.any(Date) })
    expect(user.email).toMatch(/@deleted\.learnvianotes\.invalid$/)
    expect(await db.session.count({ where: { userId } })).toBe(0)
    expect(await db.fileObject.findUnique({ where: { id: fileId }, select: { status: true } })).toMatchObject({ status: 'DELETED' })
    const hash = createHash('sha256').update(email).digest('hex')
    const tomb = await db.accountTombstone.findFirstOrThrow({ where: { userId } })
    expect(tomb).toMatchObject({ emailHash: hash, adminId: admin.id, reason: 'Asked to be removed' })
    expect(JSON.stringify(tomb)).not.toContain(email)
    const recorded = await db.auditLog.findFirst({ where: { action: 'account.admin.deleted', targetId: userId } })
    expect(recorded).toMatchObject({ actorId: admin.id, metadata: { reason: 'Asked to be removed', emailHash: hash } })
    expect(JSON.stringify(recorded!.metadata)).not.toContain(email)
    const active = await t.gql<{ adminUsers: { users: { id: string }[] } }>(LIST, { status: 'ACTIVE', search: email }, admin.token)
    expect(active.data!.adminUsers.users.map((u) => u.id)).not.toContain(userId)
  })
})

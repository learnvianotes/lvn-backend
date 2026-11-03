import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { PlatformSettingsStore } from '@lvn-backend/users'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * ADR-0103: a platform admin manages the terms version from the settings page. It must be one the web has published;
 * changing it asks signed-in people to accept again and never blocks sign-in.
 */

const STATUS = `{ adminTermsStatus { current source publishedVersions acceptedCurrent acceptedOlder lastChange { actorId actorDisplayName at previous } } }`
const SETTINGS = `{ adminSettings { key category value overridden constraints { pattern maxLength } } }`
const SET = `mutation ($input: UpdateAdminSettingInput!) { updateAdminSetting(input: $input) { setting { key value overridden } userErrors { code message field } } }`
const RESET = `mutation ($key: String!) { resetAdminSetting(key: $key) { setting { key value overridden } userErrors { code message field } } }`
const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } userErrors { code field } } }`
const SIGN_IN = `mutation ($input: SignInInput!) { signIn(input: $input) { session { accessToken } userErrors { code field } } }`
const ACCEPT = `mutation ($input: AcceptTermsInput!) { acceptTerms(input: $input) { ok userErrors { code field } } }`

type Err = { code: string; message: string; field: string[] | null }
type Status = {
  current: string
  source: string
  publishedVersions: string[]
  acceptedCurrent: number | null
  acceptedOlder: number | null
  lastChange: { actorId: string | null; actorDisplayName: string | null; at: string; previous: string | null } | null
}
type SettingPayload = { setting: { key: string; value: string; overridden: boolean } | null; userErrors: Err[] }

const PASSWORD = 'correct horse battery staple'
let seq = 0
const signUpInput = (acceptedTermsVersion: string) => ({ email: `terms${Date.now()}${seq++}@example.com`, password: PASSWORD, displayName: 'Asha Rao', dateOfBirth: '2004-05-01', acceptedTermsVersion })

describe('terms version managed by an admin', () => {
  let t: TestApp
  /** A second API process on the same database, as a second replica or the worker would be. */
  let t2: TestApp
  let db: PrismaService
  let admin: { id: string; token: string }
  let studentToken: string
  let teacherToken: string
  let earlier: { id: string; email: string }

  const termsVersion = async (app: TestApp = t) => (await app.gql<{ termsVersion: string }>('{ termsVersion }')).data!.termsVersion
  const status = async () => {
    const res = await t.gql<{ adminTermsStatus: Status }>(STATUS, {}, admin.token)
    expect(res.errors).toBeUndefined()
    return res.data!.adminTermsStatus
  }
  const set = async (key: string, value: string, token = admin.token) => (await t.gql<{ updateAdminSetting: SettingPayload }>(SET, { input: { key, value } }, token)).data!.updateAdminSetting
  const reset = async (key: string) => (await t.gql<{ resetAdminSetting: SettingPayload }>(RESET, { key }, admin.token)).data!.resetAdminSetting
  const termsAudits = () => db.auditLog.findMany({ where: { targetType: 'AppSetting', metadata: { path: ['key'], equals: 'terms_version' } }, orderBy: { createdAt: 'asc' } })
  const accepted = async (token: string) => (await t.gql<{ viewer: { termsAccepted: boolean | null } }>('{ viewer { termsAccepted } }', {}, token)).data!.viewer.termsAccepted
  const signIn = async (email: string) => (await t.gql<{ signIn: { session: { accessToken: string } | null; userErrors: Err[] } }>(SIGN_IN, { input: { email, password: PASSWORD } })).data!.signIn

  beforeAll(async () => {
    t = await createTestApp()
    t2 = await createTestApp({}, { resetDatabase: false })
    db = t.app.get(PrismaService)
    const a = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true, displayName: 'Terms Admin' })
    admin = { id: a.id, token: tokenFor(t.config, a.id, undefined, ['PLATFORM_ADMIN']) }
    studentToken = tokenFor(t.config, (await seedUser(t.app)).id)
    teacherToken = tokenFor(t.config, (await seedUser(t.app, { globalRole: 'TEACHER', verified: true })).id, undefined, ['TEACHER'])
  })

  afterAll(async () => {
    await t2.close()
    await t.close()
  })

  it('starts from the built-in version and its published list', async () => {
    expect(await termsVersion()).toBe('2026-11-03')
    expect(await status()).toEqual({ current: '2026-11-03', source: 'DEFAULT', publishedVersions: ['2026-10-08', '2026-11-03'], acceptedCurrent: null, acceptedOlder: null, lastChange: null })
    const listed = (await t.gql<{ adminSettings: { key: string; category: string; value: string; overridden: boolean; constraints: { pattern: string | null } }[] }>(SETTINGS, {}, admin.token)).data!.adminSettings
    expect(listed.find((s) => s.key === 'terms_version')).toMatchObject({ category: 'legal', value: '2026-11-03', overridden: false, constraints: { pattern: '^\\d{4}-\\d{2}-\\d{2}$' } })
    expect(listed.find((s) => s.key === 'terms_published_versions')).toMatchObject({ category: 'legal', value: '2026-10-08,2026-11-03', overridden: false })
  })

  it('is platform-admin only', async () => {
    expect((await t.gql(STATUS)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    for (const token of [studentToken, teacherToken]) {
      expect((await t.gql(STATUS, {}, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(SET, { input: { key: 'terms_version', value: '2026-10-08' } }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(SET, { input: { key: 'terms_published_versions', value: '2026-11-03' } }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(RESET, { key: 'terms_version' }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    }
    expect(await termsVersion()).toBe('2026-11-03')
    expect(await termsAudits()).toEqual([])
  })

  it('refuses a version the web has not published, and a list that drops the version in effect', async () => {
    const unpublished = await set('terms_version', '2026-12-01')
    expect(unpublished.setting).toBeNull()
    expect(unpublished.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'value'] })
    expect(unpublished.userErrors[0]!.message).toMatch(/2026-12-01 is not a published terms version/)
    expect((await set('terms_version', 'next week')).userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'value'] })
    const dropped = await set('terms_published_versions', '2026-10-08')
    expect(dropped.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'value'] })
    expect(dropped.userErrors[0]!.message).toMatch(/must include the terms version in effect \(2026-11-03\)/)
    expect(await termsVersion()).toBe('2026-11-03')
    expect(await termsAudits()).toEqual([])
  })

  it('switches the version: sign-up and acceptTerms follow it, sign-in stays open, and the change is audited', async () => {
    // Someone who signed up under 2026-11-03.
    const before = signUpInput('2026-11-03')
    const first = (await t.gql<{ signUp: { session: { user: { id: string } } | null; userErrors: Err[] } }>(SIGN_UP, { input: before })).data!.signUp
    expect(first.userErrors).toEqual([])
    earlier = { id: first.session!.user.id, email: before.email }

    // The web publishes 2026-12-01; the operator lists it, then switches to it.
    expect((await set('terms_published_versions', '2026-12-01,2026-10-08,2026-11-03')).setting).toEqual({ key: 'terms_published_versions', value: '2026-10-08,2026-11-03,2026-12-01', overridden: true })
    expect(await set('terms_version', '2026-12-01')).toEqual({ setting: { key: 'terms_version', value: '2026-12-01', overridden: true }, userErrors: [] })
    expect(await termsVersion()).toBe('2026-12-01')

    // A form loaded before the change gets one VALIDATION answer; the new version signs up.
    const stale = (await t.gql<{ signUp: { session: unknown; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput('2026-11-03') })).data!.signUp
    expect(stale.session).toBeNull()
    expect(stale.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'acceptedTermsVersion'] })
    const fresh = (await t.gql<{ signUp: { session: { user: { id: string } } | null; userErrors: Err[] } }>(SIGN_UP, { input: signUpInput('2026-12-01') })).data!.signUp
    expect(fresh.userErrors).toEqual([])
    const consents = await db.consentRecord.findMany({ where: { userId: fresh.session!.user.id } })
    expect(consents.map((c) => `${c.kind}:${c.version}`).sort()).toEqual(['PRIVACY:2026-12-01', 'PUBLIC_CONTENT_LICENCE:2026-12-01', 'TERMS:2026-12-01'])

    // The earlier account still signs in, is asked again, and can accept only the version in effect.
    const session = await signIn(earlier.email)
    expect(session.userErrors).toEqual([])
    const token = session.session!.accessToken
    expect(await accepted(token)).toBe(false)
    expect((await t.gql<{ acceptTerms: { ok: boolean; userErrors: Err[] } }>(ACCEPT, { input: { version: '2026-11-03' } }, token)).data!.acceptTerms.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'version'] })
    expect((await t.gql<{ acceptTerms: { ok: boolean } }>(ACCEPT, { input: { version: '2026-12-01' } }, token)).data!.acceptTerms.ok).toBe(true)
    expect(await accepted(token)).toBe(true)

    const audits = await termsAudits()
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({ actorId: admin.id, action: 'settings.updated', metadata: { key: 'terms_version', value: '2026-12-01', previous: '2026-11-03' } })
    expect(await db.auditLog.findFirst({ where: { action: 'settings.updated', metadata: { path: ['key'], equals: 'terms_published_versions' } } })).toMatchObject({ metadata: { value: '2026-10-08,2026-11-03,2026-12-01', previous: '2026-10-08,2026-11-03' } })

    const now = await status()
    expect(now).toMatchObject({ current: '2026-12-01', source: 'SETTING', publishedVersions: ['2026-10-08', '2026-11-03', '2026-12-01'] })
    expect(now.lastChange).toEqual({ actorId: admin.id, actorDisplayName: 'Terms Admin', at: audits[0]!.createdAt.toISOString(), previous: '2026-11-03' })
  })

  it('reaches a second process when it re-reads its settings', async () => {
    await t2.app.get(PlatformSettingsStore).reload()
    expect(await termsVersion(t2)).toBe('2026-12-01')
  })

  it('counts acceptance of the current version and hides groups under five', async () => {
    // So far two accounts accepted 2026-12-01 and nobody else accepted anything: both groups are under five.
    expect(await status()).toMatchObject({ acceptedCurrent: null, acceptedOlder: null })
    const accept = async (versions: string[], deleted = false) => {
      const user = await seedUser(t.app)
      if (deleted) await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } })
      for (const [i, version] of versions.entries()) {
        await db.consentRecord.createMany({ data: (['TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE'] as const).map((kind) => ({ id: newId(), userId: user.id, kind, version, acceptedAt: new Date(Date.now() - (versions.length - i) * 60_000) })) })
      }
    }
    for (let i = 0; i < 5; i++) await accept(['2026-12-01'])
    for (let i = 0; i < 6; i++) await accept(['2026-11-03'])
    await accept(['2026-11-03'], true) // deleted: not counted
    await accept(['2026-11-03', '2026-12-01']) // accepted again: current
    await accept(['2026-12-01', '2026-10-08']) // latest is older: asked again
    // 2 + 5 + 1 current; 6 + 1 older.
    expect(await status()).toMatchObject({ acceptedCurrent: 8, acceptedOlder: 7 })
  })

  it('resets to the default, keeps the published list consistent, and audits the reset', async () => {
    // The default list lacks 2026-12-01, which is still in effect.
    const blocked = await reset('terms_published_versions')
    expect(blocked.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['key'] })
    expect(await termsVersion()).toBe('2026-12-01')

    expect(await reset('terms_version')).toEqual({ setting: { key: 'terms_version', value: '2026-11-03', overridden: false }, userErrors: [] })
    expect(await termsVersion()).toBe('2026-11-03')
    const audits = await termsAudits()
    expect(audits.at(-1)).toMatchObject({ actorId: admin.id, action: 'settings.reset', metadata: { key: 'terms_version', previous: '2026-12-01', value: '2026-11-03' } })
    expect((await reset('terms_published_versions')).userErrors).toEqual([])
    expect(await status()).toMatchObject({ current: '2026-11-03', source: 'DEFAULT', publishedVersions: ['2026-10-08', '2026-11-03'], lastChange: { actorId: admin.id, previous: '2026-12-01' } })

    // Sign-in is never gated on the terms: the earlier account (latest acceptance 2026-12-01) still signs in.
    const session = await signIn(earlier.email)
    expect(session.userErrors).toEqual([])
    expect(await accepted(session.session!.accessToken)).toBe(false)
  })
})

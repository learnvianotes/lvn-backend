import { InProcessEventBus } from '@lvn-backend/event-bus'
import { LegacySnapshots, type LegacyUserSnapshot } from '@lvn-backend/legacy'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { Mailbox } from '@lvn-backend/testing'
import { createTestApp, infra, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** Student profile (ADR-0026), plan limits (ADR-0024), old-site data and /core progress (ADR-0023). */

const UPDATE = `mutation ($input: UpdateProfileInput!) { updateProfile(input: $input) {
  profile { department yearOfStudy interestTopicIds showOnProfile } userErrors { field message code } } }`
const LIMITS = '{ viewer { limits { key limit used } } }'
const LEGACY = '{ viewer { legacyImport { status claimedAt counts { notes completedTopics markedProblems studyDays studyMinutes } } } }'
const PROGRESS = `query ($s: String!) { coreProgress(subjectId: $s) {
  subjectId topics { topicKey completed revisit secondsStudied lastStudiedAt } problems { problemId mark } } }`

type Limit = { key: string; limit: number | null; used: number }
type Progress = { coreProgress: { subjectId: string; topics: { topicKey: string; completed: boolean; revisit: boolean; secondsStudied: number }[]; problems: { problemId: string; mark: string }[] } }

const snapshot = (uid: string, email: string, providers: string[]): LegacyUserSnapshot => ({
  version: 1,
  uid,
  email,
  emailVerified: true,
  providers,
  user: {
    progress: {
      problems: { 'lc-20': 'solved', 'lc-155': 'revisit' },
      topics: { 'python/variables': true, 'python/loops': true },
      revisitTopics: { 'python/loops': true },
      studied: { '2026-03-01': 2 },
    },
  },
  days: {
    '2026-03-01': { topics: { 'python/variables': { title: 'Variables', subject: 'Python', sec: 900, visits: 3, last: Date.UTC(2026, 2, 1, 10) } }, focus: 600 },
    '2026-03-02': { topics: { 'python/variables': { title: 'Variables', subject: 'Python', sec: 300, visits: 1, last: Date.UTC(2026, 2, 2, 9) } }, focus: 0 },
  },
  notes: [{ key: 'python/variables', text: 'names point at objects', updatedAt: 1 }],
})

describe('profile, limits and old-site data', () => {
  let t: TestApp
  let db: PrismaService
  let snapshots: LegacySnapshots
  const drain = () => t.app.get(InProcessEventBus).drain()

  beforeAll(async () => {
    t = await createTestApp({ FIREBASE_PROJECT_ID: 'lvn-test' })
    db = t.app.get(PrismaService)
    snapshots = new LegacySnapshots(t.app.get(Storage), t.config.S3_RESTRICTED_BUCKET, t.config.APP_ENV)
  })

  afterAll(() => t.close())

  describe('student profile (ADR-0026)', () => {
    it('stores department, year and interests; partial updates keep the rest; null clears', async () => {
      const u = await seedUser(t.app)
      const token = tokenFor(t.config, u.id)
      const interests = [newId(), newId()]
      const first = await t.gql<{ updateProfile: { profile: Record<string, unknown> } }>(UPDATE, { input: { department: 'AI & DS', yearOfStudy: 'YEAR_3', interestTopicIds: interests } }, token)
      expect(first.data!.updateProfile.profile).toEqual({ department: 'AI & DS', yearOfStudy: 'YEAR_3', interestTopicIds: interests, showOnProfile: false })
      expect(await db.studentProfile.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ departmentKey: 'ai ds' })

      const second = await t.gql<{ updateProfile: { profile: Record<string, unknown> } }>(UPDATE, { input: { showOnProfile: true, department: null } }, token)
      expect(second.data!.updateProfile.profile).toEqual({ department: null, yearOfStudy: 'YEAR_3', interestTopicIds: interests, showOnProfile: true })
    })

    it.each([
      [{ department: 'x'.repeat(81) }, ['input', 'department']],
      [{ interestTopicIds: Array.from({ length: 51 }, () => newId()) }, ['input', 'interestTopicIds']],
    ])('refuses %#', async (input, field) => {
      const u = await seedUser(t.app)
      const res = await t.gql<{ updateProfile: { userErrors: { field: string[] }[] } }>(UPDATE, { input }, tokenFor(t.config, u.id))
      expect(res.data!.updateProfile.userErrors[0]!.field).toEqual(field)
    })

    it('shows department and year to others only when the student chooses, and never their interests', async () => {
      const teacher = await seedUser(t.app, { globalRole: 'TEACHER', verified: true, displayName: `Visible ${newId().slice(-5)}` })
      const own = tokenFor(t.config, teacher.id, undefined, ['TEACHER'])
      await t.gql(UPDATE, { input: { department: 'CSE', yearOfStudy: 'POSTGRADUATE', interestTopicIds: [newId()] } }, own)
      const viewer = tokenFor(t.config, (await seedUser(t.app)).id)
      const find = () => t.gql<{ teachers: { id: string; profile: unknown }[] }>('query ($q: String!) { teachers(search: $q) { id profile { department yearOfStudy interestTopicIds } } }', { q: teacher.displayName }, viewer)
      expect((await find()).data!.teachers.find((x) => x.id === teacher.id)!.profile).toBeNull()
      await t.gql(UPDATE, { input: { showOnProfile: true } }, own)
      expect((await find()).data!.teachers.find((x) => x.id === teacher.id)!.profile).toEqual({ department: 'CSE', yearOfStudy: 'POSTGRADUATE', interestTopicIds: null })
    })
  })

  describe('limits (ADR-0024)', () => {
    it('shows the plan limits by role, with storage use, to the viewer only', async () => {
      const s = await seedUser(t.app)
      const token = tokenFor(t.config, s.id)
      const before = (await t.gql<{ viewer: { limits: Limit[] } }>(LIMITS, {}, token)).data!.viewer.limits
      expect(before.find((l) => l.key === 'STORAGE_BYTES')).toEqual({ key: 'STORAGE_BYTES', limit: 5 * 1024 ** 3, used: 0 })
      expect(before.find((l) => l.key === 'AI_TOKENS_DAILY')!.limit).toBe(200_000)
      expect(before.find((l) => l.key === 'GROUPS_OWNED')!.limit).toBeNull()

      await upload(t, token, 'AVATAR', 'image/png', SAMPLES.png)
      const after = (await t.gql<{ viewer: { limits: Limit[] } }>(LIMITS, {}, token)).data!.viewer.limits
      expect(after.find((l) => l.key === 'STORAGE_BYTES')!.used).toBe(SAMPLES.png.length)

      const teacher = await seedUser(t.app, { globalRole: 'TEACHER' })
      const tl = (await t.gql<{ viewer: { limits: Limit[] } }>(LIMITS, {}, tokenFor(t.config, teacher.id))).data!.viewer.limits
      expect(tl.find((l) => l.key === 'STORAGE_BYTES')!.limit).toBe(20 * 1024 ** 3)
    })
  })

  describe('old-site data (ADR-0023)', () => {
    const indexWith = async (...users: LegacyUserSnapshot[]) => {
      for (const u of users) await snapshots.writeUser(u)
      await snapshots.writeIndex({ version: 1, generatedAt: new Date().toISOString(), users: users.map((u) => ({ uid: u.uid, email: u.email, emailVerified: u.emailVerified, providers: u.providers })) })
    }

    it('attaches a Google user’s old data automatically, imports their /core progress, and removes it on request', async () => {
      const uid = `old-g-${newId().slice(-8)}`
      const email = `${uid}@gmail.com`
      await indexWith(snapshot(uid, email, ['google.com']))
      // A cached index from another test is at most five minutes old; this app reads it fresh.
      const signIn = await t.gql<{ signInWithGoogle: { session: { accessToken: string } } }>(
        'mutation ($t: String!) { signInWithGoogle(input: { idToken: $t }) { session { accessToken } } }',
        { t: `google:${uid}:${email}` },
      )
      const token = signIn.data!.signInWithGoogle.session.accessToken
      await drain()

      const legacy = (await t.gql<{ viewer: { legacyImport: Record<string, unknown> } }>(LEGACY, {}, token)).data!.viewer.legacyImport
      expect(legacy).toMatchObject({ status: 'CLAIMED', counts: { notes: 1, completedTopics: 2, markedProblems: 2, studyDays: 2, studyMinutes: 30 } })

      const python = (await t.gql<Progress>(PROGRESS, { s: 'python' }, token)).data!.coreProgress
      expect(python.topics).toEqual([
        expect.objectContaining({ topicKey: 'python/loops', completed: true, revisit: true, secondsStudied: 0 }),
        expect.objectContaining({ topicKey: 'python/variables', completed: true, revisit: false, secondsStudied: 1200 }),
      ])
      const sheet = (await t.gql<Progress>(PROGRESS, { s: 'sheet-150' }, token)).data!.coreProgress
      expect(sheet.problems).toEqual(expect.arrayContaining([{ problemId: 'lc-20', mark: 'SOLVED' }, { problemId: 'lc-155', mark: 'REVISIT' }]))

      expect((await t.gql<{ declineLegacyData: { ok: boolean } }>('mutation { declineLegacyData { ok } }', {}, token)).data!.declineLegacyData.ok).toBe(true)
      await drain()
      expect((await t.gql<{ viewer: { legacyImport: { status: string } } }>(LEGACY, {}, token)).data!.viewer.legacyImport.status).toBe('DECLINED')
      expect((await t.gql<Progress>(PROGRESS, { s: 'python' }, token)).data!.coreProgress.topics).toEqual([])
    })

    it('offers an email user their old data once the email is verified, and imports it only after they claim it', async () => {
      const uid = `old-p-${newId().slice(-8)}`
      const email = `${uid}@example.com`
      await indexWith(snapshot(uid, email, ['password']))
      const fresh = await createTestApp() // its index cache starts empty
      try {
        const res = await fresh.gql<{ signUp: { session: { accessToken: string } } }>(
          'mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken } } }',
          { input: { email, password: 'a long enough passphrase', displayName: 'Old Learner', dateOfBirth: '2003-01-01', acceptedTermsVersion: '2026-10-08' } },
        )
        const token = res.data!.signUp.session.accessToken
        expect((await fresh.gql<{ viewer: { legacyImport: { status: string } } }>(LEGACY, {}, token)).data!.viewer.legacyImport.status).toBe('NOT_FOUND')

        const link = /href="([^"]+\/verify\?token=[^"]+)"/.exec((await new Mailbox(infra().mail.apiUrl).latestTo(email)).html)![1]!.replace(/&amp;/g, '&')
        await fresh.gql('mutation ($t: String!) { verifyEmail(input: { token: $t }) { ok } }', { t: new URL(link).searchParams.get('token') })
        expect((await fresh.gql<{ viewer: { legacyImport: { status: string } } }>(LEGACY, {}, token)).data!.viewer.legacyImport.status).toBe('AVAILABLE')
        await fresh.app.get(InProcessEventBus).drain()
        expect((await fresh.gql<Progress>(PROGRESS, { s: 'python' }, token)).data!.coreProgress.topics).toEqual([])

        await fresh.gql('mutation { claimLegacyData { ok } }', {}, token)
        await fresh.app.get(InProcessEventBus).drain()
        expect((await fresh.gql<{ viewer: { legacyImport: { status: string; claimedAt: string } } }>(LEGACY, {}, token)).data!.viewer.legacyImport).toMatchObject({ status: 'CLAIMED', claimedAt: expect.any(String) })
        expect((await fresh.gql<Progress>(PROGRESS, { s: 'python' }, token)).data!.coreProgress.topics).toHaveLength(2)
        // One old account goes to one new account.
        const userId = (await db.user.findUniqueOrThrow({ where: { email } })).id
        expect(await db.legacyImport.count({ where: { legacyUid: uid } })).toBe(1)
        expect((await db.legacyImport.findUniqueOrThrow({ where: { userId } })).matchedBy).toBe('EMAIL')
      } finally {
        await fresh.close()
      }
    })

    it('has nothing to claim without old data, and needs a session for progress', async () => {
      const u = await seedUser(t.app)
      const token = tokenFor(t.config, u.id)
      expect((await t.gql<{ viewer: { legacyImport: { status: string } } }>(LEGACY, {}, token)).data!.viewer.legacyImport.status).toBe('NOT_FOUND')
      expect((await t.gql<{ claimLegacyData: { userErrors: { code: string }[] } }>('mutation { claimLegacyData { ok userErrors { code } } }', {}, token)).data!.claimLegacyData.userErrors[0]!.code).toBe('NOT_FOUND')
      expect((await t.gql(PROGRESS, { s: 'python' })).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    })
  })
})

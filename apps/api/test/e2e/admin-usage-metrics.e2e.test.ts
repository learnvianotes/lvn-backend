import { randomBytes } from 'node:crypto'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { STUDY_PUBLISHER_ID, UsersMaintenance } from '@lvn-backend/users'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Admin usage metrics (ADR-0105): growth, engagement, content, top subjects, verification and the database-backed
 * funnel steps, from tables the product already keeps. Days are IST. Small groups (fewer than 5 people) are hidden.
 */

const IST_MS = 330 * 60_000
const DAY_MS = 86_400_000
const istDay = (at: Date) => new Date(at.getTime() + IST_MS).toISOString().slice(0, 10)
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
/** A wall-clock time in India on a day. */
const at = (day: string, hhmm = '12:00') => new Date(`${day}T${hhmm}:00+05:30`)
const dateOnly = (day: string) => new Date(`${day}T00:00:00Z`)

const RANGE = 'range { from to firstDay lastDay timeZone }'
const GROWTH = `query ($from: DateTime, $to: DateTime, $interval: MetricsInterval) { adminGrowth(from: $from, to: $to, interval: $interval) {
  ${RANGE} interval generatedAt totals { signUps emailVerified registrationsCompleted verifications }
  series { date signUps emailVerified registrationsCompleted verifications } signUpMethods { method users } hiddenSmallGroups } }`
const ENGAGEMENT = `query ($from: DateTime, $to: DateTime, $interval: MetricsInterval) { adminEngagement(from: $from, to: $to, interval: $interval) {
  ${RANGE} interval dau wau mau stickiness series { date activeUsers learningMinutes notesCreated doubtsAsked doubtsAnswered quizAttempts } } }`
const CONTENT = `query ($from: DateTime, $to: DateTime) { adminContentStats(from: $from, to: $to) {
  ${RANGE} generatedAt notes { created public unlisted shared private }
  uploads { files bytes byPurpose { purpose files bytes } hiddenSmallGroups } scans { clean infected failed pending }
  doubts { asked answered resolved answers medianHoursToFirstAnswer } places { groups classrooms groupPosts classroomPosts }
  sharing { noteShares placeShares saves } } }`
const SUBJECTS = `query ($from: DateTime, $to: DateTime, $by: AdminSubjectMetric!, $first: Int) { adminTopSubjects(from: $from, to: $to, by: $by, first: $first) {
  ${RANGE} by subjects { subjectId title value users } hiddenSmallGroups } }`
const VERIFICATION = `query ($from: DateTime, $to: DateTime) { adminVerificationStats(from: $from, to: $to) {
  ${RANGE} requested approved rejected pending medianHoursToDecision oldestPendingHours byMethod { method requested approved rejected } hiddenSmallGroups } }`
const FUNNEL = `query ($steps: [String!]!, $since: DateTime) { adminFunnel(steps: $steps, since: $since) { name users } }`

type Point = { date: string; signUps: number; emailVerified: number; registrationsCompleted: number; verifications: number }
type Growth = { range: { from: string; firstDay: string; lastDay: string; timeZone: string }; interval: string; totals: Omit<Point, 'date'>; series: Point[]; signUpMethods: { method: string; users: number }[]; hiddenSmallGroups: number }
type EngagementPoint = { date: string; activeUsers: number; learningMinutes: number; notesCreated: number; doubtsAsked: number; doubtsAnswered: number; quizAttempts: number }
type Engagement = { dau: number; wau: number; mau: number; stickiness: number; series: EngagementPoint[] }
type Content = {
  generatedAt: string
  notes: { created: number; public: number; unlisted: number; shared: number; private: number }
  uploads: { files: number; bytes: string; byPurpose: { purpose: string; files: number; bytes: string }[]; hiddenSmallGroups: number }
  scans: { clean: number; infected: number; failed: number; pending: number }
  doubts: { asked: number; answered: number; resolved: number; answers: number; medianHoursToFirstAnswer: number | null }
  places: { groups: number; classrooms: number; groupPosts: number; classroomPosts: number }
  sharing: { noteShares: number; placeShares: number; saves: number }
}
type Subjects = { by: string; subjects: { subjectId: string; title: string; value: number; users: number }[]; hiddenSmallGroups: number }
type Verification = { requested: number; approved: number; rejected: number; pending: number; medianHoursToDecision: number | null; oldestPendingHours: number | null; byMethod: { method: string; requested: number; approved: number; rejected: number }[]; hiddenSmallGroups: number }

describe('admin usage metrics', () => {
  let t: TestApp
  let db: PrismaService
  let adminToken: string
  let studentToken: string
  let teacherToken: string
  const emails: string[] = []
  const today = istDay(new Date())
  const D1 = shift(today, -3)
  const D2 = shift(today, -2)
  const firstDay = shift(today, -9)
  const window = { from: at(firstDay, '00:00').toISOString(), to: new Date().toISOString() }
  let physics: { id: string; title: string }

  const person = async (data: { createdAt?: Date; emailVerifiedAt?: Date | null; registrationCompletedAt?: Date | null; verifiedAt?: Date | null; deletedAt?: Date | null; analyticsOptOut?: boolean } = {}) => {
    const id = newId()
    const email = `metric-${id.slice(-12)}@example.com`
    emails.push(email)
    await db.user.create({ data: { id, email, handle: `metric${id.slice(-12)}`, displayName: 'Metric Person', ...data, ...(data.verifiedAt ? { verificationMethod: 'INSTITUTIONAL_EMAIL' as const } : {}) } })
    return id
  }
  const session = (userId: string, createdAt: Date) =>
    db.session.create({ data: { id: newId(), userId, familyId: newId(), refreshTokenHash: randomBytes(32), createdAt, expiresAt: new Date(Date.now() + 30 * DAY_MS) } })
  const note = async (ownerId: string, data: { visibility?: 'PUBLIC' | 'PRIVATE'; createdAt?: Date; deletedAt?: Date; topicId?: string } = {}) => {
    const id = newId()
    await db.note.create({ data: { id, ownerId, title: 'Metric note', visibility: data.visibility ?? 'PRIVATE', createdAt: data.createdAt ?? at(D2, '14:00'), deletedAt: data.deletedAt, ...(data.topicId ? { topics: { create: [{ topicId: data.topicId }] } } : {}) } })
    return id
  }
  const file = (ownerId: string, data: { purpose?: 'ATTACHMENT' | 'VOICE_NOTE' | 'EXPORT'; status?: 'READY' | 'PENDING' | 'QUARANTINED'; scanResult?: 'CLEAN' | 'INFECTED' | 'FAILED' | 'PENDING'; sizeBytes?: bigint; deletedAt?: Date }) =>
    db.fileObject.create({
      data: {
        id: newId(),
        ownerId,
        parentType: 'NOTE',
        purpose: data.purpose ?? 'ATTACHMENT',
        bucket: 'lvn-files',
        storageKey: `development/${ownerId}/${newId()}/original`,
        mimeType: 'image/png',
        sizeBytes: data.sizeBytes ?? 100n,
        originalFileName: 'm.png',
        status: data.status ?? 'READY',
        scanResult: data.scanResult,
        createdAt: at(D2, '15:00'),
        deletedAt: data.deletedAt,
      },
    })

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const admin = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    adminToken = tokenFor(t.config, admin.id, undefined, ['PLATFORM_ADMIN'])
    const student = await seedUser(t.app)
    studentToken = tokenFor(t.config, student.id)
    const teacher = await seedUser(t.app, { globalRole: 'TEACHER', verified: true })
    teacherToken = tokenFor(t.config, teacher.id, undefined, ['TEACHER'])
    emails.push(admin.email, student.email, teacher.email)

    // Growth. Seven email sign-ups on D1 (one links Google two hours later: still EMAIL), five Google and one GitHub on D2.
    const u: string[] = []
    for (let i = 0; i < 7; i++)
      u.push(
        await person({
          createdAt: at(D1, '10:00'),
          emailVerifiedAt: i < 3 ? at(D2, '11:00') : null,
          registrationCompletedAt: i < 2 ? at(D2, '12:00') : null,
          verifiedAt: i < 1 ? at(D2, '13:00') : null,
        }),
      )
    await db.oAuthAccount.create({ data: { id: newId(), userId: u[0]!, provider: 'GOOGLE', providerSubject: `late-${u[0]}`, createdAt: at(D1, '12:00') } })
    const g: string[] = []
    for (let i = 0; i < 5; i++) {
      const id = await person({ createdAt: at(D2, '09:00'), emailVerifiedAt: at(D2, '09:00') })
      await db.oAuthAccount.create({ data: { id: newId(), userId: id, provider: 'GOOGLE', providerSubject: `g-${id}`, createdAt: at(D2, '09:00') } })
      g.push(id)
    }
    const gh = await person({ createdAt: at(D2, '09:00'), emailVerifiedAt: at(D2, '09:00') })
    await db.oAuthAccount.create({ data: { id: newId(), userId: gh, provider: 'GITHUB', providerSubject: `gh-${gh}`, createdAt: at(D2, '09:00') } })
    const gone = await person({ createdAt: at(D1, '10:00'), deletedAt: new Date() })

    // Engagement: sessions, a usage event and learning days.
    const [e1, e2, e3, e4, e5] = [await person(), await person(), await person(), await person(), await person()]
    const optedOut = await person({ analyticsOptOut: true })
    await session(e1, at(D1, '15:00'))
    await session(e1, at(D2, '15:00'))
    await session(e1, new Date())
    await session(e2, at(D2, '16:00'))
    await db.usageEvent.create({ data: { id: newId(), occurredAt: at(D2, '17:00'), userId: e3, name: 'page_view', platform: 'WEB' } })
    await db.learningDay.create({ data: { userId: e4, day: dateOnly(D1), learningSeconds: 90, events: 1 } })
    await db.learningDay.create({ data: { userId: e4, day: dateOnly(D2), learningSeconds: 600, events: 3 } })
    // Only imported old-site time: nobody did anything.
    await db.learningDay.create({ data: { userId: e5, day: dateOnly(D2), legacyLearningSeconds: 1000, events: 0 } })
    // Opted out: their minutes are counted, they are not.
    await session(optedOut, at(D2, '10:00'))
    await db.learningDay.create({ data: { userId: optedOut, day: dateOnly(D2), learningSeconds: 300, events: 2 } })
    await session(gone, at(D2, '10:00'))

    // Notes and subjects.
    const slug = `metrics-${newId().slice(-8)}`
    physics = { id: newId(), title: `Metrics Physics ${slug}` }
    const chemistry = { id: newId(), slug: `${slug}-chem` }
    await db.subject.create({ data: { id: physics.id, slug, title: physics.title, position: 900 } })
    await db.subject.create({ data: { id: chemistry.id, slug: chemistry.slug, title: 'Metrics Chemistry', position: 901 } })
    const t1 = newId()
    const t2 = newId()
    await db.topic.create({ data: { id: t1, subjectId: physics.id, slug: 'motion', title: 'Motion', origin: 'CURATED' } })
    await db.topic.create({ data: { id: t2, subjectId: chemistry.id, slug: 'bonds', title: 'Bonds', origin: 'CURATED' } })
    await note(e1, { visibility: 'PUBLIC' })
    await note(e1)
    await note(e1, { deletedAt: new Date() })
    await note(STUDY_PUBLISHER_ID, { visibility: 'PUBLIC' })
    const physicsNotes: string[] = []
    for (let i = 0; i < 5; i++) physicsNotes.push(await note(u[i]!, { topicId: t1 }))
    const chemistryNote = await note(u[5]!, { topicId: t2 })
    await note(u[5]!, { topicId: t2 })
    await note(u[6]!, { topicId: t2 })

    // Doubts in a group workspace. The asker's own answer is not the first answer.
    const group = newId()
    await db.group.create({ data: { id: group, name: 'Metric group', ownerId: admin.id } })
    await db.group.create({ data: { id: newId(), name: 'Gone group', ownerId: admin.id, deletedAt: new Date() } })
    const doubt1 = newId()
    const doubt2 = newId()
    const deletedDoubt = newId()
    await db.doubt.create({ data: { id: doubt1, groupId: group, authorId: e1, title: 'Why?', body: {}, createdAt: at(D1, '10:00'), status: 'RESOLVED', resolvedAt: at(D2, '09:00') } })
    await db.doubt.create({ data: { id: doubt2, groupId: group, authorId: e2, title: 'How?', body: {}, createdAt: at(D2, '10:00') } })
    await db.doubt.create({ data: { id: deletedDoubt, groupId: group, authorId: e2, title: 'Gone', body: {}, createdAt: at(D2, '11:00'), deletedAt: new Date() } })
    await db.doubtAnswer.createMany({
      data: [
        { id: newId(), doubtId: doubt1, authorId: e1, body: {}, createdAt: at(D1, '11:00') },
        { id: newId(), doubtId: doubt1, authorId: e2, body: {}, createdAt: at(D1, '14:00') },
        { id: newId(), doubtId: doubt2, authorId: e1, body: {}, createdAt: at(D2, '16:00') },
        { id: newId(), doubtId: deletedDoubt, authorId: e1, body: {}, createdAt: at(D2, '12:00') },
      ],
    })
    await db.groupPost.create({ data: { id: newId(), groupId: group, authorId: e1, body: {}, createdAt: at(D2, '13:00') } })

    // Quiz attempts: one class quiz on D1, two shared-quiz attempts on D2.
    const classroom = newId()
    await db.classroom.create({ data: { id: classroom, name: 'Metric class', joinCode: `MTR${newId().slice(-5).toUpperCase()}`, ownerId: admin.id } })
    const classQuiz = newId()
    await db.classQuiz.create({ data: { id: classQuiz, classroomId: classroom, authorId: admin.id, title: 'Class quiz' } })
    await db.quizAttempt.create({ data: { id: newId(), quizId: classQuiz, userId: e1, clientOpId: newId(), score: 1, total: 2, submittedAt: at(D1, '18:00') } })
    const shared = newId()
    await db.sharedQuiz.create({ data: { id: shared, ownerId: admin.id, title: 'Shared quiz', linkToken: `metric-${newId()}` } })
    for (const who of [e2, e3]) await db.sharedQuizAttempt.create({ data: { id: newId(), quizId: shared, userId: who, clientOpId: newId(), score: 2, total: 2, submittedAt: at(D2, '18:00') } })

    // Sharing and saves. A CONNECTIONS row is a fan-out of one owner's choice, not a share.
    await db.noteShare.create({ data: { noteId: physicsNotes[0]!, userId: e1, role: 'VIEWER', source: 'DIRECT', createdById: u[0]!, createdAt: at(D2, '15:00') } })
    await db.noteShare.create({ data: { noteId: physicsNotes[0]!, userId: e2, role: 'VIEWER', source: 'CONNECTIONS', createdById: u[0]!, createdAt: at(D2, '15:00') } })
    await db.groupRead.upsert({ where: { id: group }, create: { id: group }, update: {} })
    await db.groupShare.create({ data: { noteId: physicsNotes[0]!, groupId: group, sharedById: u[0]!, createdAt: at(D2, '15:00') } })
    for (const who of g) await db.noteSave.create({ data: { noteId: physicsNotes[0]!, userId: who, createdAt: at(D2, '16:00') } })
    await db.noteSave.create({ data: { noteId: chemistryNote, userId: e1, createdAt: at(D2, '16:00') } })

    // Uploads: five attachments from five people, two voice notes from one; pending, export and deleted files are not uploads.
    await file(g[0]!, { scanResult: 'CLEAN' })
    await file(g[1]!, { scanResult: 'CLEAN' })
    await file(g[2]!, { scanResult: 'CLEAN' })
    await file(g[3]!, { scanResult: 'FAILED' })
    await file(g[4]!, { scanResult: 'INFECTED', status: 'QUARANTINED' })
    await file(e1, { purpose: 'VOICE_NOTE', sizeBytes: 50n, scanResult: 'PENDING' })
    await file(e1, { purpose: 'VOICE_NOTE', sizeBytes: 50n, scanResult: 'PENDING' })
    await file(e1, { status: 'PENDING' })
    await file(e1, { purpose: 'EXPORT' })
    await file(e1, { deletedAt: new Date() })

    // Learning time per subject: five learners on a physics topic, two on chemistry's /core page, one unknown key.
    for (const who of g) await db.learningDayTopic.create({ data: { userId: who, day: dateOnly(D2), topicKey: `topic:${t1}`, seconds: 120, events: 1 } })
    for (const who of [u[5]!, u[6]!]) await db.learningDayTopic.create({ data: { userId: who, day: dateOnly(D2), topicKey: `core:${chemistry.slug}/bonds`, seconds: 300, events: 1 } })
    await db.learningDayTopic.create({ data: { userId: u[0]!, day: dateOnly(D2), topicKey: 'core:no-such-subject/x', seconds: 999, events: 1 } })

    // Verification requests.
    const request = (userId: string, method: 'DOCUMENTS' | 'INSTITUTIONAL_EMAIL' | 'TEACHER', status: 'PENDING' | 'APPROVED' | 'REJECTED', createdAt: Date, decidedAt: Date | null = null, collegeIdCard = false) =>
      db.verificationRequest.create({ data: { id: newId(), userId, method, status, createdAt, decidedAt, collegeIdCard } })
    await request(u[0]!, 'DOCUMENTS', 'APPROVED', at(D1, '10:00'), at(D1, '12:00'))
    await request(u[1]!, 'INSTITUTIONAL_EMAIL', 'REJECTED', at(D1, '10:00'), at(D2, '10:00'))
    await request(u[2]!, 'DOCUMENTS', 'PENDING', at(D2, '09:00'), null, true)
    await request(u[3]!, 'TEACHER', 'PENDING', new Date(Date.now() - 20 * DAY_MS))
    for (const who of g) await request(who, 'DOCUMENTS', 'APPROVED', at(D2, '10:00'), at(D2, '11:00'))
  })

  afterAll(() => t.close())

  it('counts sign-ups per IST day and splits them by method, hiding a method under 5 accounts', async () => {
    const res = await t.gql<{ adminGrowth: Growth }>(GROWTH, window, adminToken)
    expect(res.errors).toBeUndefined()
    const growth = res.data!.adminGrowth
    expect(growth.range).toMatchObject({ firstDay, lastDay: today, timeZone: 'Asia/Kolkata', from: at(firstDay, '00:00').toISOString() })
    expect(growth.interval).toBe('DAY')
    expect(growth.series.map((p) => p.date)).toEqual(Array.from({ length: 10 }, (_, i) => shift(firstDay, i)))
    expect(growth.series.find((p) => p.date === D1)).toEqual({ date: D1, signUps: 7, emailVerified: 0, registrationsCompleted: 0, verifications: 0 })
    expect(growth.series.find((p) => p.date === D2)).toEqual({ date: D2, signUps: 6, emailVerified: 9, registrationsCompleted: 2, verifications: 1 })
    expect(growth.totals.signUps).toBe(growth.series.reduce((sum, p) => sum + p.signUps, 0))
    const created = await db.user.count({ where: { deletedAt: null, createdAt: { gte: new Date(window.from) } } })
    expect(growth.totals.signUps).toBe(created)
    expect(growth.signUpMethods).toEqual([
      { method: 'EMAIL', users: created - 6 },
      { method: 'GOOGLE', users: 5 },
    ])
    expect(growth.hiddenSmallGroups).toBe(1)
    for (const email of emails) expect(JSON.stringify(growth)).not.toContain(email)

    const weekly = (await t.gql<{ adminGrowth: Growth }>(GROWTH, { ...window, interval: 'WEEK' }, adminToken)).data!.adminGrowth
    expect(weekly.interval).toBe('WEEK')
    expect(weekly.series[0]!.date).toBe(firstDay)
    for (const p of weekly.series.slice(1)) expect(new Date(`${p.date}T00:00:00Z`).getUTCDay()).toBe(1)
    expect(weekly.series.reduce((sum, p) => sum + p.signUps, 0)).toBe(growth.totals.signUps)
  })

  it('counts active people from sessions, usage events and learning days, never opted-out or deleted accounts', async () => {
    const res = await t.gql<{ adminEngagement: Engagement }>(ENGAGEMENT, window, adminToken)
    expect(res.errors).toBeUndefined()
    const e = res.data!.adminEngagement
    expect(e.series).toHaveLength(10)
    expect(e.series.find((p) => p.date === D1)).toEqual({ date: D1, activeUsers: 2, learningMinutes: 2, notesCreated: 0, doubtsAsked: 1, doubtsAnswered: 1, quizAttempts: 1 })
    expect(e.series.find((p) => p.date === D2)).toEqual({ date: D2, activeUsers: 4, learningMinutes: 15, notesCreated: 10, doubtsAsked: 1, doubtsAnswered: 1, quizAttempts: 2 })
    expect(e.series.find((p) => p.date === today)).toMatchObject({ activeUsers: 1 })
    // Person-days in the last 30: 2 + 4 + 1 over MAU 4.
    expect(e).toMatchObject({ dau: 1, wau: 4, mau: 4, stickiness: Math.round((7 / 30 / 4) * 1000) / 1000 })
  })

  it('counts what was created: notes, uploads, scans, doubts, places and sharing', async () => {
    const res = await t.gql<{ adminContentStats: Content }>(CONTENT, window, adminToken)
    expect(res.errors).toBeUndefined()
    const c = res.data!.adminContentStats
    expect(c.notes).toEqual({ created: 10, public: 1, unlisted: 0, shared: 0, private: 9 })
    expect(c.uploads).toEqual({ files: 7, bytes: '600', byPurpose: [{ purpose: 'ATTACHMENT', files: 5, bytes: '500' }], hiddenSmallGroups: 1 })
    expect(c.scans).toEqual({ clean: 3, infected: 1, failed: 1, pending: 2 })
    expect(c.doubts).toEqual({ asked: 2, answered: 2, resolved: 1, answers: 3, medianHoursToFirstAnswer: 5 })
    expect(c.places).toEqual({ groups: 1, classrooms: 1, groupPosts: 1, classroomPosts: 0 })
    expect(c.sharing).toEqual({ noteShares: 1, placeShares: 1, saves: 6 })
  })

  it('ranks subjects and hides a subject with fewer than 5 people behind it', async () => {
    const top = async (by: string) => {
      const res = await t.gql<{ adminTopSubjects: Subjects }>(SUBJECTS, { ...window, by }, adminToken)
      expect(res.errors).toBeUndefined()
      return res.data!.adminTopSubjects
    }
    expect(await top('NOTES')).toMatchObject({ by: 'NOTES', subjects: [{ subjectId: physics.id, title: physics.title, value: 5, users: 5 }], hiddenSmallGroups: 1 })
    expect(await top('SAVES')).toMatchObject({ by: 'SAVES', subjects: [{ subjectId: physics.id, title: physics.title, value: 5, users: 5 }], hiddenSmallGroups: 1 })
    expect(await top('LEARNING_TIME')).toMatchObject({ by: 'LEARNING_TIME', subjects: [{ subjectId: physics.id, title: physics.title, value: 10, users: 5 }], hiddenSmallGroups: 1 })
    const bad = await t.gql(SUBJECTS, { ...window, by: 'NOTES', first: 51 }, adminToken)
    expect(bad.errors?.[0]?.extensions.code).toBe('VALIDATION')
  })

  it('counts verification requests, decisions and the queue now', async () => {
    const res = await t.gql<{ adminVerificationStats: Verification }>(VERIFICATION, window, adminToken)
    expect(res.errors).toBeUndefined()
    const v = res.data!.adminVerificationStats
    expect(v).toMatchObject({ requested: 8, approved: 6, rejected: 1, pending: 2, medianHoursToDecision: 1, hiddenSmallGroups: 2 })
    expect(v.byMethod).toEqual([{ method: 'DOCUMENTS', requested: 6, approved: 6, rejected: 0 }])
    expect(v.oldestPendingHours).toBeGreaterThanOrEqual(20 * 24 - 1)
    expect(v.oldestPendingHours).toBeLessThan(20 * 24 + 1)
  })

  it('refuses more than 366 days and reuses a result for about 5 minutes', async () => {
    const long = await t.gql(GROWTH, { from: new Date(Date.now() - 400 * DAY_MS).toISOString() }, adminToken)
    expect(long.errors?.[0]?.extensions.code).toBe('VALIDATION')
    const first = (await t.gql<{ adminContentStats: Content }>(CONTENT, window, adminToken)).data!.adminContentStats
    await db.note.create({ data: { id: newId(), ownerId: STUDY_PUBLISHER_ID.replace(/1$/, '2'), title: 'Late', createdAt: at(D2, '20:00') } })
    const second = (await t.gql<{ adminContentStats: Content }>(CONTENT, window, adminToken)).data!.adminContentStats
    expect(second.generatedAt).toBe(first.generatedAt)
    expect(second.notes.created).toBe(first.notes.created)
  })

  it('is platform-admin only', async () => {
    const queries: [string, object][] = [
      [GROWTH, window],
      [ENGAGEMENT, window],
      [CONTENT, window],
      [SUBJECTS, { ...window, by: 'NOTES' }],
      [VERIFICATION, window],
    ]
    for (const [query, variables] of queries) {
      expect((await t.gql(query, variables)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
      for (const token of [studentToken, teacherToken]) expect((await t.gql(query, variables, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    }
    expect((await t.gql(FUNNEL, { steps: ['signed_up'] }, studentToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
  })

  it('gives the same numbers from the daily rollup as from the tables, and reads past days from it (ADR-0106)', async () => {
    const queries: [string, string, object][] = [
      ['adminGrowth', GROWTH, window],
      ['adminGrowth', GROWTH, { ...window, interval: 'WEEK' }],
      ['adminEngagement', ENGAGEMENT, window],
      ['adminEngagement', ENGAGEMENT, { ...window, interval: 'WEEK' }],
      ['adminContentStats', CONTENT, window],
      ['adminVerificationStats', VERIFICATION, window],
    ]
    // When it was computed, and the queue's age now, move between two reads; nothing else may.
    const settled = (value: unknown) => JSON.parse(JSON.stringify(value, (key, v) => (key === 'generatedAt' || key === 'oldestPendingHours' ? undefined : v)))
    const read = (app: TestApp) =>
      Promise.all(
        queries.map(async ([name, query, variables]) => {
          const res = await app.gql<Record<string, unknown>>(query, variables, adminToken)
          expect(res.errors).toBeUndefined()
          return settled(res.data![name])
        }),
      )
    // Fresh API processes on the same database, so no result is cached from before.
    const live = await createTestApp({}, { resetDatabase: false })
    const rolled = await createTestApp({}, { resetDatabase: false })
    try {
      expect(await db.dailyMetric.count()).toBe(0)
      const fromTables = await read(live)

      const yesterday = shift(today, -1)
      const report = await t.app.get(UsersMaintenance).backfillMetrics(shift(today, -45), yesterday)
      expect(report).toMatchObject({ fromDay: shift(today, -45), toDay: yesterday, days: 45 })
      expect(await db.dailyMetric.count({ where: { metric: '_rollup', dimension: 'day' } })).toBe(45)
      expect(await db.dailyMetric.count({ where: { day: { gte: dateOnly(today) } } })).toBe(0)
      // Counts only: no account id or email in any row.
      for (const row of await db.dailyMetric.findMany()) {
        expect(row.dimension).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
        expect(row.dimension).not.toContain('@')
      }

      expect(await read(rolled)).toEqual(fromTables)

      // Past days are read from the rollup: a stored count changed by hand shows.
      const d1 = { day: dateOnly(D1), metric: 'sign_ups', dimension: '' }
      await db.dailyMetric.update({ where: { day_metric_dimension: d1 }, data: { value: 107n } })
      const fromD1 = { from: at(D1, '00:00').toISOString(), to: window.to }
      const tampered = (await rolled.gql<{ adminGrowth: Growth }>(GROWTH, fromD1, adminToken)).data!.adminGrowth
      expect(tampered.series[0]).toMatchObject({ date: D1, signUps: 107 })
      // A day without its marker is counted from the tables again.
      await db.dailyMetric.delete({ where: { day_metric_dimension: { day: dateOnly(D1), metric: '_rollup', dimension: 'day' } } })
      const again = (await rolled.gql<{ adminGrowth: Growth }>(GROWTH, { ...fromD1, to: at(D2, '12:00').toISOString() }, adminToken)).data!.adminGrowth
      expect(again.series).toEqual([
        { date: D1, signUps: 7, emailVerified: 0, registrationsCompleted: 0, verifications: 0 },
        { date: D2, signUps: 6, emailVerified: 9, registrationsCompleted: 2, verifications: 1 },
      ])
    } finally {
      await live.close()
      await rolled.close()
    }
  })
})

describe('adminFunnel database steps', () => {
  let t: TestApp
  let db: PrismaService
  let adminToken: string
  const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY_MS + hours * 3_600_000)

  const person = async (data: { createdAt: Date; emailVerifiedAt?: Date; deletedAt?: Date; analyticsOptOut?: boolean }) => {
    const id = newId()
    await db.user.create({ data: { id, email: `funnel-${id.slice(-12)}@example.com`, handle: `funnel${id.slice(-12)}`, displayName: 'Funnel Person', ...data } })
    return id
  }
  const note = (ownerId: string, createdAt: Date) => db.note.create({ data: { id: newId(), ownerId, title: 'First', createdAt } })
  const session = (userId: string, createdAt: Date) =>
    db.session.create({ data: { id: newId(), userId, familyId: newId(), refreshTokenHash: randomBytes(32), createdAt, expiresAt: new Date(Date.now() + 30 * DAY_MS) } })

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    // The admin signed up now and has not verified the login email.
    const admin = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    adminToken = tokenFor(t.config, admin.id, undefined, ['PLATFORM_ADMIN'])
    const signed = ago(20)
    const verified = ago(20, 1)
    // f1: every step; came back with a session 10 days ago, after the first note.
    const f1 = await person({ createdAt: signed, emailVerifiedAt: verified })
    await note(f1, ago(19))
    await session(f1, ago(10))
    await db.usageEvent.create({ data: { id: newId(), occurredAt: ago(9), userId: f1, name: 'page_view', platform: 'WEB' } })
    // f2: every step; came back by learning 12 days ago.
    const f2 = await person({ createdAt: signed, emailVerifiedAt: verified })
    await note(f2, ago(19))
    await db.learningDay.create({ data: { userId: f2, day: new Date(`${istDay(ago(12))}T00:00:00Z`), learningSeconds: 60, events: 2 } })
    // f3: back only 5 days after signing up: not a return after a week.
    const f3 = await person({ createdAt: signed, emailVerifiedAt: verified })
    await note(f3, ago(19))
    await session(f3, ago(15))
    // f4: no note. f5: never verified.
    await person({ createdAt: signed, emailVerifiedAt: verified })
    await person({ createdAt: signed })
    // f6: opted out of analytics: left out of every database step.
    const f6 = await person({ createdAt: signed, emailVerifiedAt: verified, analyticsOptOut: true })
    await note(f6, ago(19))
    await session(f6, ago(8))
    // f7: signed up before the window. f8: deleted.
    await person({ createdAt: ago(40), emailVerifiedAt: ago(40) })
    await person({ createdAt: signed, emailVerifiedAt: verified, deletedAt: new Date() })
    // f9: back 10 days ago, but the first note came 5 days ago and nothing after it: the steps are ordered.
    const f9 = await person({ createdAt: signed, emailVerifiedAt: verified })
    await note(f9, ago(5))
    await session(f9, ago(10))
  })

  afterAll(() => t.close())

  it('follows people from sign-up to a return after a week, in order', async () => {
    const res = await t.gql<{ adminFunnel: { name: string; users: number }[] }>(FUNNEL, { steps: ['signed_up', 'email_verified', 'first_note', 'returned_d7'], since: ago(30).toISOString() }, adminToken)
    expect(res.errors).toBeUndefined()
    expect(res.data!.adminFunnel).toEqual([
      { name: 'signed_up', users: 7 },
      { name: 'email_verified', users: 5 },
      { name: 'first_note', users: 4 },
      { name: 'returned_d7', users: 2 },
    ])
  })

  it('mixes database steps with usage events and refuses unknown steps', async () => {
    const mixed = await t.gql<{ adminFunnel: { name: string; users: number }[] }>(FUNNEL, { steps: ['signed_up', 'page_view'], since: ago(30).toISOString() }, adminToken)
    expect(mixed.data!.adminFunnel).toEqual([
      { name: 'signed_up', users: 7 },
      { name: 'page_view', users: 1 },
    ])
    const events = await t.gql<{ adminFunnel: { name: string; users: number }[] }>(FUNNEL, { steps: ['page_view'] }, adminToken)
    expect(events.data!.adminFunnel).toEqual([{ name: 'page_view', users: 1 }])
    const unknown = await t.gql(FUNNEL, { steps: ['signed_up', 'teleported'] }, adminToken)
    expect(unknown.errors?.[0]?.extensions.code).toBe('VALIDATION')
    expect(unknown.errors?.[0]?.message).toContain('returned_d7')
  })
})

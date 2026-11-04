import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Admin dashboard (ADR-0101): counts, every application setting, and plan prices.
 * Prices are stored only. Nothing is charged.
 */

const METRICS = `query ($from: DateTime, $to: DateTime) { adminMetrics(from: $from, to: $to) {
  generatedAt
  users { total newLast7Days newLast30Days active }
  content { notes publicNotes subjects topics groups classrooms }
  ai { from to tasksRun failures promptTokens completionTokens costMicroUsd
    byProvider { provider tasksRun failures promptTokens completionTokens costMicroUsd }
    byModel { provider model tasksRun failures costMicroUsd }
    byTask { task tasksRun failures } }
  storage { bytes files }
  verification { studentIdQueue pendingRequests domainReviews }
  moderation { openReports openAppeals }
  scans { pending failed } } }`
const SETTINGS = `{ adminSettings { key type category description value overridden updatedAt constraints { min max nullable } } }`
const SET = `mutation ($input: UpdateAdminSettingInput!) { updateAdminSetting(input: $input) { setting { key value overridden } userErrors { code message field } } }`
const RESET = `mutation ($key: String!) { resetAdminSetting(key: $key) { setting { key value overridden } userErrors { code message } } }`
const PLANS = `{ adminPlans { id code name priceMinor currency interval active features subscriberCount entitlements { key limit appliesToRole } } }`
const CREATE = `mutation ($input: CreateAdminPlanInput!) { createAdminPlan(input: $input) { plan { id code priceMinor currency interval active subscriberCount entitlements { key limit appliesToRole } } userErrors { code message field } } }`
const UPDATE = `mutation ($input: UpdateAdminPlanInput!) { updateAdminPlan(input: $input) { plan { id name priceMinor active } userErrors { code message field } } }`
const DELETE = `mutation ($id: UUID!) { deleteAdminPlan(id: $id) { ok userErrors { code message } } }`

type Metrics = {
  generatedAt: string
  users: { total: number; newLast7Days: number; newLast30Days: number; active: number }
  content: { notes: number; publicNotes: number; subjects: number; topics: number; groups: number; classrooms: number }
  ai: { tasksRun: number; failures: number; promptTokens: string; completionTokens: string; costMicroUsd: string; byProvider: { provider: string; tasksRun: number; failures: number; promptTokens: string; completionTokens: string; costMicroUsd: string }[]; byModel: { provider: string; model: string; costMicroUsd: string }[]; byTask: { task: string; tasksRun: number; failures: number }[] }
  storage: { bytes: string; files: number }
  verification: { studentIdQueue: number; pendingRequests: number; domainReviews: number }
  moderation: { openReports: number; openAppeals: number }
  scans: { pending: number; failed: number }
}
type Err = { code: string; message: string; field?: string[] | null }
type Setting = { key: string; type: string; value: string; overridden: boolean; description: string; constraints: { min: number | null; nullable: boolean } }

describe('admin dashboard', () => {
  let t: TestApp
  let db: PrismaService
  let admin: { id: string; token: string; email: string }
  let student: { id: string; token: string; email: string }
  let teacherToken: string
  const from = new Date(Date.now() - 20 * 86_400_000).toISOString()
  const to = new Date(Date.now() + 2 * 86_400_000).toISOString()
  const window = { from, to }

  const metrics = (token?: string) => t.gql<{ adminMetrics: Metrics }>(METRICS, window, token)

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const a = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    admin = { id: a.id, token: tokenFor(t.config, a.id, undefined, ['PLATFORM_ADMIN']), email: a.email }
    const s = await seedUser(t.app)
    student = { id: s.id, token: tokenFor(t.config, s.id), email: s.email }
    const teacher = await seedUser(t.app, { globalRole: 'TEACHER', verified: true })
    teacherToken = tokenFor(t.config, teacher.id, undefined, ['TEACHER'])

    await db.session.create({ data: { id: newId(), userId: admin.id, familyId: newId(), refreshTokenHash: Buffer.alloc(32, 2), expiresAt: new Date(Date.now() + 86_400_000) } })
    await db.session.create({ data: { id: newId(), userId: student.id, familyId: newId(), refreshTokenHash: Buffer.alloc(32, 3), expiresAt: new Date(Date.now() - 86_400_000) } })
    await db.note.create({ data: { id: newId(), ownerId: student.id, title: 'Visible', visibility: 'PUBLIC' } })
    await db.note.create({ data: { id: newId(), ownerId: student.id, title: 'Gone', deletedAt: new Date() } })
    await db.fileObject.create({ data: { id: newId(), ownerId: student.id, parentType: 'NOTE', purpose: 'ATTACHMENT', bucket: 'lvn-files', storageKey: `development/${student.id}/${newId()}/original`, mimeType: 'image/png', sizeBytes: 1000n, originalFileName: 'a.png', status: 'READY' } })
    await db.fileObject.create({ data: { id: newId(), ownerId: student.id, parentType: 'NOTE', purpose: 'ATTACHMENT', bucket: 'lvn-files', storageKey: `development/${student.id}/${newId()}/waiting`, mimeType: 'image/png', sizeBytes: 10n, originalFileName: 'w.png', status: 'READY', scanResult: 'PENDING' } })
    await db.fileObject.create({ data: { id: newId(), ownerId: student.id, parentType: 'NOTE', purpose: 'ATTACHMENT', bucket: 'lvn-files', storageKey: `development/${student.id}/${newId()}/gave-up`, mimeType: 'image/png', sizeBytes: 10n, originalFileName: 'f.png', status: 'READY', scanResult: 'FAILED' } })
    await db.fileObject.create({ data: { id: newId(), ownerId: student.id, parentType: 'NOTE', purpose: 'ATTACHMENT', bucket: 'lvn-files', storageKey: `development/${student.id}/${newId()}/pending`, mimeType: 'image/png', sizeBytes: 50n, originalFileName: 'p.png', status: 'PENDING' } })
    await db.group.create({ data: { id: newId(), name: 'Metric group', ownerId: admin.id } })
    await db.classroom.create({ data: { id: newId(), name: 'Metric class', joinCode: 'METRIC01', ownerId: admin.id } })
    await db.verificationRequest.create({ data: { id: newId(), userId: student.id, method: 'DOCUMENTS', collegeIdCard: true, status: 'PENDING' } })
    await db.domainReview.create({ data: { domain: 'metric.test', status: 'NEEDS_REVIEW' } })
    await db.report.create({ data: { id: newId(), entityType: 'USER', entityId: student.id, reason: 'SPAM', status: 'OPEN' } })
    await db.moderationAppeal.create({ data: { id: newId(), entityType: 'USER', entityId: student.id, userId: student.id, message: 'Please look again', status: 'OPEN' } })
    await db.aiUsage.create({ data: { id: newId(), task: 'SUMMARIZE', provider: 'OLLAMA', model: 'gemma4', promptTokens: 10, completionTokens: 5, costMicroUsd: 7, latencyMs: 3, ok: true } })
    await db.aiUsage.create({ data: { id: newId(), task: 'QUIZ', provider: 'OPENAI', model: 'gpt-test', promptTokens: 4, completionTokens: 1, costMicroUsd: 9, latencyMs: 3, ok: false } })
  })

  afterAll(() => t.close())

  it('counts what is stored and leaves personal data out', async () => {
    const res = await metrics(admin.token)
    expect(res.errors).toBeUndefined()
    const data = res.data!.adminMetrics
    expect(JSON.stringify(data)).not.toContain(student.email)
    expect(JSON.stringify(data)).not.toContain(admin.email)
    expect(data.users).toEqual({
      total: await db.user.count({ where: { deletedAt: null } }),
      newLast7Days: await db.user.count({ where: { deletedAt: null, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
      newLast30Days: await db.user.count({ where: { deletedAt: null, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      active: 1,
    })
    expect(data.content).toEqual({
      notes: await db.note.count({ where: { deletedAt: null } }),
      publicNotes: await db.note.count({ where: { deletedAt: null, visibility: 'PUBLIC' } }),
      subjects: await db.subject.count(),
      topics: await db.topic.count(),
      groups: 1,
      classrooms: 1,
    })
    expect(data.storage).toEqual({ bytes: '1020', files: 3 })
    expect(data.verification).toEqual({ studentIdQueue: 1, pendingRequests: 1, domainReviews: 1 })
    expect(data.moderation).toEqual({ openReports: 1, openAppeals: 1 })
    expect(data.scans).toEqual({ pending: 1, failed: 1 })
    expect(data.ai.tasksRun).toBe(2)
    expect(data.ai.failures).toBe(1)
    expect(data.ai.promptTokens).toBe('14')
    expect(data.ai.completionTokens).toBe('6')
    expect(data.ai.costMicroUsd).toBe('16')
    expect(data.ai.byProvider.find((row) => row.provider === 'OLLAMA')).toMatchObject({ tasksRun: 1, failures: 0, promptTokens: '10', completionTokens: '5', costMicroUsd: '7' })
    expect(data.ai.byModel.find((row) => row.model === 'gpt-test')).toMatchObject({ provider: 'OPENAI', costMicroUsd: '9' })
    expect(data.ai.byTask.find((row) => row.task === 'QUIZ')).toMatchObject({ tasksRun: 1, failures: 1 })
  })

  it('reuses the aggregate for about a minute', async () => {
    const first = (await metrics(admin.token)).data!.adminMetrics
    await db.aiUsage.create({ data: { id: newId(), task: 'ASK', provider: 'OLLAMA', model: 'gemma4', promptTokens: 100, completionTokens: 0, costMicroUsd: 1, latencyMs: 1, ok: true } })
    const second = (await metrics(admin.token)).data!.adminMetrics
    expect(second.generatedAt).toBe(first.generatedAt)
    expect(second.ai.tasksRun).toBe(first.ai.tasksRun)
  })

  it('is platform-admin only', async () => {
    expect((await metrics()).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    for (const token of [student.token, teacherToken]) {
      expect((await metrics(token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(SETTINGS, {}, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(PLANS, {}, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(SET, { input: { key: 'uploads_enabled', value: 'false' } }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(RESET, { key: 'uploads_enabled' }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(CREATE, { input: { code: 'NOPE', name: 'Nope', priceMinor: 0, currency: 'INR', interval: 'NONE' } }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(DELETE, { id: '01920000-0000-7000-8000-000000000001' }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    }
  })

  it('lists every setting and applies a saved value over the environment', async () => {
    const listed = (await t.gql<{ adminSettings: Setting[] }>(SETTINGS, {}, admin.token)).data!.adminSettings
    const byKey = new Map(listed.map((row) => [row.key, row]))
    // resetDatabase truncates AppSetting, so the migration's google_sign_in row is gone. A missing row is on.
    expect(byKey.get('google_sign_in')).toMatchObject({ type: 'BOOLEAN', category: 'auth', value: 'true', overridden: false })
    expect(byKey.get('google_sign_in')!.description.length).toBeGreaterThan(10)
    expect(byKey.get('student_id_verification')).toMatchObject({ value: 'false' })
    expect(byKey.get('uploads_enabled')).toMatchObject({ value: 'true', overridden: false })
    expect(byKey.get('account_minimum_age')!.constraints.min).toBe(18)
    expect(byKey.get('ai_monthly_budget_micro_usd')!.constraints.nullable).toBe(true)

    const off = await t.gql<{ updateAdminSetting: { setting: { value: string; overridden: boolean } | null; userErrors: Err[] } }>(SET, { input: { key: 'uploads_enabled', value: 'false' } }, admin.token)
    expect(off.data!.updateAdminSetting).toEqual({ setting: { key: 'uploads_enabled', value: 'false', overridden: true }, userErrors: [] })
    expect((await t.gql('{ uploadsEnabled }')).data).toEqual({ uploadsEnabled: false })
    expect(await db.auditLog.findFirst({ where: { action: 'settings.updated', actorId: admin.id } })).toMatchObject({ metadata: { key: 'uploads_enabled', value: 'false' } })

    const young = await t.gql<{ updateAdminSetting: { setting: null; userErrors: Err[] } }>(SET, { input: { key: 'account_minimum_age', value: '17' } }, admin.token)
    expect(young.data!.updateAdminSetting.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'value'] })
    const older = await t.gql<{ updateAdminSetting: { userErrors: Err[] } }>(SET, { input: { key: 'account_minimum_age', value: '21' } }, admin.token)
    expect(older.data!.updateAdminSetting.userErrors).toEqual([])
    const signUp = await t.gql<{ signUp: { session: { accessToken: string } | null; userErrors: Err[] } }>(
      `mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken } userErrors { code field } } }`,
      { input: { email: `young-${newId().slice(0, 8)}@example.com`, password: 'a long passphrase for asha', displayName: 'Asha Rao', age: 20, acceptedTermsVersion: '2026-11-03' } },
    )
    expect(signUp.data!.signUp.userErrors[0]!.code).toBe('AGE_RESTRICTED')
    expect(signUp.data!.signUp.session).toBeNull()

    expect((await t.gql(SET, { input: { key: 'not_a_setting', value: 'true' } }, admin.token)).data).toMatchObject({ updateAdminSetting: { setting: null, userErrors: [{ code: 'VALIDATION' }] } })
    const reset = await t.gql<{ resetAdminSetting: { setting: { value: string; overridden: boolean }; userErrors: Err[] } }>(RESET, { key: 'uploads_enabled' }, admin.token)
    expect(reset.data!.resetAdminSetting.userErrors).toEqual([])
    expect(reset.data!.resetAdminSetting.setting).toMatchObject({ value: 'true', overridden: false })
    expect((await t.gql('{ uploadsEnabled }')).data).toEqual({ uploadsEnabled: true })
    await t.gql(RESET, { key: 'account_minimum_age' }, admin.token)
    expect(await db.auditLog.findFirst({ where: { action: 'settings.reset', actorId: admin.id, metadata: { path: ['key'], equals: 'uploads_enabled' } } })).toBeTruthy()
  })

  it('edits plan prices without charging anyone, and keeps FREE', async () => {
    const listed = (await t.gql<{ adminPlans: { code: string; priceMinor: number; currency: string; interval: string; active: boolean; entitlements: { key: string }[] }[] }>(PLANS, {}, admin.token)).data!.adminPlans
    const free = listed.find((plan) => plan.code === 'FREE')!
    expect(free).toMatchObject({ priceMinor: 0, currency: 'INR', interval: 'NONE', active: true })
    expect(free.entitlements.map((row) => row.key)).toEqual(expect.arrayContaining(['STORAGE_BYTES', 'AI_TOKENS_DAILY']))

    const created = await t.gql<{ createAdminPlan: { plan: { id: string; code: string; priceMinor: number; currency: string; interval: string; entitlements: { key: string; limit: string | null; appliesToRole: string | null }[] } | null; userErrors: Err[] } }>(CREATE, {
      input: { code: 'plus', name: 'Plus', priceMinor: 49900, currency: 'inr', interval: 'MONTH', features: ['More AI'], active: true, entitlements: [{ key: 'AI_TOKENS_DAILY', limit: '500000', appliesToRole: 'STUDENT' }] },
    }, admin.token)
    expect(created.data!.createAdminPlan.userErrors).toEqual([])
    const plan = created.data!.createAdminPlan.plan!
    expect(plan).toMatchObject({ code: 'PLUS', priceMinor: 49900, currency: 'INR', interval: 'MONTH' })
    expect(plan.entitlements).toEqual([{ key: 'AI_TOKENS_DAILY', limit: '500000', appliesToRole: 'STUDENT' }])

    const duplicate = await t.gql<{ createAdminPlan: { plan: null; userErrors: Err[] } }>(CREATE, { input: { code: 'PLUS', name: 'Again', priceMinor: 1, currency: 'INR', interval: 'YEAR' } }, admin.token)
    expect(duplicate.data!.createAdminPlan.userErrors[0]!.code).toBe('CONFLICT')

    const updated = await t.gql<{ updateAdminPlan: { plan: { priceMinor: number; name: string }; userErrors: Err[] } }>(UPDATE, { input: { id: plan.id, priceMinor: 59900, name: 'Plus yearly' } }, admin.token)
    expect(updated.data!.updateAdminPlan).toMatchObject({ plan: { priceMinor: 59900, name: 'Plus yearly' }, userErrors: [] })
    expect(await db.auditLog.findFirst({ where: { action: 'plan.updated', targetId: plan.id } })).toMatchObject({ metadata: { priceMinor: 59900 } })

    const freeId = '01920000-0000-7000-8000-000000000001'
    expect((await t.gql<{ deleteAdminPlan: { ok: boolean; userErrors: Err[] } }>(DELETE, { id: freeId }, admin.token)).data!.deleteAdminPlan.userErrors[0]!.code).toBe('VALIDATION')
    expect((await t.gql<{ updateAdminPlan: { userErrors: Err[] } }>(UPDATE, { input: { id: freeId, active: false } }, admin.token)).data!.updateAdminPlan.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'active'] })

    await db.userPlan.create({ data: { userId: student.id, planId: plan.id } })
    expect((await t.gql<{ deleteAdminPlan: { userErrors: Err[] } }>(DELETE, { id: plan.id }, admin.token)).data!.deleteAdminPlan.userErrors[0]!.code).toBe('CONFLICT')
    const held = (await t.gql<{ adminPlans: { code: string; subscriberCount: number }[] }>(PLANS, {}, admin.token)).data!.adminPlans.find((row) => row.code === 'PLUS')
    expect(held!.subscriberCount).toBe(1)
    await db.userPlan.delete({ where: { userId: student.id } })
    expect((await t.gql<{ deleteAdminPlan: { ok: boolean; userErrors: Err[] } }>(DELETE, { id: plan.id }, admin.token)).data!.deleteAdminPlan).toEqual({ ok: true, userErrors: [] })
    expect(await db.plan.findUnique({ where: { id: plan.id } })).toBeNull()
    expect(await db.auditLog.findFirst({ where: { action: 'plan.deleted', targetId: plan.id } })).toMatchObject({ metadata: { code: 'PLUS' } })
  })
})

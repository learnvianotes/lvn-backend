import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { AnalyticsService, IdCardCheckService, UsersMaintenance } from '@lvn-backend/users'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** Manager and teacher review of student verification, domain review, and the errors-dashboard lookup. */

const REQ_DOCS = `mutation ($input: RequestDocumentVerificationInput!) { requestDocumentVerification(input: $input) {
  request { id status } userErrors { code message } } }`
const REVIEW = `mutation ($input: ReviewVerificationRequestInput!) { reviewVerificationRequest(input: $input) {
  request { id status } userErrors { code } } }`
const QUEUE = `{ verificationRequestsToReview { id purpose documents { fileId fileName } } }`
const DOC = `query ($r: UUID!, $f: UUID!) { verificationDocumentUrl(requestId: $r, fileId: $f) { url } }`
const SET_ROLE = `mutation ($u: UUID!, $r: GlobalRole!) { setGlobalRole(input: { userId: $u, role: $r }) { ok userErrors { code } } }`
const APPLY = `mutation ($input: ApplyToTeachInput!) { applyToTeach(input: $input) { request { id purpose } userErrors { code } } }`
const DOMAINS = `query ($status: DomainReviewStatus) { institutionDomains(status: $status) { domain status } }`
const DECIDE_DOMAIN = `mutation ($input: DecideDomainReviewInput!) { reviewInstitutionDomain(input: $input) { ok userErrors { code message } } }`
const LOOKUP = `query ($ids: [UUID!]!) { usersByIds(ids: $ids) { id displayName email globalRole } }`
const SETTINGS = `{ studentIdVerificationSettings { aiCheckEnabled autoApproveOnHighConfidence confidenceThreshold imageRetentionDays } }`
const SAVE = `mutation ($input: UpdateAdminSettingInput!) { updateAdminSetting(input: $input) { setting { key value } userErrors { code message } } }`

describe('manager verification, domains and account lookup', () => {
  let t: TestApp
  let db: PrismaService
  let admin: { id: string; token: string }
  let manager: { id: string; token: string; email: string }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const a = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true, displayName: 'Admin' })
    admin = { id: a.id, token: tokenFor(t.config, a.id, undefined, ['PLATFORM_ADMIN']) }
    const m = await seedUser(t.app, { globalRole: 'MANAGER', verified: true, displayName: 'Mina' })
    manager = { id: m.id, email: m.email, token: tokenFor(t.config, m.id, undefined, ['MANAGER']) }
  })

  afterAll(() => t.close())

  const student = async (name = 'Asha Rao') => {
    const u = await seedUser(t.app, { displayName: name })
    return { id: u.id, token: tokenFor(t.config, u.id), email: u.email, displayName: u.displayName }
  }

  it('lets a manager and a teacher at the institution review student proof, and only an admin grant MANAGER', async () => {
    const s = await student()
    const teacher = await seedUser(t.app, { globalRole: 'TEACHER', verified: true, displayName: 'Prof Rao' })
    const other = await seedUser(t.app, { globalRole: 'TEACHER', verified: true, displayName: 'Other' })
    const teacherToken = tokenFor(t.config, teacher.id, undefined, ['TEACHER'])
    const otherToken = tokenFor(t.config, other.id, undefined, ['TEACHER'])
    const orgId = newId()
    await db.organization.create({ data: { id: orgId, name: 'City College', emailDomains: ['city.example'] } })
    await db.membership.create({ data: { userId: teacher.id, organizationId: orgId, role: 'TEACHER' } })
    await db.membership.create({ data: { userId: s.id, organizationId: orgId, role: 'STUDENT' } })

    const fileId = await upload(t, s.token, 'VERIFICATION_DOCUMENT', 'image/png', SAMPLES.png, 'id.png')
    const sent = await t.gql<{ requestDocumentVerification: { request: { id: string } | null; userErrors: { code: string }[] } }>(REQ_DOCS, { input: { fileIds: [fileId], message: 'First year' } }, s.token)
    const requestId = sent.data!.requestDocumentVerification.request!.id

    const managerQueue = await t.gql<{ verificationRequestsToReview: { id: string; documents: { fileId: string; fileName: string }[] }[] }>(QUEUE, {}, manager.token)
    expect(managerQueue.data!.verificationRequestsToReview.find((row) => row.id === requestId)!.documents).toEqual([{ fileId, fileName: 'id.png' }])
    const link = await t.gql<{ verificationDocumentUrl: { url: string } }>(DOC, { r: requestId, f: fileId }, manager.token)
    expect(link.data!.verificationDocumentUrl.url).toEqual(expect.any(String))

    const teacherQueue = await t.gql<{ verificationRequestsToReview: { id: string; documents: { fileName: string }[] }[] }>(QUEUE, {}, teacherToken)
    expect(teacherQueue.data!.verificationRequestsToReview.find((row) => row.id === requestId)!.documents[0]!.fileName).toBe('id.png')
    expect((await t.gql(DOC, { r: requestId, f: fileId }, otherToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql<{ verificationRequestsToReview: { id: string }[] }>(QUEUE, {}, otherToken)).data!.verificationRequestsToReview.map((row) => row.id)).not.toContain(requestId)

    const approved = await t.gql<{ reviewVerificationRequest: { request: { status: string } | null; userErrors: { code: string }[] } }>(REVIEW, { input: { requestId, approve: true } }, manager.token)
    expect(approved.data!.reviewVerificationRequest.userErrors).toEqual([])
    expect(approved.data!.reviewVerificationRequest.request!.status).toBe('APPROVED')
    expect(await db.auditLog.findFirst({ where: { action: 'verification.approved', targetId: requestId } })).toMatchObject({ actorId: manager.id })
    expect(await db.auditLog.findFirst({ where: { action: 'verification.document.viewed', targetId: requestId, actorId: manager.id } })).toBeTruthy()

    const applicant = await student('Kiran Rao')
    const applied = await t.gql<{ applyToTeach: { request: { id: string; purpose: string } | null; userErrors: { code: string }[] } }>(APPLY, { input: { institution: 'City College', subjects: 'Physics' } }, applicant.token)
    const applicationId = applied.data!.applyToTeach.request!.id
    expect(applied.data!.applyToTeach.request!.purpose).toBe('TEACHER_ROLE')
    expect((await t.gql<{ verificationRequestsToReview: { id: string }[] }>(QUEUE, {}, manager.token)).data!.verificationRequestsToReview.map((row) => row.id)).not.toContain(applicationId)
    expect((await t.gql(REVIEW, { input: { requestId: applicationId, approve: true } }, manager.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')

    const promoted = await student('New Manager')
    expect((await t.gql(SET_ROLE, { u: promoted.id, r: 'MANAGER' }, manager.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql<{ setGlobalRole: { ok: boolean } }>(SET_ROLE, { u: promoted.id, r: 'MANAGER' }, admin.token)).data!.setGlobalRole.ok).toBe(true)
    expect(await db.user.findUniqueOrThrow({ where: { id: promoted.id } })).toMatchObject({ globalRole: 'MANAGER' })
    expect(await db.auditLog.findFirst({ where: { action: 'role.changed', targetId: promoted.id } })).toMatchObject({ actorId: admin.id, metadata: { from: 'STUDENT', to: 'MANAGER' } })
  })

  it('lets an admin approve a domain before anyone asks, and resolve account ids', async () => {
    expect((await t.gql(DECIDE_DOMAIN, { input: { domain: 'gmail.com', approve: true } }, admin.token)).data).toMatchObject({ reviewInstitutionDomain: { ok: false, userErrors: [{ code: 'VALIDATION' }] } })
    expect((await t.gql<{ reviewInstitutionDomain: { ok: boolean; userErrors: unknown[] } }>(DECIDE_DOMAIN, { input: { domain: 'city.example', approve: true } }, admin.token)).data!.reviewInstitutionDomain).toEqual({ ok: true, userErrors: [] })
    const listed = await t.gql<{ institutionDomains: { domain: string; status: string }[] }>(DOMAINS, { status: 'APPROVED' }, admin.token)
    expect(listed.data!.institutionDomains).toContainEqual({ domain: 'city.example', status: 'APPROVED' })
    const domainAudits = await db.auditLog.findMany({ where: { action: 'domain.approved', actorId: admin.id } })
    expect(domainAudits.some((row) => (row.metadata as { domain?: string } | null)?.domain === 'city.example')).toBe(true)
    const s = await student()
    expect((await t.gql(DOMAINS, {}, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')

    const found = await t.gql<{ usersByIds: { id: string; displayName: string; email: string; globalRole: string }[] }>(LOOKUP, { ids: [manager.id, newId()] }, admin.token)
    expect(found.data!.usersByIds).toEqual([{ id: manager.id, displayName: 'Mina', email: manager.email, globalRole: 'MANAGER' }])
    expect((await t.gql(LOOKUP, { ids: [manager.id] }, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
  })

  it('reads a college ID with a mocked provider and approves only when the switch is on', async () => {
    expect((await t.gql(SETTINGS, {}, admin.token)).data).toEqual({
      studentIdVerificationSettings: { aiCheckEnabled: false, autoApproveOnHighConfidence: false, confidenceThreshold: 90, imageRetentionDays: 30 },
    })
    const save = async (key: string, value: string) => {
      const res = await t.gql<{ updateAdminSetting: { userErrors: { message: string }[] } }>(SAVE, { input: { key, value } }, admin.token)
      expect(res.data!.updateAdminSetting.userErrors).toEqual([])
    }
    await save('student_id_ai_check', 'true')
    const orgId = newId()
    await db.organization.create({ data: { id: orgId, name: 'IIT Madras', emailDomains: ['iitm.ac.in'] } })
    const s = await student('Asha Rao')
    const fileId = await upload(t, s.token, 'VERIFICATION_DOCUMENT', 'image/png', SAMPLES.png, 'card.png')
    const sent = await t.gql<{ requestDocumentVerification: { request: { id: string } } }>(REQ_DOCS, { input: { fileIds: [fileId] } }, s.token)
    const requestId = sent.data!.requestDocumentVerification.request.id
    const checks = t.app.get(IdCardCheckService)
    const calls: number[] = []
    await checks.run(requestId, {
      extract: async (bytes, mimeType) => {
        calls.push(bytes.length)
        expect(mimeType).toBe('image/png')
        return { name: 'Asha Rao', institution: 'IIT Madras', idNumber: 'CS21', validUntil: null, readable: true, confidence: 0.97 }
      },
    })
    expect(calls).toEqual([SAMPLES.png.length])
    let row = await db.verificationRequest.findUniqueOrThrow({ where: { id: requestId } })
    expect(row).toMatchObject({ status: 'PENDING', aiVerdict: 'MATCH' })
    expect(row.aiExtracted).toMatchObject({ name: 'Asha Rao', idNumber: 'CS21' })

    await save('student_id_ai_auto_approve', 'true')
    const again = await student('Asha Rao')
    const second = await upload(t, again.token, 'VERIFICATION_DOCUMENT', 'image/png', SAMPLES.png, 'card.png')
    const next = await t.gql<{ requestDocumentVerification: { request: { id: string } } }>(REQ_DOCS, { input: { fileIds: [second] } }, again.token)
    await checks.run(next.data!.requestDocumentVerification.request.id, {
      extract: async () => ({ name: 'Asha Rao', institution: 'IIT Madras', idNumber: 'CS22', validUntil: null, readable: true, confidence: 0.97 }),
    })
    row = await db.verificationRequest.findUniqueOrThrow({ where: { id: next.data!.requestDocumentVerification.request.id } })
    expect(row.status).toBe('APPROVED')
    expect(row.documentIds).toEqual([second])
    expect(await db.auditLog.findFirst({ where: { action: 'verification.approved', targetId: row.id, actorId: null } })).toMatchObject({ metadata: expect.objectContaining({ actor: 'system:ai' }) })
    expect(await db.user.findUniqueOrThrow({ where: { id: again.id } })).toMatchObject({ verificationMethod: 'DOCUMENTS' })
  })

  it('drops usage for an opted-out account, records backend errors, and purges by age', async () => {
    const s = await student('Usage Student')
    const INGEST = `mutation ($input: IngestAnalyticsInput!) { ingestAnalytics(input: $input) { ok userErrors { code message } } }`
    const batch = (name: string) => ({ name, platform: 'WEB', props: { feature: 'notes' }, appVersion: '1.0.0' })
    const first = await t.gql<{ ingestAnalytics: { ok: boolean; userErrors: unknown[] } }>(INGEST, { input: { events: [batch('page_view'), batch('note_open')], errors: [{ code: 'CLIENT', message: 'broke for ada@college.edu', platform: 'MOBILE' }] } }, s.token)
    expect(first.data!.ingestAnalytics).toEqual({ ok: true, userErrors: [] })
    const unknown = await t.gql<{ ingestAnalytics: { ok: boolean; userErrors: { code: string }[] } }>(INGEST, { input: { events: [{ name: 'click', platform: 'WEB' }] } }, s.token)
    expect(unknown.data!.ingestAnalytics.userErrors[0]!.code).toBe('VALIDATION')

    const usage = await t.gql<{ adminUsage: { dau: number; topEvents: { name: string }[]; topFeatures: { name: string }[] } }>(`{ adminUsage { dau topEvents { name count } topFeatures { name count } } }`, {}, admin.token)
    expect(usage.data!.adminUsage.dau).toBeGreaterThanOrEqual(1)
    expect(usage.data!.adminUsage.topEvents.map((e) => e.name)).toEqual(expect.arrayContaining(['page_view', 'note_open']))
    expect(usage.data!.adminUsage.topFeatures[0]).toMatchObject({ name: 'notes' })
    const funnel = await t.gql<{ adminFunnel: { name: string; users: number }[] }>(`query ($steps: [String!]!) { adminFunnel(steps: $steps) { name users } }`, { steps: ['page_view', 'note_open'] }, admin.token)
    expect(funnel.data!.adminFunnel).toEqual([
      { name: 'page_view', users: expect.any(Number) },
      { name: 'note_open', users: expect.any(Number) },
    ])
    expect(funnel.data!.adminFunnel[0]!.users).toBeGreaterThanOrEqual(funnel.data!.adminFunnel[1]!.users)
    const activity = await t.gql<{ adminUserActivity: { name: string }[] }>(`query ($id: UUID!) { adminUserActivity(userId: $id) { name platform } }`, { id: s.id }, admin.token)
    expect(activity.data!.adminUserActivity.map((e) => e.name)).toEqual(expect.arrayContaining(['page_view', 'note_open']))
    const errors = await t.gql<{ adminErrors: { code: string; count: number; userIds: string[]; sampleMessage: string }[] }>(`{ adminErrors { code count userIds sampleMessage } }`, {}, admin.token)
    const client = errors.data!.adminErrors.find((g) => g.code === 'CLIENT')!
    expect(client.userIds).toContain(s.id)
    expect(client.sampleMessage).toContain('[email]')
    expect(client.sampleMessage).not.toContain('ada@college.edu')
    expect((await t.gql(`{ adminUsage { dau } }`, {}, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')

    expect((await t.gql<{ setAnalyticsOptOut: { ok: boolean } }>(`mutation { setAnalyticsOptOut(optOut: true) { ok } }`, {}, s.token)).data!.setAnalyticsOptOut.ok).toBe(true)
    expect((await t.gql<{ viewer: { analyticsOptOut: boolean | null } }>(`{ viewer { analyticsOptOut } }`, {}, s.token)).data!.viewer.analyticsOptOut).toBe(true)
    const before = await db.usageEvent.count({ where: { userId: s.id } })
    await t.gql(INGEST, { input: { events: [batch('search')], errors: [{ code: 'CLIENT', message: 'still here', platform: 'WEB' }] } }, s.token)
    expect(await db.usageEvent.count({ where: { userId: s.id } })).toBe(before)
    expect(await db.errorEvent.findFirst({ where: { message: 'still here', userId: null, platform: 'WEB' } })).toBeTruthy()

    await t.app.get(AnalyticsService).recordBackendError({ userId: s.id, route: 'Note', code: 'INTERNAL', message: 'backend ada@college.edu' })
    const backend = await db.errorEvent.findFirst({ where: { userId: s.id, platform: 'BACKEND' } })
    expect(backend?.message).toContain('[email]')
    expect(backend?.message).not.toContain('ada@college.edu')
    expect(backend?.route).toBe('Note')

    const usageId = newId()
    const errorId = newId()
    await db.usageEvent.create({ data: { id: usageId, userId: s.id, name: 'page_view', platform: 'WEB', occurredAt: new Date(Date.now() - 200 * 24 * 3600 * 1000) } })
    await db.errorEvent.create({ data: { id: errorId, userId: s.id, code: 'OLD', message: 'old', platform: 'BACKEND', occurredAt: new Date(Date.now() - 100 * 24 * 3600 * 1000) } })
    const purged = await t.app.get(UsersMaintenance).purgeAnalytics()
    expect(purged.usage).toBeGreaterThanOrEqual(1)
    expect(purged.errors).toBeGreaterThanOrEqual(1)
    expect(await db.usageEvent.findUnique({ where: { id: usageId } })).toBeNull()
    expect(await db.errorEvent.findUnique({ where: { id: errorId } })).toBeNull()
  })
})

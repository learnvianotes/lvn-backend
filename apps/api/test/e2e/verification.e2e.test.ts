import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { UsersMaintenance } from '@lvn-backend/users'
import { createTestApp, type TestApp } from '../support/app'
import { createIntent, SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** Verification without an institutional email (ADR-0019) and the interim platform-admin tools. */

const REQ_TEACHER = `mutation ($input: RequestTeacherVerificationInput!) { requestTeacherVerification(input: $input) {
  request { id method status message teacher { id displayName } } userErrors { field message code } } }`
const REQ_DOCS = `mutation ($input: RequestDocumentVerificationInput!) { requestDocumentVerification(input: $input) {
  request { id method status } userErrors { field message code } } }`
const REVIEW = `mutation ($input: ReviewVerificationRequestInput!) { reviewVerificationRequest(input: $input) {
  request { id status reason decidedAt } userErrors { field message code } } }`
const TO_REVIEW = `{ verificationRequestsToReview { id method message requester { id displayName email } documents { fileId fileName mimeType } } }`
const MINE = `{ myVerificationRequests { id status method } }`
const VIEWER = `{ viewer { verified verificationMethod } }`
const WITHDRAW = 'mutation ($id: UUID!) { withdrawVerificationRequest(requestId: $id) { ok userErrors { code } } }'
const DOC_URL = 'query ($r: UUID!, $f: UUID!) { verificationDocumentUrl(requestId: $r, fileId: $f) { url expiresAt } }'

type Req = { id: string; method: string; status: string; reason?: string | null }
type Payload<K extends string> = Record<K, { request: Req | null; userErrors: { field: string[] | null; message: string; code: string }[] }>

describe('verification (ADR-0019)', () => {
  let t: TestApp
  let db: PrismaService
  let teacher: { id: string; token: string }
  let admin: { id: string; token: string }

  const student = async (dob = '2004-05-01') => {
    const u = await seedUser(t.app)
    await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date(dob) } })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const asTeacher = async (verified = true) => {
    const u = await seedUser(t.app, { globalRole: 'TEACHER', verified, displayName: `Prof ${newId().slice(-6)}` })
    return { id: u.id, token: tokenFor(t.config, u.id, undefined, ['TEACHER']) }
  }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    teacher = await asTeacher()
    const a = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    admin = { id: a.id, token: tokenFor(t.config, a.id, undefined, ['PLATFORM_ADMIN']) }
  })

  afterAll(() => t.close())

  describe('by a teacher', () => {
    it('finds verified teachers, sends one request, and the teacher who vouches verifies the student', async () => {
      const s = await student()
      const found = await t.gql<{ teachers: { id: string }[] }>('query ($q: String!) { teachers(search: $q) { id } }', { q: 'Prof' }, s.token)
      expect(found.data!.teachers.map((x) => x.id)).toContain(teacher.id)

      const sent = await t.gql<Payload<'requestTeacherVerification'>>(REQ_TEACHER, { input: { teacherId: teacher.id, message: 'I am in your 3rd-year DBMS class' } }, s.token)
      const request = sent.data!.requestTeacherVerification.request!
      expect(request).toMatchObject({ method: 'TEACHER', status: 'PENDING' })

      const again = await t.gql<Payload<'requestTeacherVerification'>>(REQ_TEACHER, { input: { teacherId: teacher.id } }, s.token)
      expect(again.data!.requestTeacherVerification.userErrors[0]!.code).toBe('CONFLICT')

      const queue = await t.gql<{ verificationRequestsToReview: { id: string; requester: { id: string; email: string | null }; documents: unknown[] }[] }>(TO_REVIEW, {}, teacher.token)
      const item = queue.data!.verificationRequestsToReview.find((r) => r.id === request.id)!
      expect(item.requester).toMatchObject({ id: s.id, email: null }) // reviewers never see the student's email
      const otherTeacher = await asTeacher()
      const elsewhere = await t.gql<{ verificationRequestsToReview: { id: string }[] }>(TO_REVIEW, {}, otherTeacher.token)
      expect(elsewhere.data!.verificationRequestsToReview.map((r) => r.id)).not.toContain(request.id)
      const notMine = await t.gql<Payload<'reviewVerificationRequest'>>(REVIEW, { input: { requestId: request.id, approve: true } }, otherTeacher.token)
      expect(notMine.errors?.[0]?.extensions.code).toBe('FORBIDDEN')

      const approved = await t.gql<Payload<'reviewVerificationRequest'>>(REVIEW, { input: { requestId: request.id, approve: true } }, teacher.token)
      expect(approved.data!.reviewVerificationRequest.request).toMatchObject({ status: 'APPROVED' })
      expect((await t.gql(VIEWER, {}, s.token)).data).toEqual({ viewer: { verified: true, verificationMethod: 'TEACHER' } })
      expect(await db.auditLog.findFirst({ where: { targetId: request.id, action: 'verification.approved' } })).toMatchObject({ actorId: teacher.id })
    })

    it('refuses a teacher who is not verified, and someone who is not a teacher', async () => {
      const s = await student()
      const unverified = await asTeacher(false)
      const plain = await student()
      for (const teacherId of [unverified.id, plain.id, s.id]) {
        const res = await t.gql<Payload<'requestTeacherVerification'>>(REQ_TEACHER, { input: { teacherId } }, s.token)
        expect(res.data!.requestTeacherVerification.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'teacherId'] })
      }
    })

    it('needs a reason to reject, and the student can ask again afterwards', async () => {
      const s = await student()
      const r = (await t.gql<Payload<'requestTeacherVerification'>>(REQ_TEACHER, { input: { teacherId: teacher.id } }, s.token)).data!.requestTeacherVerification.request!
      const noReason = await t.gql<Payload<'reviewVerificationRequest'>>(REVIEW, { input: { requestId: r.id, approve: false } }, teacher.token)
      expect(noReason.data!.reviewVerificationRequest.userErrors[0]).toMatchObject({ field: ['input', 'reason'] })
      const rejected = await t.gql<Payload<'reviewVerificationRequest'>>(REVIEW, { input: { requestId: r.id, approve: false, reason: 'Not in my classes' } }, teacher.token)
      expect(rejected.data!.reviewVerificationRequest.request).toMatchObject({ status: 'REJECTED', reason: 'Not in my classes' })
      expect((await t.gql(VIEWER, {}, s.token)).data).toEqual({ viewer: { verified: false, verificationMethod: null } })
      const again = await t.gql<Payload<'requestTeacherVerification'>>(REQ_TEACHER, { input: { teacherId: teacher.id } }, s.token)
      expect(again.data!.requestTeacherVerification.request!.status).toBe('PENDING')
    })

    it('allows three requests a week', async () => {
      const s = await student()
      for (let i = 0; i < 3; i++) {
        const r = (await t.gql<Payload<'requestTeacherVerification'>>(REQ_TEACHER, { input: { teacherId: teacher.id } }, s.token)).data!.requestTeacherVerification.request!
        await t.gql(WITHDRAW, { id: r.id }, s.token)
      }
      const fourth = await t.gql<Payload<'requestTeacherVerification'>>(REQ_TEACHER, { input: { teacherId: teacher.id } }, s.token)
      expect(fourth.data!.requestTeacherVerification.userErrors[0]!.code).toBe('RATE_LIMITED')
      expect((await t.gql<{ myVerificationRequests: { status: string }[] }>(MINE, {}, s.token)).data!.myVerificationRequests.map((r) => r.status)).toEqual(['WITHDRAWN', 'WITHDRAWN', 'WITHDRAWN'])
    })
  })

  describe('by documents', () => {
    it('shows documents to platform admins only, audits every view, and deletes them 30 days after the decision', async () => {
      const s = await student()
      const files = [
        await upload(t, s.token, 'VERIFICATION_DOCUMENT', 'application/pdf', SAMPLES.pdf, 'bonafide.pdf'),
        await upload(t, s.token, 'VERIFICATION_DOCUMENT', 'image/png', SAMPLES.png, 'student-id.png'),
      ]
      const r = (await t.gql<Payload<'requestDocumentVerification'>>(REQ_DOCS, { input: { fileIds: files, message: 'First-year B.Tech' } }, s.token)).data!.requestDocumentVerification.request!
      expect(r).toMatchObject({ method: 'DOCUMENTS', status: 'PENDING' })

      // A teacher never sees document requests, nor documents.
      const teacherQueue = await t.gql<{ verificationRequestsToReview: { id: string }[] }>(TO_REVIEW, {}, teacher.token)
      expect(teacherQueue.data!.verificationRequestsToReview.map((x) => x.id)).not.toContain(r.id)
      expect((await t.gql(DOC_URL, { r: r.id, f: files[0] }, teacher.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      const teacherReview = await t.gql(REVIEW, { input: { requestId: r.id, approve: true } }, teacher.token)
      expect(teacherReview.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      // Neither does the student, through their own request.
      expect((await t.gql(DOC_URL, { r: r.id, f: files[0] }, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')

      const adminQueue = await t.gql<{ verificationRequestsToReview: { id: string; documents: { fileName: string }[] }[] }>(TO_REVIEW, {}, admin.token)
      expect(adminQueue.data!.verificationRequestsToReview.find((x) => x.id === r.id)!.documents.map((d) => d.fileName)).toEqual(['bonafide.pdf', 'student-id.png'])
      const link = await t.gql<{ verificationDocumentUrl: { url: string } }>(DOC_URL, { r: r.id, f: files[0] }, admin.token)
      expect(new Uint8Array(await (await fetch(link.data!.verificationDocumentUrl.url)).arrayBuffer())).toEqual(SAMPLES.pdf)
      expect(await db.auditLog.findFirst({ where: { action: 'verification.document.viewed', targetId: r.id } })).toMatchObject({ actorId: admin.id })

      await t.gql(REVIEW, { input: { requestId: r.id, approve: true } }, admin.token)
      expect((await t.gql(VIEWER, {}, s.token)).data).toEqual({ viewer: { verified: true, verificationMethod: 'DOCUMENTS' } })

      const maintenance = t.app.get(UsersMaintenance)
      expect(await maintenance.purgeVerificationDocuments(new Date(Date.now() + 29 * 86_400_000))).toBe(0)
      expect(await maintenance.purgeVerificationDocuments(new Date(Date.now() + 31 * 86_400_000))).toBe(1)
      const rows = await db.fileObject.findMany({ where: { id: { in: files } } })
      expect(rows.every((f) => f.status === 'DELETED')).toBe(true)
      for (const f of rows) expect(await t.app.get(Storage).head(f.bucket, f.storageKey)).toBeNull()
      expect(await db.verificationRequest.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: 'APPROVED', documentIds: [] })
    })

    it('deletes documents at once when the request is withdrawn', async () => {
      const s = await student()
      const file = await upload(t, s.token, 'VERIFICATION_DOCUMENT', 'image/png', SAMPLES.png)
      const r = (await t.gql<Payload<'requestDocumentVerification'>>(REQ_DOCS, { input: { fileIds: [file] } }, s.token)).data!.requestDocumentVerification.request!
      expect((await t.gql<{ withdrawVerificationRequest: { ok: boolean } }>(WITHDRAW, { id: r.id }, s.token)).data!.withdrawVerificationRequest.ok).toBe(true)
      expect(await db.fileObject.findUniqueOrThrow({ where: { id: file } })).toMatchObject({ status: 'DELETED' })
    })

    it('accepts only the student’s own unused verification uploads', async () => {
      const s = await student()
      const other = await student()
      const theirs = await upload(t, other.token, 'VERIFICATION_DOCUMENT', 'image/png', SAMPLES.png)
      const avatar = await upload(t, s.token, 'AVATAR', 'image/png', SAMPLES.png)
      for (const fileIds of [[theirs], [avatar], [newId()], []]) {
        const res = await t.gql<Payload<'requestDocumentVerification'>>(REQ_DOCS, { input: { fileIds } }, s.token)
        expect(res.data!.requestDocumentVerification.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'fileIds'] })
      }
      expect(await db.verificationRequest.count({ where: { userId: s.id } })).toBe(0)
    })

    it('never takes documents from a restricted minor', async () => {
      const minor = await student('2013-06-01')
      const res = await t.gql(REQ_DOCS, { input: { fileIds: [newId()] } }, minor.token)
      expect(res.errors?.[0]).toMatchObject({ extensions: { code: 'FORBIDDEN' }, message: expect.stringMatching(/teacher/) })
      const intent = await createIntent(t, minor.token, { fileName: 'id.png', mimeType: 'image/png', sizeBytes: 10, purpose: 'VERIFICATION_DOCUMENT' })
      expect(intent.userErrors[0]!.code).toBe('FORBIDDEN')
    })
  })

  describe('platform-admin tools', () => {
    it('approving a waiting domain verifies the accounts confirmed on it', async () => {
      const s = await student()
      await db.institutionalEmail.create({ data: { id: newId(), userId: s.id, email: `a@labs.${s.id.slice(-6)}.com`, domain: `labs.${s.id.slice(-6)}.com`, verifiedAt: new Date() } })
      await db.domainReview.create({ data: { domain: `${s.id.slice(-6)}.com`, status: 'NEEDS_REVIEW' } })
      const queue = await t.gql<{ domainReviews: { domain: string }[] }>('{ domainReviews { domain status requests } }', {}, admin.token)
      expect(queue.data!.domainReviews.map((d) => d.domain)).toContain(`${s.id.slice(-6)}.com`)
      expect((await t.gql('{ domainReviews { domain } }', {}, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      await t.gql('mutation ($d: String!) { decideDomainReview(input: { domain: $d, approve: true }) { ok } }', { d: `${s.id.slice(-6)}.com` }, admin.token)
      expect((await t.gql(VIEWER, {}, s.token)).data).toEqual({ viewer: { verified: true, verificationMethod: 'INSTITUTIONAL_EMAIL' } })
    })

    it('grants TEACHER by review, with an audit entry; only platform admins, and never to themselves', async () => {
      const s = await student()
      const SET = 'mutation ($u: UUID!, $r: GlobalRole!) { setGlobalRole(input: { userId: $u, role: $r }) { ok } }'
      expect((await t.gql(SET, { u: s.id, r: 'PLATFORM_ADMIN' }, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql(SET, { u: admin.id, r: 'STUDENT' }, admin.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await t.gql<{ setGlobalRole: { ok: boolean } }>(SET, { u: s.id, r: 'TEACHER' }, admin.token)).data!.setGlobalRole.ok).toBe(true)
      expect(await db.user.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({ globalRole: 'TEACHER' })
      expect(await db.auditLog.findFirst({ where: { action: 'role.changed', targetId: s.id } })).toMatchObject({ actorId: admin.id, metadata: { from: 'STUDENT', to: 'TEACHER' } })
    })
  })
})

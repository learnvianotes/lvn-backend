import { CollegeIdCardLimits } from '@lvn/contracts/domain'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { UsersMaintenance } from '@lvn-backend/users'
import { createTestApp, type TestApp } from '../support/app'
import { createIntent, put, SAMPLES } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** College ID card verification (ADR-0099): an admin switch, a restricted-bucket card, and the existing verified-account mechanism. */

const ENABLED = '{ studentIdVerificationEnabled }'
const SETTINGS = '{ studentIdVerificationSettings { enabled updatedAt } }'
const SET = 'mutation ($enabled: Boolean!) { setStudentIdVerificationEnabled(enabled: $enabled) { ok userErrors { code message } } }'
const INTENT = `mutation ($input: CreateStudentIdUploadInput!) { createStudentIdUploadIntent(input: $input) {
  upload { fileId uploadUrl uploadHeaders { name value } expiresAt } userErrors { field message code } } }`
const SUBMIT = `mutation ($input: SubmitStudentIdVerificationInput!) { submitStudentIdVerification(input: $input) {
  request { id status message reason card { fileId fileName } } userErrors { field message code } } }`
const MINE = `{ myStudentIdVerification { id status reason message card { fileId } requester { id email } } }`
const QUEUE = `{ studentIdVerificationQueue { id status message requester { id email } card { fileId fileName mimeType } } }`
const CARD = 'query ($id: UUID!) { studentIdCardUrl(requestId: $id) { url expiresAt } }'
const REVIEW = `mutation ($input: ReviewStudentIdVerificationInput!) { reviewStudentIdVerification(input: $input) {
  request { id status reason card { fileId } } userErrors { field message code } } }`
const WITHDRAW = 'mutation ($id: UUID!) { withdrawStudentIdVerification(requestId: $id) { ok userErrors { code message } } }'
const VIEWER = '{ viewer { verified verificationMethod } }'
const COMPLETE = 'mutation ($id: UUID!) { completeUpload(fileId: $id) { ok userErrors { code message } } }'

type Upload = { fileId: string; uploadUrl: string; uploadHeaders: { name: string; value: string }[]; expiresAt: string }
type Err = { field: string[] | null; message: string; code: string }
type CardRequest = { id: string; status: string; reason?: string | null; message?: string | null; card: { fileId: string; fileName?: string } | null }

describe('college ID verification (ADR-0099)', () => {
  let t: TestApp
  let db: PrismaService
  let storage: Storage
  let admin: { id: string; token: string }
  let teacher: { id: string; token: string }
  let manager: { token: string }

  const student = async (dob = '2004-05-01') => {
    const u = await seedUser(t.app)
    await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date(dob) } })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }

  const enable = async (enabled = true) => {
    const res = await t.gql<{ setStudentIdVerificationEnabled: { ok: boolean } }>(SET, { enabled }, admin.token)
    expect(res).toMatchObject({ data: { setStudentIdVerificationEnabled: { ok: true } } })
  }

  const intent = async (token: string, bytes: Uint8Array, mimeType = 'image/png', fileName = 'college-id.png') => {
    const res = await t.gql<{ createStudentIdUploadIntent: { upload: Upload | null; userErrors: Err[] } }>(INTENT, { input: { fileName, mimeType, sizeBytes: bytes.length } }, token)
    return res.data!.createStudentIdUploadIntent
  }

  const send = async (token: string, bytes: Uint8Array = SAMPLES.png, mimeType = 'image/png', fileName = 'college-id.png', message?: string) => {
    const created = await intent(token, bytes, mimeType, fileName)
    expect(created.userErrors).toEqual([])
    expect(await put(created.upload!, bytes)).toBe(200)
    const submitted = await t.gql<{ submitStudentIdVerification: { request: CardRequest | null; userErrors: Err[] } }>(
      SUBMIT,
      { input: { fileId: created.upload!.fileId, ...(message ? { message } : {}) } },
      token,
    )
    return { fileId: created.upload!.fileId, ...submitted.data!.submitStudentIdVerification }
  }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    storage = t.app.get(Storage)
    const a = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    admin = { id: a.id, token: tokenFor(t.config, a.id, undefined, ['PLATFORM_ADMIN']) }
    const teacherUser = await seedUser(t.app, { globalRole: 'TEACHER', verified: true })
    teacher = { id: teacherUser.id, token: tokenFor(t.config, teacherUser.id, undefined, ['TEACHER']) }
    const managerUser = await seedUser(t.app, { globalRole: 'MANAGER', verified: true })
    manager = { token: tokenFor(t.config, managerUser.id, undefined, ['MANAGER']) }
    expect((await t.gql(ENABLED)).data).toEqual({ studentIdVerificationEnabled: false })
    expect((await t.gql<{ studentIdVerificationSettings: { enabled: boolean } }>(SETTINGS, {}, admin.token)).data!.studentIdVerificationSettings.enabled).toBe(false)
    const probe = await student()
    const refused = await intent(probe.token, SAMPLES.png)
    expect(refused).toMatchObject({ upload: null, userErrors: [{ code: 'UNAVAILABLE' }] })
    expect(await db.fileObject.count({ where: { ownerId: probe.id } })).toBe(0)
    await enable(true)
  })

  afterAll(() => t.close())

  it('lets only a platform admin read or change the switch', async () => {
    const s = await student()
    expect((await t.gql(SET, { enabled: false }, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql(SETTINGS, {}, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql(ENABLED)).data).toEqual({ studentIdVerificationEnabled: true })
    expect(await db.auditLog.findFirst({ where: { action: 'settings.student_id_verification', actorId: admin.id } })).toMatchObject({ metadata: { enabled: true } })
    expect((await t.gql('{ uploadsEnabled }')).data).toEqual({ uploadsEnabled: true })
  })

  it('lets a student send a card, shows it only to an admin, and verifies the account on approval', async () => {
    const s = await student()
    const other = await student()
    const sent = await send(s.token, SAMPLES.png, 'image/png', 'scans/college-id.png', 'First-year CSE')
    const request = sent.request!
    expect(request).toMatchObject({ status: 'PENDING', message: 'First-year CSE' })
    expect(request.card).toBeNull()

    const row = await db.fileObject.findUniqueOrThrow({ where: { id: sent.fileId } })
    expect(row).toMatchObject({ purpose: 'COLLEGE_ID', status: 'READY', bucket: t.config.S3_RESTRICTED_BUCKET, originalFileName: 'scanscollege-id.png', variants: null })
    expect(row.bucket).not.toBe(t.config.S3_BUCKET)
    expect(await storage.head(t.config.S3_BUCKET, row.storageKey)).toBeNull()
    expect(await storage.head(row.bucket, row.storageKey)).not.toBeNull()

    const mine = await t.gql<{ myStudentIdVerification: { status: string; card: unknown; requester: { email: string | null } } }>(MINE, {}, s.token)
    expect(mine.data!.myStudentIdVerification).toMatchObject({ status: 'PENDING', card: null, requester: { email: expect.any(String) } })
    const listed = await t.gql<{ myVerificationRequests: { id: string; collegeIdCard: boolean; documents: unknown[] }[] }>('{ myVerificationRequests { id collegeIdCard documents { fileId } } }', {}, s.token)
    expect(listed.data!.myVerificationRequests.find((r) => r.id === request.id)).toEqual({ id: request.id, collegeIdCard: true, documents: [] })

    for (const token of [s.token, other.token, teacher.token, manager.token]) {
      expect((await t.gql(CARD, { id: request.id }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    }
    expect((await t.gql(QUEUE, {}, s.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql(QUEUE, {}, teacher.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql(QUEUE, {}, manager.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await t.gql<{ verificationRequestsToReview: { id: string }[] }>('{ verificationRequestsToReview { id } }', {}, teacher.token)).data!.verificationRequestsToReview.map((r) => r.id)).not.toContain(request.id)
    expect((await t.gql('{ verificationRequestsToReview { id } }', {}, manager.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    for (const token of [s.token, teacher.token, manager.token]) {
      expect((await t.gql(REVIEW, { input: { requestId: request.id, approve: true } }, token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    }

    const queue = await t.gql<{ studentIdVerificationQueue: { id: string; requester: { id: string; email: string | null }; card: { fileName: string } }[] }>(QUEUE, {}, admin.token)
    const item = queue.data!.studentIdVerificationQueue.find((r) => r.id === request.id)!
    expect(item.requester).toEqual({ id: s.id, email: null })
    expect(item.card.fileName).toBe('scanscollege-id.png')

    const link = await t.gql<{ studentIdCardUrl: { url: string; expiresAt: string } }>(CARD, { id: request.id }, admin.token)
    const expiresAt = new Date(link.data!.studentIdCardUrl.expiresAt).getTime()
    expect(expiresAt).toBeGreaterThan(Date.now() + 4 * 60 * 1000)
    expect(expiresAt).toBeLessThan(Date.now() + 6 * 60 * 1000)
    expect(new Uint8Array(await (await fetch(link.data!.studentIdCardUrl.url)).arrayBuffer())).toEqual(SAMPLES.png)
    expect(await db.auditLog.findFirst({ where: { action: 'verification.document.viewed', targetId: request.id } })).toMatchObject({ actorId: admin.id, metadata: { fileId: sent.fileId, collegeIdCard: true } })

    const approved = await t.gql<{ reviewStudentIdVerification: { request: CardRequest | null; userErrors: Err[] } }>(REVIEW, { input: { requestId: request.id, approve: true } }, admin.token)
    expect(approved.data!.reviewStudentIdVerification.userErrors).toEqual([])
    expect(approved.data!.reviewStudentIdVerification.request).toMatchObject({ status: 'APPROVED', card: { fileId: sent.fileId } })
    expect((await t.gql(VIEWER, {}, s.token)).data).toEqual({ viewer: { verified: true, verificationMethod: 'DOCUMENTS' } })
    expect(await db.auditLog.findFirst({ where: { action: 'verification.approved', targetId: request.id } })).toMatchObject({ actorId: admin.id, metadata: { collegeIdCard: true, method: 'DOCUMENTS' } })
    expect(await db.auditLog.findFirst({ where: { action: 'verification.documents.deleted', targetId: request.id } })).toBeNull()
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: sent.fileId } })).toMatchObject({ status: 'READY' })
    expect(await storage.head(row.bucket, row.storageKey)).not.toBeNull()
    expect(await db.verificationRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ documentIds: [sent.fileId], status: 'APPROVED' })
    expect((await t.gql(MINE, {}, s.token)).data).toMatchObject({ myStudentIdVerification: { status: 'APPROVED', card: null } })
    const kept = await t.gql<{ studentIdCardUrl: { url: string } }>(CARD, { id: request.id }, admin.token)
    expect(new Uint8Array(await (await fetch(kept.data!.studentIdCardUrl.url)).arrayBuffer())).toEqual(SAMPLES.png)
  })

  it('rejects without a reason, keeps the card until the retention window, and leaves the account unverified', async () => {
    const s = await student()
    const sent = await send(s.token, SAMPLES.pdf, 'application/pdf', 'id.pdf')
    const rejected = await t.gql<{ reviewStudentIdVerification: { request: CardRequest | null; userErrors: Err[] } }>(REVIEW, { input: { requestId: sent.request!.id, approve: false } }, admin.token)
    expect(rejected.data!.reviewStudentIdVerification.userErrors).toEqual([])
    expect(rejected.data!.reviewStudentIdVerification.request).toMatchObject({ status: 'REJECTED', reason: null, card: { fileId: sent.fileId } })
    expect((await t.gql(VIEWER, {}, s.token)).data).toEqual({ viewer: { verified: false, verificationMethod: null } })
    expect(await db.auditLog.findFirst({ where: { action: 'verification.rejected', targetId: sent.request!.id } })).toMatchObject({ actorId: admin.id })
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: sent.fileId } })).toMatchObject({ status: 'READY' })
    expect((await t.gql(MINE, {}, s.token)).data).toMatchObject({ myStudentIdVerification: { status: 'REJECTED', reason: null, card: null } })

    const again = await send(s.token)
    expect(again.request!.status).toBe('PENDING')
    const withReason = await t.gql<{ reviewStudentIdVerification: { request: { reason: string } } }>(REVIEW, { input: { requestId: again.request!.id, approve: false, reason: 'The name does not match the account' } }, admin.token)
    expect(withReason.data!.reviewStudentIdVerification.request.reason).toBe('The name does not match the account')
  })

  it('allows one pending request and three requests a week', async () => {
    const s = await student()
    const first = await send(s.token)
    const second = await intent(s.token, SAMPLES.png)
    expect(second.userErrors[0]).toMatchObject({ code: 'CONFLICT' })
    const submitted = await t.gql<{ submitStudentIdVerification: { userErrors: Err[] } }>(SUBMIT, { input: { fileId: newId() } }, s.token)
    expect(submitted.data!.submitStudentIdVerification.userErrors[0]!.code).toBe('CONFLICT')
    expect((await t.gql<{ withdrawStudentIdVerification: { ok: boolean } }>(WITHDRAW, { id: first.request!.id }, s.token)).data!.withdrawStudentIdVerification.ok).toBe(true)
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: first.fileId } })).toMatchObject({ status: 'DELETED' })

    for (let i = 0; i < 2; i++) {
      const r = await send(s.token)
      await t.gql(WITHDRAW, { id: r.request!.id }, s.token)
    }
    const fourth = await send(s.token)
    expect(fourth.userErrors[0]).toMatchObject({ code: 'RATE_LIMITED' })
    expect(await db.verificationRequest.count({ where: { userId: s.id, status: 'PENDING' } })).toBe(0)
  })

  it('refuses the wrong type, a file over 5 MB, another person’s file, and bytes that are not the declared type', async () => {
    const s = await student()
    const gif = await t.gql<{ createStudentIdUploadIntent: { userErrors: Err[] } }>(INTENT, { input: { fileName: 'id.gif', mimeType: 'image/gif', sizeBytes: 10 } }, s.token)
    expect(gif.data!.createStudentIdUploadIntent.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'mimeType'] })
    const huge = await t.gql<{ createStudentIdUploadIntent: { upload: Upload | null; userErrors: Err[] } }>(INTENT, { input: { fileName: 'id.png', mimeType: 'image/png', sizeBytes: CollegeIdCardLimits.maxBytes + 1 } }, s.token)
    expect(huge.data!.createStudentIdUploadIntent).toMatchObject({ upload: null, userErrors: [{ code: 'VALIDATION', field: ['input', 'sizeBytes'] }] })
    expect(await db.fileObject.count({ where: { ownerId: s.id, purpose: 'COLLEGE_ID' } })).toBe(0)

    const other = await student()
    const theirs = await intent(other.token, SAMPLES.png)
    expect(await put(theirs.upload!, SAMPLES.png)).toBe(200)
    const stolen = await t.gql<{ submitStudentIdVerification: { request: unknown; userErrors: Err[] } }>(SUBMIT, { input: { fileId: theirs.upload!.fileId } }, s.token)
    expect(stolen.data!.submitStudentIdVerification).toMatchObject({ request: null, userErrors: [{ code: 'VALIDATION', field: ['input', 'fileId'] }] })

    const fake = await intent(s.token, SAMPLES.html, 'image/png', 'id.png')
    expect(await put(fake.upload!, SAMPLES.html)).toBe(200)
    const mismatch = await t.gql<{ submitStudentIdVerification: { userErrors: Err[] } }>(SUBMIT, { input: { fileId: fake.upload!.fileId } }, s.token)
    expect(mismatch.data!.submitStudentIdVerification.userErrors[0]).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/does not match/) })
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: fake.upload!.fileId } })).toMatchObject({ status: 'FAILED' })
    expect(await storage.head(t.config.S3_RESTRICTED_BUCKET, (await db.fileObject.findUniqueOrThrow({ where: { id: fake.upload!.fileId } })).storageKey)).toBeNull()
    expect(await db.verificationRequest.count({ where: { userId: s.id } })).toBe(0)
  })

  it('does not finish a college ID card through completeUpload, and refuses a minor or a verified account', async () => {
    const s = await student()
    const created = await intent(s.token, SAMPLES.png)
    expect(await put(created.upload!, SAMPLES.png)).toBe(200)
    const completed = await t.gql<{ completeUpload: { ok: boolean; userErrors: Err[] } }>(COMPLETE, { id: created.upload!.fileId }, s.token)
    expect(completed.data!.completeUpload).toMatchObject({ ok: false, userErrors: [{ code: 'VALIDATION' }] })
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: created.upload!.fileId } })).toMatchObject({ status: 'PENDING' })
    const submitted = await t.gql<{ submitStudentIdVerification: { request: { status: string } | null; userErrors: Err[] } }>(SUBMIT, { input: { fileId: created.upload!.fileId } }, s.token)
    expect(submitted.data!.submitStudentIdVerification.request!.status).toBe('PENDING')

    const minor = await student('2013-06-01')
    expect((await t.gql(INTENT, { input: { fileName: 'id.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length } }, minor.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')

    const verified = await seedUser(t.app, { verified: true })
    const verifiedToken = tokenFor(t.config, verified.id)
    const already = await t.gql<{ createStudentIdUploadIntent: { userErrors: Err[] } }>(INTENT, { input: { fileName: 'id.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length } }, verifiedToken)
    expect(already.data!.createStudentIdUploadIntent.userErrors[0]!.code).toBe('CONFLICT')
  })

  it('keeps a college ID card for the retention window after the decision', async () => {
    const s = await student()
    const sent = await send(s.token)
    await db.verificationRequest.update({ where: { id: sent.request!.id }, data: { status: 'APPROVED', decidedBy: admin.id, decidedAt: new Date() } })
    expect(await t.app.get(UsersMaintenance).purgeVerificationDocuments(new Date())).toBe(0)
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: sent.fileId } })).toMatchObject({ status: 'READY' })
    await db.verificationRequest.update({ where: { id: sent.request!.id }, data: { decidedAt: new Date(Date.now() - 31 * 24 * 3600 * 1000) } })
    expect(await t.app.get(UsersMaintenance).purgeVerificationDocuments(new Date())).toBe(1)
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: sent.fileId } })).toMatchObject({ status: 'DELETED' })
    expect(await db.verificationRequest.findUniqueOrThrow({ where: { id: sent.request!.id } })).toMatchObject({ documentIds: [] })
  })

  it('stops accepting cards again when an admin turns the switch off, and still lets them finish a waiting review', async () => {
    const s = await student()
    const waiting = await send(s.token)
    await enable(false)
    const refused = await intent(s.token, SAMPLES.png)
    expect(refused.userErrors[0]!.code).toBe('UNAVAILABLE')
    const approved = await t.gql<{ reviewStudentIdVerification: { request: { status: string } | null } }>(REVIEW, { input: { requestId: waiting.request!.id, approve: true } }, admin.token)
    expect(approved.data!.reviewStudentIdVerification.request!.status).toBe('APPROVED')
    expect((await t.gql(VIEWER, {}, s.token)).data).toEqual({ viewer: { verified: true, verificationMethod: 'DOCUMENTS' } })
    await enable(true)
  })
})

describe('college ID verification with general uploads off', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({ UPLOADS_ENABLED: 'false' })
  })

  afterAll(() => t.close())

  it('still accepts a college ID card when UPLOADS_ENABLED is false', async () => {
    const db = t.app.get(PrismaService)
    const adminUser = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    const adminToken = tokenFor(t.config, adminUser.id, undefined, ['PLATFORM_ADMIN'])
    const studentUser = await seedUser(t.app)
    const studentToken = tokenFor(t.config, studentUser.id)
    expect((await t.gql('{ uploadsEnabled studentIdVerificationEnabled }')).data).toEqual({ uploadsEnabled: false, studentIdVerificationEnabled: false })
    expect((await createIntent(t, studentToken, { fileName: 'id.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length, purpose: 'VERIFICATION_DOCUMENT' })).userErrors[0]!.code).toBe('UNAVAILABLE')

    expect((await t.gql<{ setStudentIdVerificationEnabled: { ok: boolean } }>(SET, { enabled: true }, adminToken)).data!.setStudentIdVerificationEnabled).toMatchObject({ ok: true })
    const created = await t.gql<{ createStudentIdUploadIntent: { upload: Upload | null; userErrors: Err[] } }>(INTENT, { input: { fileName: 'id.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length } }, studentToken)
    expect(created.data!.createStudentIdUploadIntent.userErrors).toEqual([])
    expect(await put(created.data!.createStudentIdUploadIntent.upload!, SAMPLES.png)).toBe(200)
    const submitted = await t.gql<{ submitStudentIdVerification: { request: { status: string } | null; userErrors: Err[] } }>(SUBMIT, { input: { fileId: created.data!.createStudentIdUploadIntent.upload!.fileId } }, studentToken)
    expect(submitted.data!.submitStudentIdVerification).toMatchObject({ request: { status: 'PENDING' }, userErrors: [] })
    const file = await db.fileObject.findUniqueOrThrow({ where: { id: created.data!.createStudentIdUploadIntent.upload!.fileId } })
    expect(file.bucket).toBe(t.config.S3_RESTRICTED_BUCKET)
  })
})

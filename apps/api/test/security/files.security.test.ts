import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { complete, createIntent, put, SAMPLES, upload } from '../support/flows'
import { seedActors, type Actors } from './support/actors'

/**
 * §17.1: pre-signed URLs stop working once access is lost (TTL ≤ 15 minutes, permission re-checked on issue), and
 * spoofed, oversized and EICAR uploads are rejected or quarantined.
 */
const FIFTEEN_MINUTES = 15 * 60
const EICAR = new TextEncoder().encode('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')

const ttlOf = (url: string) => Number(new URL(url).searchParams.get('X-Amz-Expires'))

const DOCUMENT_URL = 'query ($r: UUID!, $f: UUID!) { verificationDocumentUrl(requestId: $r, fileId: $f) { url expiresAt } }'

describe('security: files', () => {
  let t: TestApp
  let actors: Actors

  beforeAll(async () => {
    t = await createTestApp()
    actors = await seedActors(t)
  })
  afterAll(() => t.close())

  it('issues upload URLs that expire within 15 minutes', async () => {
    const { intent } = await createIntent(t, actors.a.token, { fileName: 'me.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length, purpose: 'AVATAR' })
    expect(ttlOf(intent!.uploadUrl)).toBeGreaterThan(0)
    expect(ttlOf(intent!.uploadUrl)).toBeLessThanOrEqual(FIFTEEN_MINUTES)
  })

  it('does not let B complete, see or attach A’s upload', async () => {
    const fileId = await upload(t, actors.a.token, 'VERIFICATION_DOCUMENT', 'application/pdf', SAMPLES.pdf, 'a-id.pdf')
    expect((await complete(t, actors.b.token, fileId)).userErrors[0]!.code).toBe('NOT_FOUND')
    const res = await t.gql<{ requestDocumentVerification: { request: unknown; userErrors: { code: string }[] } }>(
      'mutation ($ids: [UUID!]!) { requestDocumentVerification(input: { fileIds: $ids }) { request { id } userErrors { code } } }',
      { ids: [fileId] },
      actors.b.token,
    )
    expect(res.data!.requestDocumentVerification.request).toBeNull()
  })

  describe('identity documents (ADR-0019)', () => {
    let requestId: string
    let fileId: string

    beforeAll(async () => {
      fileId = await upload(t, actors.a.token, 'VERIFICATION_DOCUMENT', 'application/pdf', SAMPLES.pdf, 'student-card.pdf')
      const res = await t.gql<{ requestDocumentVerification: { request: { id: string } } }>(
        'mutation ($ids: [UUID!]!) { requestDocumentVerification(input: { fileIds: $ids }) { request { id } userErrors { message } } }',
        { ids: [fileId] },
        actors.a.token,
      )
      requestId = res.data!.requestDocumentVerification.request.id
    })

    it('are listed and opened only by platform admins — not the owner, another student or a teacher', async () => {
      for (const who of [actors.a, actors.b, actors.teacher]) {
        const res = await t.gql(DOCUMENT_URL, { r: requestId, f: fileId }, who.token)
        expect(res.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      }
      const listed = await t.gql<{ myVerificationRequests: { documents: unknown[] }[] }>('{ myVerificationRequests { documents { fileId } } }', {}, actors.a.token)
      expect(listed.data!.myVerificationRequests[0]!.documents).toEqual([])
    })

    it('open through a link that expires within 15 minutes, and every view is audited', async () => {
      const res = await t.gql<{ verificationDocumentUrl: { url: string; expiresAt: string } }>(DOCUMENT_URL, { r: requestId, f: fileId }, actors.admin.token)
      const { url, expiresAt } = res.data!.verificationDocumentUrl
      expect(ttlOf(url)).toBeLessThanOrEqual(FIFTEEN_MINUTES)
      expect(Date.parse(expiresAt) - Date.now()).toBeLessThanOrEqual(FIFTEEN_MINUTES * 1000)
      expect((await fetch(url)).status).toBe(200)
      const audits = await t.app.get(PrismaService).auditLog.count({ where: { actorId: actors.admin.id, action: 'verification.document.viewed', targetId: requestId } })
      expect(audits).toBe(1)
    })

    it('are refused to an admin who has lost the role, though their access token still says otherwise', async () => {
      const db = t.app.get(PrismaService)
      await db.user.update({ where: { id: actors.admin.id }, data: { globalRole: 'STUDENT' } })
      try {
        const res = await t.gql(DOCUMENT_URL, { r: requestId, f: fileId }, actors.admin.token)
        expect(res.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      } finally {
        await db.user.update({ where: { id: actors.admin.id }, data: { globalRole: 'PLATFORM_ADMIN' } })
      }
    })
  })

  describe('rejects', () => {
    it('content that is not what it claims to be (magic bytes)', async () => {
      for (const [mimeType, bytes] of [['image/png', SAMPLES.html], ['application/pdf', SAMPLES.png]] as const) {
        const { intent } = await createIntent(t, actors.a.token, { fileName: 'x', mimeType, sizeBytes: bytes.length, purpose: 'AVATAR' })
        if (!intent) continue // the type itself may be refused for this purpose — also a rejection
        await put(intent, bytes)
        expect((await complete(t, actors.a.token, intent.fileId)).ok).toBe(false)
      }
    })

    it('oversized uploads, declared or not', async () => {
      const declared = await createIntent(t, actors.a.token, { fileName: 'big.png', mimeType: 'image/png', sizeBytes: 50 * 1024 * 1024, purpose: 'AVATAR' })
      expect(declared.userErrors[0]?.code).toBe('VALIDATION')
      // Declared small, sent large: the signed Content-Length refuses the PUT, or completeUpload refuses the object.
      const { intent } = await createIntent(t, actors.a.token, { fileName: 'small.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length, purpose: 'AVATAR' })
      const bigger = new Uint8Array(SAMPLES.png.length + 4096)
      bigger.set(SAMPLES.png)
      const status = await put(intent!, bigger).catch(() => 400)
      if (status === 200) expect((await complete(t, actors.a.token, intent!.fileId)).ok).toBe(false)
      else expect(status).toBeGreaterThanOrEqual(400)
    })

    it('the EICAR test file, whatever type it claims', async () => {
      for (const mimeType of ['application/pdf', 'image/png', 'image/jpeg']) {
        const { intent } = await createIntent(t, actors.a.token, { fileName: 'eicar.com', mimeType, sizeBytes: EICAR.length, purpose: 'VERIFICATION_DOCUMENT' })
        if (!intent) continue
        await put(intent, EICAR)
        expect((await complete(t, actors.a.token, intent.fileId)).ok).toBe(false)
      }
      for (const mimeType of ['text/plain', 'application/octet-stream', 'application/x-msdownload']) {
        const res = await createIntent(t, actors.a.token, { fileName: 'eicar.com', mimeType, sizeBytes: EICAR.length, purpose: 'VERIFICATION_DOCUMENT' })
        expect(res.intent).toBeNull()
      }
    })

    it.todo('an EICAR payload inside a well-formed PDF or image is quarantined by the virus scanner (Phase 2: note attachments)')
  })

  it.todo('a note media URL issued to A stops working once A loses access to the note (Phase 2: note media)')
})

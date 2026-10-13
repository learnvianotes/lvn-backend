import { PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { createTestApp, type TestApp } from '../support/app'
import { complete, createIntent, put, SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** The upload flow of §8.1 and FileObject of §8.2, against real Postgres and S3-compatible storage. */
describe('uploads', () => {
  let t: TestApp
  let db: PrismaService
  let token: string
  let userId: string

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const user = await seedUser(t.app)
    userId = user.id
    token = tokenFor(t.config, user.id)
  })

  afterAll(() => t.close())

  it('creates a row first, takes the bytes through a pre-signed PUT and makes the file READY', async () => {
    const { intent } = await createIntent(t, token, { fileName: 'me.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length, purpose: 'AVATAR' })
    const pending = await db.fileObject.findUniqueOrThrow({ where: { id: intent!.fileId } })
    expect(pending).toMatchObject({ status: 'PENDING', ownerId: userId, bucket: 'lvn-files', originalFileName: 'me.png', storageKey: `development/${userId}/${intent!.fileId}/original` })
    expect(pending.storageKey).not.toContain('me.png')
    expect(await put(intent!, SAMPLES.png)).toBe(200)
    expect(await complete(t, token, intent!.fileId)).toEqual({ ok: true, userErrors: [] })
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: intent!.fileId } })).toMatchObject({ status: 'READY', detectedMimeType: 'image/png', expiresAt: null })
    expect(await complete(t, token, intent!.fileId)).toEqual({ ok: true, userErrors: [] }) // idempotent
  })

  it('rejects content that is not what was declared (magic bytes, §7.2) and removes it', async () => {
    const bytes = new Uint8Array(SAMPLES.png.length).fill(0x3c) // "<<<<…": not a PNG
    const { intent } = await createIntent(t, token, { fileName: 'fake.png', mimeType: 'image/png', sizeBytes: bytes.length, purpose: 'AVATAR' })
    expect(await put(intent!, bytes)).toBe(200)
    expect((await complete(t, token, intent!.fileId)).userErrors[0]).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/does not match/) })
    const row = await db.fileObject.findUniqueOrThrow({ where: { id: intent!.fileId } })
    expect(row.status).toBe('FAILED')
    expect(await t.app.get(Storage).head(row.bucket, row.storageKey)).toBeNull()
  })

  it('cannot complete an upload that never arrived', async () => {
    const { intent } = await createIntent(t, token, { fileName: 'x.png', mimeType: 'image/png', sizeBytes: 10, purpose: 'AVATAR' })
    expect((await complete(t, token, intent!.fileId)).userErrors[0]!.message).toMatch(/not arrived/)
  })

  it('does not let another user complete or see someone else’s upload', async () => {
    const { intent } = await createIntent(t, token, { fileName: 'x.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length, purpose: 'AVATAR' })
    await put(intent!, SAMPLES.png)
    const other = tokenFor(t.config, (await seedUser(t.app)).id)
    expect((await complete(t, other, intent!.fileId)).userErrors[0]!.code).toBe('NOT_FOUND')
  })

  it.each([
    [{ mimeType: 'text/html' }, ['input', 'mimeType']],
    [{ sizeBytes: 21 * 1024 * 1024 }, ['input', 'sizeBytes']],
    [{ sizeBytes: 0 }, ['input', 'sizeBytes']],
    [{ purpose: 'VOICE_NOTE' }, ['input', 'purpose']],
    // A resource's cover (ADR-0074) is a picture of at most 2 MB.
    [{ purpose: 'COVER', sizeBytes: 3 * 1024 * 1024 }, ['input', 'sizeBytes']],
    [{ purpose: 'COVER', mimeType: 'application/pdf', fileName: 'a.pdf' }, ['input', 'mimeType']],
    [{ fileName: '/// ' }, ['input', 'fileName']],
  ])('refuses %j', async (over, field) => {
    const res = await createIntent(t, token, { fileName: 'a.png', mimeType: 'image/png', sizeBytes: 100, purpose: 'AVATAR', ...over })
    expect(res.intent).toBeNull()
    expect(res.userErrors[0]).toMatchObject({ code: 'VALIDATION', field })
  })

  it('enforces the storage quota from the plan (ADR-0024)', async () => {
    const id = '01920000-0000-7000-8000-000000000101' // FREE · STORAGE_BYTES · STUDENT
    await db.entitlement.update({ where: { id }, data: { limit: 50n } })
    try {
      const res = await createIntent(t, token, { fileName: 'big.png', mimeType: 'image/png', sizeBytes: 1000, purpose: 'AVATAR' })
      expect(res.userErrors[0]!.message).toMatch(/storage is full/)
    } finally {
      await db.entitlement.update({ where: { id }, data: { limit: 5368709120n } })
    }
  })

  it('stores identity documents in the restricted bucket', async () => {
    const student = await seedUser(t.app)
    const fileId = await upload(t, tokenFor(t.config, student.id), 'VERIFICATION_DOCUMENT', 'application/pdf', SAMPLES.pdf, 'id-card.pdf')
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ bucket: 'lvn-restricted', purpose: 'VERIFICATION_DOCUMENT' })
  })

  it('refuses identity documents from restricted minors and verified accounts (ADR-0019)', async () => {
    const minor = await seedUser(t.app)
    await db.user.update({ where: { id: minor.id }, data: { dateOfBirth: new Date('2013-01-01') } })
    const verified = await seedUser(t.app, { verified: true })
    for (const who of [minor.id, verified.id]) {
      const res = await createIntent(t, tokenFor(t.config, who), { fileName: 'id.pdf', mimeType: 'application/pdf', sizeBytes: 100, purpose: 'VERIFICATION_DOCUMENT' })
      expect(res.userErrors[0]!.code).toBe('FORBIDDEN')
    }
  })

  it('requires a session', async () => {
    const res = await t.gql('mutation { createUploadIntent(input: { fileName: "a", mimeType: "image/png", sizeBytes: 1, purpose: AVATAR }) { intent { fileId } } }')
    expect(res.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })
})

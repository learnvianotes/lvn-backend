import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PDF_ENGINE_QUEUE, PdfConversionService, NOTES_PDF_QUEUE } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { Storage } from '@lvn-backend/storage'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Converting a PDF into a note (ADR-0025, ADR-0028, ADR-0040). The engine (workers/pdf-engine, Python) is played here:
 * its answers are what its own tests check it sends.
 */
describe('converting PDFs into notes', () => {
  let t: TestApp
  let db: PrismaService
  let conversions: PdfConversionService
  let storage: Storage
  let queues: Queues
  let restricted: string
  type Person = { id: string; token: string }
  let owner: Person
  let reader: Person

  const ERRORS = 'userErrors { field message code }'
  const CHAPTER = readFileSync(path.join(__dirname, '../../../../workers/pdf-engine/tests/fixtures/chapter.pdf'))
  const DOCUMENT = readFileSync(path.join(__dirname, '../../../../contexts/notes/test/fixtures/chapter.docling.json'))
  const person = async (name: string): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, displayName: name })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const convert = async (token: string, noteId: string, fileId: string) => {
    const res = await t.gql<{ convertPdfToNote: { conversion: { id: string; status: string; note: { id: string; title: string; visibility: string } } | null; userErrors: { code: string; message: string }[] } }>(
      `mutation ($input: ConvertPdfInput!) { convertPdfToNote(input: $input) { conversion { id status note { id title visibility } } ${ERRORS} } }`,
      { input: { noteId, fileId } },
      token,
    )
    if (res.errors) return { conversion: null, userErrors: [], error: res.errors[0]!.extensions.code }
    return res.data!.convertPdfToNote
  }
  const status = async (token: string, id: string) =>
    (await t.gql<{ pdfConversion: { status: string; progress: number; pages: number | null; cards: number | null; error: string | null } | null }>('query ($id: UUID!) { pdfConversion(id: $id) { status progress pages cards error } }', { id }, token)).data!.pdfConversion
  /** A note of the owner's with the chapter PDF in a file card. */
  const pdfNote = async (who: Person = owner) => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Biology' } }, who.token)
    const noteId = created.data!.createNote.note.id
    const fileId = await upload(t, who.token, 'ATTACHMENT', 'application/pdf', CHAPTER, 'Biology_chapter_3.pdf', noteId)
    await t.gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }', { input: { noteId, ops: [{ kind: 'UPSERT', id: newId(), type: 'file', position: 'a0', content: { fileId } }] } }, who.token)
    return { noteId, fileId }
  }
  /** The engine's part: a parsed PDF stored under the prefix triage chose. */
  const engineParsed = async (prefix: string) => {
    await storage.put(restricted, `${prefix}document.json`, DOCUMENT, { contentType: 'application/json' })
    await storage.put(restricted, `${prefix}pictures/0.png`, SAMPLES.png, { contentType: 'image/png' })
    const result = { bucket: restricted, documentKey: `${prefix}document.json`, pictures: [{ ref: '#/pictures/0', key: `${prefix}pictures/0.png`, width: 1, height: 1 }], pages: 1, seconds: 3.1 }
    await storage.put(restricted, `${prefix}result.json`, Buffer.from(JSON.stringify(result)), { contentType: 'application/json' })
    return result
  }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    conversions = t.app.get(PdfConversionService)
    storage = t.app.get(Storage)
    queues = t.app.get(Queues)
    restricted = t.config.S3_RESTRICTED_BUCKET
    owner = await person('Asha Rao')
    reader = await person('Ravi Kumar')
  })
  afterAll(() => t.close())

  it('turns a PDF into a new note of cards, each with its page, after the engine counts and reads it', async () => {
    const { noteId, fileId } = await pdfNote()
    const asked = await convert(owner.token, noteId, fileId)
    expect(asked.userErrors).toEqual([])
    const id = asked.conversion!.id
    expect(asked.conversion).toMatchObject({ status: 'TRIAGE', note: { title: 'Biology chapter 3', visibility: 'PRIVATE' } })
    const target = asked.conversion!.note.id
    expect(target).not.toBe(noteId)

    // The engine is asked to count the pages of the stored PDF.
    const file = await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })
    expect((await queues.queue(PDF_ENGINE_QUEUE).getJob(`${id}.triage`))?.data).toEqual({ conversionId: id, bucket: file.bucket, key: file.storageKey })

    const sha256 = createHash('sha256').update(randomBytes(16)).digest('hex')
    await conversions.triaged({ conversionId: id, pages: 1, scannedPages: 0, sha256, encrypted: false })
    expect(await status(owner.token, id)).toMatchObject({ status: 'PARSING', pages: 1 })
    expect((await queues.queue(PDF_ENGINE_QUEUE).getJob(`${id}.parse`))?.data).toEqual({ conversionId: id, bucket: file.bucket, key: file.storageKey, outputBucket: restricted, outputPrefix: `pdf-engine/${sha256}/`, ocr: false })

    const parsed = await engineParsed(`pdf-engine/${sha256}/`)
    await conversions.map({ ...parsed, conversionId: id })
    expect(await status(owner.token, id)).toMatchObject({ status: 'DONE', progress: 100, cards: 8, error: null })

    const cards = await db.card.findMany({ where: { noteId: target, deletedAt: null }, orderBy: { position: 'asc' } })
    expect(cards.map((c) => c.type)).toEqual(['file', 'heading', 'text', 'heading', 'text', 'heading', 'table', 'image', 'text'])
    for (const card of cards.slice(1)) expect(card.content).toMatchObject({ anchor: { fileId, page: 1 } })
    // The picture became a file of the new note, which its image card shows.
    const picture = cards.find((c) => c.type === 'image')!.content as { fileId: string }
    expect(await db.noteAttachment.findUnique({ where: { noteId_fileId: { noteId: target, fileId: picture.fileId } } })).not.toBeNull()
    // The note says how it was made, to the person who asked.
    const seen = await t.gql<{ note: { pdfConversion: { status: string; cards: number } | null } }>('query ($id: UUID!) { note(id: $id) { pdfConversion { status cards } } }', { id: target }, owner.token)
    expect(seen.data!.note.pdfConversion).toEqual({ status: 'DONE', cards: 8 })
    expect((await t.gql<{ pdfPagesThisMonth: { used: number; limit: number | null } }>('{ pdfPagesThisMonth { used limit } }', {}, owner.token)).data!.pdfPagesThisMonth).toEqual({ used: 1, limit: null })
  })

  it('keeps the OCR’s cards of the pages the engine chose to read again when AI is off (ADR-0063)', async () => {
    const { noteId, fileId } = await pdfNote()
    const id = (await convert(owner.token, noteId, fileId)).conversion!.id
    const sha256 = createHash('sha256').update(randomBytes(16)).digest('hex')
    await conversions.triaged({ conversionId: id, pages: 1, scannedPages: 1, sha256, encrypted: false })
    const parsed = await engineParsed(`pdf-engine/${sha256}/`)
    await conversions.map({ ...parsed, conversionId: id, escalate: [{ page: 1, reason: 'low-confidence', score: 0.4, ocr: 0.4, key: `pdf-engine/${sha256}/pages/1.png` }] })
    const seen = await t.gql<{ pdfConversion: { status: string; cards: number; aiPages: number | null; aiRejected: number | null } }>('query ($id: UUID!) { pdfConversion(id: $id) { status cards aiPages aiRejected } }', { id }, owner.token)
    expect(seen.data!.pdfConversion).toEqual({ status: 'DONE', cards: 8, aiPages: 0, aiRejected: 0 })
  })

  it('reads a PDF once: the same PDF converted again reuses what the engine read', async () => {
    const { noteId, fileId } = await pdfNote()
    const sha256 = createHash('sha256').update(randomBytes(16)).digest('hex')
    await engineParsed(`pdf-engine/${sha256}/`)
    const id = (await convert(owner.token, noteId, fileId)).conversion!.id
    await conversions.triaged({ conversionId: id, pages: 1, scannedPages: 0, sha256, encrypted: false })
    expect(await queues.queue(PDF_ENGINE_QUEUE).getJob(`${id}.parse`)).toBeUndefined()
    expect((await queues.queue(NOTES_PDF_QUEUE).getJob(`${id}.map`))?.data).toMatchObject({ conversionId: id, documentKey: `pdf-engine/${sha256}/document.json` })
    await conversions.failed({ conversionId: id, error: 'stop here' })
  })

  it('one at a time, within the page limits, and only PDFs the rule for copies allows', async () => {
    const reader2 = await person('Meena Iyer')
    const { noteId, fileId } = await pdfNote(reader2)
    const first = (await convert(reader2.token, noteId, fileId)).conversion!.id
    expect((await convert(reader2.token, noteId, fileId)).userErrors[0]).toMatchObject({ code: 'CONFLICT' })

    await conversions.triaged({ conversionId: first, pages: 301, scannedPages: 0, sha256: 'a'.repeat(64), encrypted: false })
    expect(await status(reader2.token, first)).toMatchObject({ status: 'FAILED', error: 'PDFs of up to 300 pages can be converted; this one has 301.' })

    // A monthly limit (ADR-0024: limits are data).
    const plan = await db.plan.findUniqueOrThrow({ where: { code: 'FREE' } })
    const row = await db.entitlement.create({ data: { id: newId(), planId: plan.id, key: 'PDF_PAGES_MONTHLY', limit: 5n, appliesToRole: 'STUDENT' } })
    try {
      const second = (await convert(reader2.token, noteId, fileId)).conversion!.id
      await conversions.triaged({ conversionId: second, pages: 6, scannedPages: 2, sha256: 'b'.repeat(64), encrypted: false })
      expect(await status(reader2.token, second)).toMatchObject({ status: 'FAILED', error: 'This PDF has 6 pages and you can convert 5 more this month.' })
      const third = (await convert(reader2.token, noteId, fileId)).conversion!.id
      await conversions.triaged({ conversionId: third, pages: 1, scannedPages: 0, sha256: 'c'.repeat(64), encrypted: true })
      expect(await status(reader2.token, third)).toMatchObject({ status: 'FAILED', error: 'This PDF is locked with a password, so it cannot be converted.' })
    } finally {
      await db.entitlement.delete({ where: { id: row.id } })
    }

    // Someone else's private note: not found; copies turned off: forbidden.
    expect((await convert(reader.token, noteId, fileId)).userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
    await db.note.update({ where: { id: noteId }, data: { visibility: 'PUBLIC', forkingEnabled: false } })
    await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, reader2.token)
    expect(await convert(reader.token, noteId, fileId)).toMatchObject({ error: 'FORBIDDEN' })
    // Nobody else sees a conversion.
    expect(await status(reader.token, first)).toBeNull()
  })

  it('fails conversions the engine gave up on or never answered', async () => {
    const someone = await person('Arjun Das')
    const { noteId, fileId } = await pdfNote(someone)
    const id = (await convert(someone.token, noteId, fileId)).conversion!.id
    await conversions.failed({ conversionId: id, error: 'The PDF could not be read. It may be damaged or protected.' })
    expect(await status(someone.token, id)).toMatchObject({ status: 'FAILED', error: 'The PDF could not be read. It may be damaged or protected.' })

    const stuck = (await convert(someone.token, noteId, fileId)).conversion!.id
    expect(await conversions.expireStuck(new Date(Date.now() + 3 * 3600_000))).toBeGreaterThanOrEqual(1)
    expect(await status(someone.token, stuck)).toMatchObject({ status: 'FAILED', error: 'The conversion took too long. Try again.' })
  })
})

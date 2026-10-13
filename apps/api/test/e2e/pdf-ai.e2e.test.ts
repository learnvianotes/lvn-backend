import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AiTasksService } from '@lvn-backend/ai'
import { PdfConversionService } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { startFakeOllama, type FakeOllama } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/**
 * The AI stages of PDF conversion (ADR-0063), with a stand-in model: the pages the engine chose are read again by the
 * vision model in place of the OCR's cards, unless the reading disagrees sharply; and a converted note's broken words
 * are mended, as changes its editor applies.
 */
describe('PDF pages read again and notes cleaned up', () => {
  let t: TestApp
  let db: PrismaService
  let ollama: FakeOllama
  let conversions: PdfConversionService
  let tasks: AiTasksService
  let storage: Storage
  let restricted: string
  type Person = { id: string; token: string }
  let owner: Person
  let reader: Person

  const ERRORS = 'userErrors { field message code }'
  const CHAPTER = readFileSync(path.join(__dirname, '../../../../workers/pdf-engine/tests/fixtures/chapter.pdf'))
  const DOCUMENT = readFileSync(path.join(__dirname, '../../../../contexts/notes/test/fixtures/chapter.docling.json'))
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
  const words = (content: unknown) => (JSON.stringify(content).match(/"text":"([^"]*)"/g) ?? []).map((m) => m.slice(8, -1)).join(' ')
  const person = async (name: string): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, displayName: name })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }

  /** A PDF converted with the engine played: it read the chapter and chose page 1 to be read again. */
  const converted = async (ocr: number | null) => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Biology' } }, owner.token)
    const noteId = created.data!.createNote.note.id
    const fileId = await upload(t, owner.token, 'ATTACHMENT', 'application/pdf', CHAPTER, 'Biology_chapter_3.pdf', noteId)
    await t.gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }', { input: { noteId, ops: [{ kind: 'UPSERT', id: newId(), type: 'file', position: 'a0', content: { fileId } }] } }, owner.token)
    const asked = await t.gql<{ convertPdfToNote: { conversion: { id: string; note: { id: string } } } }>(`mutation ($input: ConvertPdfInput!) { convertPdfToNote(input: $input) { conversion { id note { id } } ${ERRORS} } }`, { input: { noteId, fileId } }, owner.token)
    const id = asked.data!.convertPdfToNote.conversion.id
    const sha256 = createHash('sha256').update(randomBytes(16)).digest('hex')
    const prefix = `pdf-engine/${sha256}/`
    await conversions.triaged({ conversionId: id, pages: 1, scannedPages: 1, sha256, encrypted: false })
    await storage.put(restricted, `${prefix}document.json`, DOCUMENT, { contentType: 'application/json' })
    await storage.put(restricted, `${prefix}pictures/0.png`, SAMPLES.png, { contentType: 'image/png' })
    await storage.put(restricted, `${prefix}pages/1.png`, SAMPLES.png, { contentType: 'image/png' })
    await conversions.map({
      conversionId: id,
      bucket: restricted,
      documentKey: `${prefix}document.json`,
      pictures: [{ ref: '#/pictures/0', key: `${prefix}pictures/0.png`, width: 1, height: 1 }],
      pages: 1,
      seconds: 3.1,
      escalate: [{ page: 1, reason: 'low-confidence', score: 0.62, ocr, key: `${prefix}pages/1.png` }],
    })
    const seen = await t.gql<{ pdfConversion: { status: string; cards: number; aiPages: number | null; aiRejected: number | null } }>('query ($id: UUID!) { pdfConversion(id: $id) { status cards aiPages aiRejected } }', { id }, owner.token)
    const cards = await db.card.findMany({ where: { noteId: asked.data!.convertPdfToNote.conversion.note.id, deletedAt: null }, orderBy: { position: 'asc' } })
    return { conversion: seen.data!.pdfConversion, cards, fileId }
  }
  const page = {
    blocks: [
      { kind: 'heading', text: 'Chapter 3: Photosynthesis', level: 1 },
      { kind: 'paragraph', text: 'Photosynthesis is the process by which green plants turn light energy into chemical energy. It takes place in the chloroplast.' },
      { kind: 'list', text: '', items: ['Carbon dioxide from the air', 'Water from the soil', 'Light from the sun'] },
      { kind: 'formula', text: '6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2' },
    ],
  }

  beforeAll(async () => {
    ollama = await startFakeOllama()
    t = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    db = t.app.get(PrismaService)
    conversions = t.app.get(PdfConversionService)
    tasks = t.app.get(AiTasksService)
    storage = t.app.get(Storage)
    restricted = t.config.S3_RESTRICTED_BUCKET
    owner = await person('Asha Rao')
    reader = await person('Ravi Kumar')
  })
  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
  })

  it('reads a page the OCR was unsure of again, in place of its cards, keeping its picture and anchor', async () => {
    ollama.answer = () => JSON.stringify(page)
    const before = ollama.chats.length
    const { conversion, cards, fileId } = await converted(0.7)
    expect(conversion).toMatchObject({ status: 'DONE', aiPages: 1, aiRejected: 0 })
    // The page went to the model as an image, with the verbatim prompt, as no one's work.
    const asked = ollama.chats.slice(before)
    expect(asked).toHaveLength(1)
    expect(asked[0]!.messages.at(-1)!.images).toEqual([Buffer.from(SAMPLES.png).toString('base64')])
    expect(asked[0]!.messages[0]!.content).toContain('word for word')
    expect(await db.aiUsage.count({ where: { task: 'READ_PAGE', userId: null } })).toBe(1)
    // The reading's cards, then the page's picture; every one anchored to the page.
    expect(cards.map((c) => c.type)).toEqual(['file', 'heading', 'text', 'markdown', 'markdown', 'image'])
    for (const card of cards.slice(1)) expect(card.content).toMatchObject({ anchor: { fileId, page: 1 } })
    expect(cards[4]!.content).toMatchObject({ source: expect.stringContaining('\\rightarrow') })
    expect(conversion.cards).toBe(5)
  })

  it('keeps the OCR’s cards when the reading disagrees sharply with them, or the model fails', async () => {
    ollama.answer = () => JSON.stringify({ blocks: [{ kind: 'paragraph', text: 'The French Revolution began in 1789 with the storming of the Bastille in Paris.' }] })
    const rejected = await converted(0.7)
    expect(rejected.conversion).toMatchObject({ status: 'DONE', aiPages: 1, aiRejected: 1, cards: 8 })
    expect(rejected.cards.map((c) => c.type)).toEqual(['file', 'heading', 'text', 'heading', 'text', 'heading', 'table', 'image', 'text'])

    ollama.answer = () => ({ status: 500 })
    const failed = await converted(0.7)
    expect(failed.conversion).toMatchObject({ status: 'DONE', aiPages: 0, aiRejected: 0, cards: 8 })
  })

  it('mends a note’s broken words as changes its editor reviews and applies, never a rewrite', async () => {
    const [heading, split, header, plain] = [newId(), newId(), newId(), newId()]
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, {
      input: {
        title: 'Chapter 3',
        cards: [
          { id: heading, type: 'heading', position: 'a0', content: { level: 2, content: [{ type: 'text', text: 'Photo- synthesis' }] } },
          { id: split, type: 'text', position: 'a1', content: text('The chloro- plast turns light into chemical energy.') },
          { id: header, type: 'text', position: 'a2', content: text('Plants make glucose 12 Biology Class X from carbon dioxide and water.') },
          { id: plain, type: 'text', position: 'a3', content: text('Glucose is a sugar.') },
          { id: newId(), type: 'code', position: 'a4', content: { language: 'python', code: 'print("not mine to mend")' } },
        ],
      },
    }, owner.token)
    const noteId = created.data!.createNote.note.id
    ollama.answer = () =>
      JSON.stringify({
        changes: [
          { n: 1, text: 'Photosynthesis' },
          { n: 2, text: 'The chloroplast turns light into chemical energy.' },
          { n: 3, text: 'Plants make glucose from carbon dioxide and water.' },
          // A rewrite, not a repair: left out.
          { n: 4, text: 'Glucose is a sweet sugar that plants store as starch in their leaves.' },
          { n: 9, text: 'No such passage.' },
        ],
      })
    const ran = await t.gql<{ runAiTask: { artifact: { id: string } } }>(`mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } ${ERRORS} } }`, { input: { noteId, task: 'CLEAN_UP' } }, owner.token)
    const artifactId = ran.data!.runAiTask.artifact.id
    await tasks.process(artifactId)
    // Only the text, heading and quote cards went, numbered, fenced.
    const prompt = ollama.chats.at(-1)!.messages.at(-1)!.content
    expect(prompt).toContain('[[4]]\nGlucose is a sugar.')
    expect(prompt).not.toContain('not mine to mend')
    const changes = async () => (await t.gql<{ aiArtifact: { status: string; changes: { cardId: string; before: string; after: string; applied: boolean }[] } }>('query ($id: UUID!) { aiArtifact(id: $id) { status changes { cardId before after applied } } }', { id: artifactId }, owner.token)).data!.aiArtifact
    const proposed = await changes()
    expect(proposed.status).toBe('READY')
    expect(proposed.changes).toEqual([
      { cardId: heading, before: 'Photo- synthesis', after: 'Photosynthesis', applied: false },
      { cardId: split, before: 'The chloro- plast turns light into chemical energy.', after: 'The chloroplast turns light into chemical energy.', applied: false },
      { cardId: header, before: 'Plants make glucose 12 Biology Class X from carbon dioxide and water.', after: 'Plants make glucose from carbon dioxide and water.', applied: false },
    ])
    expect(await db.aiUsage.count({ where: { task: 'CLEAN_UP', userId: owner.id } })).toBe(1)

    // The owner edits one card meanwhile: its change is refused; the others apply, keeping each card's type and level.
    await t.gql(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { ${ERRORS} } }`, { input: { noteId, ops: [{ kind: 'UPSERT', id: header, type: 'text', position: 'a2', content: text('Plants make glucose.') }] } }, owner.token)
    const apply = async (who: Person, cardIds: string[]) =>
      t.gql<{ applyAiChanges: { applied: string[]; userErrors: { code: string }[] } }>(`mutation ($input: ApplyAiChangesInput!) { applyAiChanges(input: $input) { applied ${ERRORS} } }`, { input: { artifactId, cardIds } }, who.token)
    expect((await apply(owner, [heading, split, header])).data!.applyAiChanges).toEqual({ applied: [heading, split], userErrors: [] })
    const cards = await db.card.findMany({ where: { noteId, id: { in: [heading, split, header] } } })
    const byId = (id: string) => cards.find((c) => c.id === id)!
    expect(byId(heading)).toMatchObject({ type: 'heading', content: { level: 2 } })
    expect(words(byId(heading).content)).toBe('Photosynthesis')
    expect(words(byId(split).content)).toBe('The chloroplast turns light into chemical energy.')
    expect(words(byId(header).content)).toBe('Plants make glucose.')
    expect((await changes()).changes.map((c) => c.applied)).toEqual([true, true, false])

    // Someone else's result is not theirs to apply; a reader cannot clean up a note.
    const theirs = await apply(reader, [heading])
    expect(theirs.errors?.[0]?.extensions.code ?? theirs.data?.applyAiChanges.userErrors[0]?.code).toBe('NOT_FOUND')
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId } }, owner.token)
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId, visibility: 'PUBLIC' } }, owner.token)
    const refused = await t.gql<{ runAiTask: { userErrors: { code: string }[] } }>(`mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } ${ERRORS} } }`, { input: { noteId, task: 'CLEAN_UP' } }, reader.token)
    expect(refused.errors?.[0]?.extensions.code ?? refused.data?.runAiTask.userErrors[0]?.code).toBe('FORBIDDEN')
  })

  it('reads a long note in batches, and keeps what it found when a later batch fails', async () => {
    const long = (n: number) => `Passage ${n} about photo- synthesis. ${'Light becomes chemical energy in the leaf. '.repeat(60)}`
    const ids = [newId(), newId(), newId()]
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title: 'Long', cards: ids.map((id, i) => ({ id, type: 'text', position: `a${i}`, content: text(long(i + 1)) })) } }, owner.token)
    const noteId = created.data!.createNote.note.id
    const prompts: string[] = []
    // The model fails on the batch holding passage 3, retries included.
    ollama.answer = (req) => {
      const prompt = req.messages.at(-1)!.content
      prompts.push(prompt)
      return prompt.includes('Passage 3') ? { status: 500 } : JSON.stringify({ changes: [{ n: 1, text: prompt.match(/\[\[1\]\]\n([^\n]+)/)![1]!.replace('photo- synthesis', 'photosynthesis') }] })
    }
    const ran = await t.gql<{ runAiTask: { artifact: { id: string } } }>(`mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } ${ERRORS} } }`, { input: { noteId, task: 'CLEAN_UP' } }, owner.token)
    await tasks.process(ran.data!.runAiTask.artifact.id)
    const result = (await t.gql<{ aiArtifact: { status: string; truncated: boolean; changes: { cardId: string }[] } }>('query ($id: UUID!) { aiArtifact(id: $id) { status truncated changes { cardId } } }', { id: ran.data!.runAiTask.artifact.id }, owner.token)).data!.aiArtifact
    // Two batches: two passages of ~2,600 characters, then the third, which failed, so the note counts as not all read.
    expect(prompts[0]).toMatch(/\[\[1\]\]\nPassage 1[\s\S]*\[\[2\]\]\nPassage 2/)
    expect(prompts.slice(1).every((p) => p.includes('[[1]]\nPassage 3') && !p.includes('[[2]]'))).toBe(true)
    expect(result).toEqual({ status: 'READY', truncated: true, changes: [{ cardId: ids[0] }] })
  })
})

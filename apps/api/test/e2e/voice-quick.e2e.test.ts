import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { AiTasksService, IMAGES_TOGETHER, MAX_IMAGES } from '@lvn-backend/ai'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeOllama } from '@lvn-backend/testing'
import sharp from 'sharp'
import { createTestApp, type TestApp } from '../support/app'
import { textPdf, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Voice notes, transcription and quick notes (ADR-0062) through the API, with real ffmpeg and a stand-in model: a
 * recording is cut into 30-second pieces the model hears in order, and its transcript is a text card to keep; a quick
 * note's words and photos become a structured note; both follow the read and edit rules.
 */
describe('transcription and quick notes', () => {
  let t: TestApp
  let db: PrismaService
  let ollama: FakeOllama
  let tasks: AiTasksService
  let dir: string
  type Person = { id: string; token: string }
  let owner: Person
  let reader: Person
  let noteId = ''
  let audioCard = ''
  let textCard = ''
  const ERRORS = 'userErrors { field message code }'
  const ARTIFACT = 'id task status title cards { type content } error truncated'
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
  const docText = (content: unknown) => JSON.stringify(content).match(/"text":"([^"]*)"/g)?.map((m) => m.slice(8, -1)) ?? []

  const run = async (who: Person, input: object) => {
    const res = await t.gql<{ runAiTask: { artifact: { id: string } | null; userErrors: { code: string; message: string }[] } }>(`mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } ${ERRORS} } }`, { input }, who.token)
    return { payload: res.data?.runAiTask, error: res.errors?.[0]?.extensions.code as string | undefined }
  }
  const done = async (who: Person, input: object) => {
    const { payload, error } = await run(who, input)
    expect({ error, userErrors: payload?.userErrors }).toEqual({ error: undefined, userErrors: [] })
    await tasks.process(payload!.artifact!.id)
    return (await t.gql<{ aiArtifact: { status: string; title: string | null; cards: { type: string; content: unknown }[] | null; error: string | null; truncated: boolean } }>(`query ($id: UUID!) { aiArtifact(id: $id) { ${ARTIFACT} } }`, { id: payload!.artifact!.id }, who.token)).data!.aiArtifact
  }
  let place = 0
  const addCard = async (type: string, content: object, note = noteId) => {
    const id = newId()
    const saved = await t.gql<{ updateNoteDraft: { results: { status: string; message: string | null }[] } }>(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status message } ${ERRORS} } }`, { input: { noteId: note, ops: [{ kind: 'UPSERT', id, type, position: `b${String(++place).padStart(3, '0')}1`, content }] } }, owner.token)
    expect(saved.data?.updateNoteDraft.results[0]).toMatchObject({ status: 'APPLIED' })
    return id
  }

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'lvn-voice-'))
    ollama = await startFakeOllama()
    t = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    db = t.app.get(PrismaService)
    tasks = t.app.get(AiTasksService)
    const u = async (name: string) => {
      const s = await seedUser(t.app, { verified: true, displayName: name })
      return { id: s.id, token: tokenFor(t.config, s.id) }
    }
    owner = await u('Asha')
    reader = await u('Ravi')
    textCard = newId()
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title: 'Lecture 3', cards: [{ id: textCard, type: 'text', position: 'a0', content: text('photosynthesis: light -> sugar, chloroplast, Calvin cycle??') }] } }, owner.token)
    noteId = created.data!.createNote.note.id
    // A 65-second recording: three pieces of up to 30 seconds.
    const sound = path.join(dir, 'lecture.wav')
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=65', '-ar', '16000', '-ac', '1', sound])
    const fileId = await upload(t, owner.token, 'ATTACHMENT', 'audio/wav', readFileSync(sound), 'lecture.wav', noteId)
    audioCard = await addCard('audio', { fileId })
  })

  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('transcribes a recording piece by piece into a text card, and keeps it in the note', async () => {
    let piece = 0
    // The model sometimes wraps an answer in the prompt's fence tags (seen with gemma4): they are dropped.
    ollama.answer = () => (++piece === 3 ? `<content>Part ${piece} of the lecture.</content>` : `Part ${piece} of the lecture.`)
    const before = ollama.chats.length
    const transcript = await done(owner, { noteId, task: 'TRANSCRIBE', cardIds: [audioCard] })
    const heard = ollama.chats.slice(before)
    expect(heard).toHaveLength(3)
    // Each piece went to the model as 16 kHz mono WAV, with the transcribe prompt, in order.
    for (const [i, chat] of heard.entries()) {
      const wav = Buffer.from(chat.messages.at(-1)!.images![0]!, 'base64')
      expect(wav.toString('latin1', 0, 4)).toBe('RIFF')
      expect(wav.readUInt32LE(24)).toBe(16_000)
      expect(chat.messages.at(-1)!.content).toContain(`part ${i + 1} of 3`)
      expect(chat.stream).toBe(false)
    }
    expect(transcript).toMatchObject({ status: 'READY', title: 'Transcript — Lecture 3', truncated: false })
    expect(transcript.cards).toHaveLength(1)
    expect(transcript.cards![0]!.type).toBe('text')
    expect(docText(transcript.cards![0]!.content)).toEqual(['Part 1 of the lecture.', 'Part 2 of the lecture.', 'Part 3 of the lecture.'])
    expect(await db.aiUsage.count({ where: { userId: owner.id, task: 'TRANSCRIBE' } })).toBe(3)
  })

  it('hears one recording — the note’s only one when none is chosen — and refuses a note the person may not read', async () => {
    expect((await run(owner, { noteId, task: 'TRANSCRIBE', cardIds: [textCard] })).payload!.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'cardIds'] })
    expect((await run(owner, { noteId, task: 'TRANSCRIBE' })).payload!.userErrors).toEqual([])
    const hidden = await run(reader, { noteId, task: 'TRANSCRIBE', cardIds: [audioCard] })
    expect(hidden.error ?? hidden.payload?.userErrors[0]?.code).toBe('NOT_FOUND')
  })

  it('makes a structured note of rough words and photos, for the note’s owner only', async () => {
    const photo = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#16a34a' } }).png().toBuffer()
    const fileIds: string[] = []
    for (let i = 0; i < IMAGES_TOGETHER; i++) fileIds.push(await upload(t, owner.token, 'ATTACHMENT', 'image/png', photo, `board${i}.png`, noteId))
    for (const fileId of fileIds) await addCard('image', { fileId, alt: '' })
    ollama.answer = () => JSON.stringify({ title: 'Photosynthesis', sections: [{ heading: 'Light reactions', text: 'Light becomes chemical energy in the chloroplast.' }, { heading: 'Calvin cycle', text: 'Carbon dioxide is fixed into sugar.' }] })
    const quick = await done(owner, { noteId, task: 'QUICK_NOTE' })
    const asked = ollama.chats.at(-1)!
    const images = asked.messages.at(-1)!.images!
    // Four photos go with the request, as JPEGs no wider than 1,280 pixels; the rough words fenced in the prompt.
    expect(images).toHaveLength(IMAGES_TOGETHER)
    const first = await sharp(Buffer.from(images[0]!, 'base64')).metadata()
    expect({ format: first.format, width: first.width }).toEqual({ format: 'jpeg', width: 1280 })
    expect(asked.messages.at(-1)!.content).toContain('photosynthesis: light -> sugar')
    expect(quick).toMatchObject({ status: 'READY', title: 'Photosynthesis' })
    expect(quick.cards!.map((c) => c.type)).toEqual(['heading', 'text', 'heading', 'text'])

    // A reader cannot make a quick note of someone else's note.
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId } }, owner.token)
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId, visibility: 'PUBLIC' } }, owner.token)
    const refused = await run(reader, { noteId, task: 'QUICK_NOTE' })
    expect(refused.error ?? refused.payload?.userErrors[0]?.code).toBe('FORBIDDEN')
  })

  it('reads more photos than go together one by one, up to ten, and a PDF’s words, then makes one note of them', async () => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title: 'Cells', cards: [{ id: newId(), type: 'text', position: 'a0', content: text('membranes: what crosses?') }] } }, owner.token)
    const many = created.data!.createNote.note.id
    const photo = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#2563eb' } }).jpeg().toBuffer()
    for (let i = 0; i < MAX_IMAGES + 1; i++) await addCard('image', { fileId: await upload(t, owner.token, 'ATTACHMENT', 'image/jpeg', photo, `page${i}.jpg`, many), alt: '' }, many)
    await addCard('file', { fileId: await upload(t, owner.token, 'ATTACHMENT', 'application/pdf', textPdf([['Osmosis moves water', 'across a membrane.'], ['Diffusion needs no energy.']]), 'handout.pdf', many) }, many)
    let read = 0
    ollama.answer = (req) =>
      req.messages[0]!.content.includes('transcribe pages')
        ? JSON.stringify({ blocks: [{ kind: 'heading', text: `Page ${++read}`, level: 2 }, { kind: 'paragraph', text: 'Water crosses the membrane.' }] })
        : JSON.stringify({ title: 'Cell membranes', sections: [{ heading: 'Osmosis', text: 'Water crosses a membrane by osmosis.' }] })
    const before = ollama.chats.length
    const quick = await done(owner, { noteId: many, task: 'QUICK_NOTE' })
    const chats = ollama.chats.slice(before)
    // Ten photos, each read on its own (the eleventh is past the limit), then one request with what they and the PDF say.
    expect(chats).toHaveLength(MAX_IMAGES + 1)
    expect(chats.slice(0, MAX_IMAGES).map((c) => c.messages.at(-1)!.images?.length)).toEqual(Array(MAX_IMAGES).fill(1))
    const asked = chats.at(-1)!.messages.at(-1)!
    expect(asked.images ?? []).toEqual([])
    expect(asked.content).toContain('membranes: what crosses?')
    expect(asked.content).toContain(`Photo ${MAX_IMAGES}:\n## Page ${MAX_IMAGES}\n\nWater crosses the membrane.`)
    expect(asked.content).not.toContain(`Photo ${MAX_IMAGES + 1}:`)
    expect(asked.content).toContain('PDF 1:\nOsmosis moves water\nacross a membrane.\n\nDiffusion needs no energy.')
    expect(quick).toMatchObject({ status: 'READY', title: 'Cell membranes' })
  })

  it('lets a reader transcribe a public note’s recording for themselves, kept as their own note', async () => {
    ollama.answer = () => 'What the lecturer said.'
    const mine = await done(reader, { noteId, task: 'TRANSCRIBE', cardIds: [audioCard] })
    expect(mine.status).toBe('READY')
  })
})

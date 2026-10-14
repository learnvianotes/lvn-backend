import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { AiTasksService, AskService } from '@lvn-backend/ai'
import { newId } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeChatRequest, type FakeOllama } from '@lvn-backend/testing'
import sharp from 'sharp'
import { createTestApp, type TestApp } from '../support/app'
import { textPdf, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/**
 * AI reads everything a note holds (ADR-0085): every task and Ask AI take the note's words with what its photos say
 * (each photo read once), its PDFs' words and its recordings' transcripts; a recording must be transcribed first; and
 * what a quick note kept into the note is not read again.
 */
describe('AI reads a note’s photos, PDFs and recordings', () => {
  let t: TestApp
  let ollama: FakeOllama
  let tasks: AiTasksService
  let ask: AskService
  let dir: string
  let owner: { id: string; token: string }
  let place = 0
  const ERRORS = 'userErrors { field message code }'
  /** One answer every structured task accepts (extra fields are dropped); words for a recording or a question. */
  const STRUCTURED = JSON.stringify({ summary: 'Water crosses membranes.', keyPoints: ['Osmosis'], title: 'Membranes', text: 'Water crosses a membrane by osmosis.', sections: [{ heading: 'Osmosis', text: 'Water crosses a membrane by osmosis.' }] })
  const reading = (req: FakeChatRequest) => req.messages[0]!.content.includes('transcribe pages')
  let reads = 0

  const gql = <T>(query: string, variables: object) => t.gql<T>(query, variables, owner.token)
  const newNote = async (title: string) => (await gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title } })).data!.createNote.note.id
  const addCard = async (noteId: string, type: string, content: object) => {
    const saved = await gql<{ updateNoteDraft: { results: { status: string }[] } }>(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } ${ERRORS} } }`, { input: { noteId, ops: [{ kind: 'UPSERT', id: newId(), type, position: `b${String(++place).padStart(3, '0')}1`, content }] } })
    expect(saved.data?.updateNoteDraft.results[0]).toMatchObject({ status: 'APPLIED' })
  }
  const run = async (input: object) => (await gql<{ runAiTask: { artifact: { id: string } | null; userErrors: { message: string }[] } }>(`mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } ${ERRORS} } }`, { input })).data!.runAiTask
  const done = async (input: object) => {
    const { artifact, userErrors } = await run(input)
    expect(userErrors).toEqual([])
    await tasks.process(artifact!.id)
    const read = await gql<{ aiArtifact: { id: string; status: string; error: string | null; cards: unknown[] | null } }>(`query ($id: UUID!) { aiArtifact(id: $id) { id status error cards { type } } }`, { id: artifact!.id })
    return { ...read.data!.aiArtifact, asked: ollama.chats.at(-1)!.messages.at(-1)! }
  }
  const photo = async (noteId: string, colour: string) => addCard(noteId, 'image', { fileId: await upload(t, owner.token, 'ATTACHMENT', 'image/jpeg', await sharp({ create: { width: 1200, height: 900, channels: 3, background: colour } }).jpeg().toBuffer(), 'page.jpg', noteId), alt: '' })

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'lvn-material-'))
    ollama = await startFakeOllama()
    ollama.answer = (req) => (reading(req) ? JSON.stringify({ blocks: [{ kind: 'heading', text: `Page ${++reads}`, level: 2 }, { kind: 'paragraph', text: 'Water crosses the membrane.' }] }) : req.format ? STRUCTURED : 'Enzymes speed up reactions.')
    t = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    tasks = t.app.get(AiTasksService)
    ask = t.app.get(AskService)
    const s = await seedUser(t.app, { verified: true, displayName: 'Asha' })
    owner = { id: s.id, token: tokenFor(t.config, s.id) }
  })

  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('every task reads what a note’s photos and PDFs say, reads each photo once, and not again once kept into the note', async () => {
    const noteId = await newNote('Membranes')
    await photo(noteId, '#16a34a')
    await photo(noteId, '#2563eb')
    await addCard(noteId, 'file', { fileId: await upload(t, owner.token, 'ATTACHMENT', 'application/pdf', textPdf([['Osmosis moves water', 'across a membrane.']]), 'handout.pdf', noteId) })

    const summary = await done({ noteId, task: 'SUMMARIZE' })
    expect(summary.status).toBe('READY')
    expect(reads).toBe(2)
    expect(summary.asked.images ?? []).toEqual([])
    expect(summary.asked.content).toContain('Photo 1:\n## Page 1\n\nWater crosses the membrane.')
    expect(summary.asked.content).toContain('Photo 2:\n## Page 2')
    expect(summary.asked.content).toContain('PDF 1:\nOsmosis moves water\nacross a membrane.')

    // Another task: the photos are not read again.
    const translated = await done({ noteId, task: 'TRANSLATE', language: 'HINDI' })
    expect(translated.status).toBe('READY')
    expect(reads).toBe(2)
    expect(translated.asked.content).toContain('Photo 2:\n## Page 2')

    // A quick note kept into the note: its words stand for the photos and the PDF from then on.
    const quick = await done({ noteId, task: 'QUICK_NOTE' })
    expect(quick.asked.images).toHaveLength(2)
    const kept = await gql<{ keepAiCards: { noteId: string | null; userErrors: unknown[] } }>(`mutation ($input: KeepAiCardsInput!) { keepAiCards(input: $input) { noteId ${ERRORS} } }`, { input: { artifactId: quick.id, cardIndexes: quick.cards!.map((_, i) => i), into: 'NOTE' } })
    expect(kept.data?.keepAiCards).toEqual({ noteId, userErrors: [] })
    const again = await done({ noteId, task: 'SUMMARIZE' })
    expect(again.asked.content).toContain('Water crosses a membrane by osmosis.')
    expect(again.asked.content).not.toContain('Photo 1:')
    expect(again.asked.content).not.toContain('PDF 1:')
  })

  it('reads a recording from its transcript, once there is one', async () => {
    const noteId = await newNote('Enzymes')
    const sound = path.join(dir, 'talk.wav')
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=5', '-ar', '16000', '-ac', '1', sound])
    await addCard(noteId, 'audio', { fileId: await upload(t, owner.token, 'ATTACHMENT', 'audio/wav', readFileSync(sound), 'talk.wav', noteId) })
    expect((await run({ noteId, task: 'SUMMARIZE' })).userErrors).toEqual([expect.objectContaining({ message: 'Transcribe the recording first: AI tasks work on what it says.' })])

    expect((await done({ noteId, task: 'TRANSCRIBE' })).status).toBe('READY')
    const summary = await done({ noteId, task: 'SUMMARIZE' })
    expect(summary.status).toBe('READY')
    expect(summary.asked.content).toContain('Recording 1:\nEnzymes speed up reactions.')
  })

  it('answers a question about a note of photos from what they say', async () => {
    const noteId = await newNote('Board')
    await photo(noteId, '#dc2626')
    const asked = await gql<{ askAi: { answer: { id: string } | null; userErrors: unknown[] } }>(`mutation ($input: AskAiInput!) { askAi(input: $input) { answer { id } ${ERRORS} } }`, { input: { question: 'What crosses the membrane?', scope: 'THIS_NOTE', noteId } })
    expect(asked.data?.askAi.userErrors).toEqual([])
    await ask.process(asked.data!.askAi.answer!.id)
    const answered = await gql<{ aiAnswer: { status: string } }>(`query ($id: UUID!) { aiAnswer(id: $id) { status } }`, { id: asked.data!.askAi.answer!.id })
    expect(answered.data!.aiAnswer.status).toBe('READY')
    expect(ollama.chats.at(-1)!.messages.map((m) => m.content).join('\n')).toContain('Water crosses the membrane.')
  })
})

import { AiExport, AiTasksService } from '@lvn-backend/ai'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeOllama } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * AI tasks on notes (ADR-0025, ADR-0059) through the API, with a stand-in model: results beside the note for whoever
 * may read it, cards kept into the note (editors) or a new private note (anyone), the fork rule for new notes, the
 * day's allowance, and results that follow access.
 */
describe('AI tasks', () => {
  let t: TestApp
  let db: PrismaService
  let ollama: FakeOllama
  let tasks: AiTasksService
  type Person = { id: string; token: string }
  let owner: Person
  let reader: Person
  let stranger: Person
  let noteId = ''
  const ERRORS = 'userErrors { field message code }'
  const ARTIFACT = 'id task status language markdown title cards { type content } error fromPublishedVersion truncated keptAt'
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })

  const run = async (who: Person, input: object) => {
    const res = await t.gql<{ runAiTask: { artifact: { id: string; status: string } | null; userErrors: { code: string; message: string }[] } }>(`mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id status } ${ERRORS} } }`, { input }, who.token)
    return { payload: res.data?.runAiTask, error: res.errors?.[0]?.extensions.code }
  }
  /** Runs a task and lets the worker's part run in place. */
  const done = async (who: Person, input: object) => {
    const { payload } = await run(who, input)
    expect(payload?.userErrors).toEqual([])
    await tasks.process(payload!.artifact!.id)
    return (await t.gql<{ aiArtifact: Record<string, unknown> }>(`query ($id: UUID!) { aiArtifact(id: $id) { ${ARTIFACT} } }`, { id: payload!.artifact!.id }, who.token)).data!.aiArtifact
  }
  const keep = async (who: Person, input: object) => {
    const res = await t.gql<{ keepAiCards: { noteId: string | null; userErrors: { code: string }[] } }>(`mutation ($input: KeepAiCardsInput!) { keepAiCards(input: $input) { noteId ${ERRORS} } }`, { input }, who.token)
    return { payload: res.data?.keepAiCards, error: res.errors?.[0]?.extensions.code }
  }

  beforeAll(async () => {
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
    stranger = await u('Dev')
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, {
      input: { title: 'Heaps', cards: [{ id: newId(), type: 'text', position: 'a0', content: text('A heap keeps the smallest item on top.') }, { id: newId(), type: 'code', position: 'a1', content: { language: 'python', code: 'import heapq\nheapq.heappush(h, 3)' } }] },
    }, owner.token)
    noteId = created.data!.createNote.note.id
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId } }, owner.token)
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId, visibility: 'PUBLIC' } }, owner.token)
  })

  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
  })

  it('summarises for a reader from the published version, as text beside the note', async () => {
    ollama.answer = () => JSON.stringify({ summary: 'Heaps keep the smallest on top.', keyPoints: ['Min-heap', 'heapq'] })
    const artifact = await done(reader, { noteId, task: 'SUMMARIZE' })
    expect(artifact).toMatchObject({ task: 'SUMMARIZE', status: 'READY', language: 'ENGLISH', markdown: 'Heaps keep the smallest on top.\n\n- Min-heap\n- heapq', fromPublishedVersion: true, cards: null })
    // The model read the note, fenced; the person's usage is counted.
    expect(ollama.chats.at(-1)!.messages[1]!.content).toContain('<content>\nA heap keeps the smallest item on top.')
    expect(await db.aiUsage.count({ where: { userId: reader.id, task: 'SUMMARIZE', ok: true } })).toBe(1)
  })

  it('explains only the code cards, and says so when a note has none', async () => {
    ollama.answer = () => JSON.stringify({ explanation: 'It pushes 3 onto a heap.', steps: ['Import heapq', 'Push 3'] })
    expect(await done(reader, { noteId, task: 'EXPLAIN_CODE' })).toMatchObject({ status: 'READY', markdown: expect.stringContaining('1. Import heapq') })
    expect(ollama.chats.at(-1)!.messages[1]!.content).toContain('```python\nimport heapq')
    expect(ollama.chats.at(-1)!.messages[1]!.content).not.toContain('smallest item')
    const plain = (await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }`, { input: { title: 'No code', cards: [{ id: newId(), type: 'text', position: 'a0', content: text('Words only.') }] } }, owner.token)).data!.createNote.note.id
    expect((await run(owner, { noteId: plain, task: 'EXPLAIN_CODE' })).payload!.userErrors[0]).toMatchObject({ code: 'VALIDATION', message: 'This note has no code to explain.' })
  })

  it('makes flashcards a reader keeps as a new private note of their own, not into someone else’s note', async () => {
    ollama.answer = () => JSON.stringify({ cards: [{ front: 'What is on top of a min-heap?', back: 'The smallest item.' }, { front: 'Python module?', back: 'heapq' }] })
    const artifact = await done(reader, { noteId, task: 'FLASHCARDS' })
    expect(artifact).toMatchObject({ status: 'READY', title: 'Flashcards — Heaps' })
    expect((artifact.cards as { type: string }[]).map((c) => c.type)).toEqual(['flashcard', 'flashcard'])
    expect((await keep(reader, { artifactId: artifact.id, cardIndexes: [0, 1], into: 'NOTE' })).error).toBe('FORBIDDEN')
    const kept = (await keep(reader, { artifactId: artifact.id, cardIndexes: [1], into: 'NEW_NOTE' })).payload!.noteId!
    const note = await db.note.findUniqueOrThrow({ where: { id: kept }, include: { cards: true } })
    expect(note).toMatchObject({ ownerId: reader.id, visibility: 'PRIVATE', title: 'Flashcards — Heaps', forkedFromNoteId: null })
    expect(note.cards.map((c) => c.type)).toEqual(['flashcard'])
  })

  it('lets the owner add a generated quiz to the note itself, as quiz cards', async () => {
    ollama.answer = () => JSON.stringify({ questions: [{ question: 'Which item is on top of a min-heap?', choices: ['The largest', 'The smallest', 'A random one'], correct: [1], explanation: 'A min-heap keeps the smallest on top.' }] })
    const artifact = await done(owner, { noteId, task: 'QUIZ' })
    expect(artifact.fromPublishedVersion).toBe(false)
    expect(artifact.cards).toEqual([{ type: 'quiz', content: expect.objectContaining({ correct: ['c2'], multiple: false }) }])
    expect((await keep(owner, { artifactId: artifact.id, cardIndexes: [0], into: 'NOTE' })).payload!.noteId).toBe(noteId)
    expect((await db.card.findMany({ where: { noteId, deletedAt: null } })).map((c) => c.type)).toEqual(['text', 'code', 'quiz'])
    expect(await db.noteArtifact.findUniqueOrThrow({ where: { id: artifact.id as string } })).toMatchObject({ keptAt: expect.any(Date) })
  })

  it('makes a note of one’s own from someone else’s only when copies are allowed, with the credit (ADR-0010)', async () => {
    await t.gql(`mutation ($input: SetNoteForkingInput!) { setNoteForking(input: $input) { ${ERRORS} } }`, { input: { noteId, enabled: false } }, owner.token)
    expect((await run(reader, { noteId, task: 'CREATE_NOTES' })).error).toBe('FORBIDDEN')
    await t.gql(`mutation ($input: SetNoteForkingInput!) { setNoteForking(input: $input) { ${ERRORS} } }`, { input: { noteId, enabled: true } }, owner.token)
    ollama.answer = () => JSON.stringify({ title: 'My heap notes', sections: [{ heading: 'Heaps', text: 'The smallest item stays on top.' }] })
    const artifact = await done(reader, { noteId, task: 'CREATE_NOTES' })
    expect((await keep(reader, { artifactId: artifact.id, cardIndexes: [0, 1], into: 'NOTE' })).payload!.userErrors[0]!.code).toBe('VALIDATION')
    const kept = (await keep(reader, { artifactId: artifact.id, cardIndexes: [0, 1], into: 'NEW_NOTE' })).payload!.noteId!
    expect(await db.note.findUniqueOrThrow({ where: { id: kept } })).toMatchObject({ ownerId: reader.id, title: 'My heap notes', forkedFromNoteId: noteId, forkedFromOwnerId: owner.id })
  })

  it('records a failure in words when the model answers nonsense twice', async () => {
    ollama.answer = () => 'not json'
    expect(await done(reader, { noteId, task: 'KEY_CONCEPTS' })).toMatchObject({ status: 'FAILED', error: 'The AI’s answer could not be used. Try again.' })
  })

  it('refuses past the day’s allowance, and to people who cannot read the note', async () => {
    expect((await run(stranger, { noteId: newId(), task: 'SUMMARIZE' })).payload!.userErrors[0]!.code).toBe('NOT_FOUND')
    await db.aiUsage.create({ data: { id: newId(), userId: stranger.id, task: 'SUMMARIZE', provider: 'OLLAMA', model: 'gemma4', promptTokens: 200_000, completionTokens: 0, latencyMs: 1, ok: true } })
    expect((await run(stranger, { noteId, task: 'SUMMARIZE' })).payload!.userErrors[0]).toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('shows each person only their own results, and only while they can read the note', async () => {
    const list = async (who: Person) => (await t.gql<{ note: { aiArtifacts: { task: string }[] } | null }>('query ($id: UUID!) { note(id: $id) { aiArtifacts { task } } }', { id: noteId }, who.token)).data!.note
    expect((await list(owner))!.aiArtifacts.map((a) => a.task)).toEqual(['QUIZ'])
    expect((await list(reader))!.aiArtifacts.map((a) => a.task)).toEqual(['KEY_CONCEPTS', 'CREATE_NOTES', 'FLASHCARDS', 'EXPLAIN_CODE', 'SUMMARIZE'])
    const mine = await db.noteArtifact.findFirstOrThrow({ where: { ownerId: reader.id, task: 'SUMMARIZE' } })
    expect((await t.gql<{ aiArtifact: unknown }>('query ($id: UUID!) { aiArtifact(id: $id) { id } }', { id: mine.id }, owner.token)).data!.aiArtifact).toBeNull()
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId, visibility: 'PRIVATE' } }, owner.token)
    expect((await t.gql<{ aiArtifact: unknown }>('query ($id: UUID!) { aiArtifact(id: $id) { id } }', { id: mine.id }, reader.token)).data!.aiArtifact).toBeNull()
    // They are still in the person's data export, and deleting removes them.
    const exported = await t.app.get(AiExport).exportFor(reader.id)
    expect(exported.counts.aiResults).toBe(5)
    const deleted = await t.gql<{ deleteAiArtifact: { ok: boolean } }>('mutation ($id: UUID!) { deleteAiArtifact(id: $id) { ok } }', { id: mine.id }, reader.token)
    expect(deleted.data!.deleteAiArtifact.ok).toBe(true)
    expect(await db.noteArtifact.count({ where: { id: mine.id } })).toBe(0)
  })
})

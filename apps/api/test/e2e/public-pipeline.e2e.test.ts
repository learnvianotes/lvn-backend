import { AiTasksService, PublicPipeline } from '@lvn-backend/ai'
import { LiveNotifier } from '@lvn-backend/communication'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeChatRequest, type FakeOllama } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Study aids for public notes (§10.3, ADR-0061) through the API, with a stand-in model: a PUBLIC publish queues the
 * five aids for that version; they are the platform's work, announced to the owner and the public page; readers (signed
 * in or not) see the READY ones the owner has not hidden and keep their cards; a new version replaces them, keeping what
 * was hidden; private notes get none.
 */
describe('public-note pipeline', () => {
  let t: TestApp
  let db: PrismaService
  let ollama: FakeOllama
  let tasks: AiTasksService
  let pipeline: PublicPipeline
  let bus: InProcessEventBus
  type Person = { id: string; token: string }
  let owner: Person
  let reader: Person
  let noteId = ''
  const ERRORS = 'userErrors { field message code }'
  const INSIGHT = 'id task status markdown title cards { type content } hidden versionId'
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
  const ready: string[] = []

  /** What the stand-in model answers, by the shape each aid asks for. */
  const answerFor = (req: FakeChatRequest) => {
    const shape = JSON.stringify(req.format ?? {})
    if (shape.includes('"summary"')) return JSON.stringify({ summary: 'Heaps keep the smallest item on top.', keyPoints: ['Min-heap'] })
    if (shape.includes('"concepts"')) return JSON.stringify({ concepts: [{ term: 'Heap', explanation: 'A tree kept in order.' }] })
    if (shape.includes('"choices"')) return JSON.stringify({ questions: [{ question: 'Where is the smallest item?', choices: ['Root', 'Leaf'], correct: [0], explanation: 'A min-heap keeps it on top.' }] })
    if (shape.includes('"questions"')) return JSON.stringify({ questions: [{ question: 'What is a heap?', answer: 'A tree kept in order.' }] })
    if (shape.includes('"cards"')) return JSON.stringify({ cards: [{ front: 'Min-heap root?', back: 'The smallest item' }, { front: 'Insert cost?', back: 'O(log n)' }] })
    return 'unexpected'
  }
  const insights = async (token?: string) => (await t.gql<{ note: { aiInsights: { id: string; task: string; status: string; hidden: boolean; versionId: string; markdown: string | null; cards: unknown[] | null }[]; noteProcessingStatus: { versionId: string; steps: { task: string; status: string }[]; done: boolean } | null } | null }>(`query ($id: UUID!) { note(id: $id) { aiInsights { ${INSIGHT} } noteProcessingStatus { versionId steps { task status } done } } }`, { id: noteId }, token)).data!.note
  const runAll = async () => {
    for (const a of await db.noteArtifact.findMany({ where: { noteId, ownerId: null, status: 'QUEUED' } })) await tasks.process(a.id)
    await bus.drain()
  }
  const publish = async () => {
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId } }, owner.token)
    await bus.drain()
  }

  beforeAll(async () => {
    ollama = await startFakeOllama()
    ollama.answer = answerFor
    t = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    db = t.app.get(PrismaService)
    tasks = t.app.get(AiTasksService)
    pipeline = t.app.get(PublicPipeline)
    bus = t.app.get(InProcessEventBus)
    bus.subscribe('NoteArtifactReady', (e) => void ready.push(e.payload.artifactType))
    const u = async (name: string, verified: boolean) => {
      const s = await seedUser(t.app, { verified, displayName: name })
      return { id: s.id, token: tokenFor(t.config, s.id) }
    }
    owner = await u('Asha', true)
    reader = await u('Ravi', false)
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title: 'Heaps', cards: [{ id: newId(), type: 'text', position: 'a0', content: text('A min-heap keeps the smallest item on top.') }] } }, owner.token)
    noteId = created.data!.createNote.note.id
  })

  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
  })

  it('makes nothing for a note that is not public', async () => {
    await publish()
    expect(await db.noteArtifact.count({ where: { noteId } })).toBe(0)
  })

  it('queues the five aids when the note becomes public, and makes them as the platform’s work, told to the owner', async () => {
    const live = jest.spyOn(t.app.get(LiveNotifier), 'notify')
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId, visibility: 'PUBLIC' } }, owner.token)
    await bus.drain()
    const queued = await insights(owner.token)
    expect(queued!.noteProcessingStatus).toMatchObject({ done: false, steps: ['SUMMARIZE', 'KEY_CONCEPTS', 'PRACTICE_QUESTIONS', 'QUIZ', 'FLASHCARDS'].map((task) => ({ task, status: 'QUEUED' })) })
    const version = (await db.note.findUniqueOrThrow({ where: { id: noteId } })).publishedVersionId
    expect(queued!.noteProcessingStatus!.versionId).toBe(version)
    // Readers see nothing until an aid is READY.
    expect((await insights(reader.token))!.aiInsights).toEqual([])
    // A second announcement of the same version starts nothing more.
    expect(await pipeline.start(noteId, version!)).toBe(0)

    await runAll()
    const done = (await insights(owner.token))!
    expect(done.noteProcessingStatus!.done).toBe(true)
    expect(done.aiInsights.map((i) => [i.task, i.status])).toEqual([['SUMMARIZE', 'READY'], ['KEY_CONCEPTS', 'READY'], ['PRACTICE_QUESTIONS', 'READY'], ['QUIZ', 'READY'], ['FLASHCARDS', 'READY']])
    expect(done.aiInsights[0]!.markdown).toBe('Heaps keep the smallest item on top.\n\n- Min-heap')
    expect(await db.aiUsage.count({ where: { userId: null, task: 'SUMMARIZE' } })).toBe(1)
    expect(ready.sort()).toEqual(['FLASHCARDS', 'KEY_CONCEPTS', 'PRACTICE_QUESTIONS', 'QUIZ', 'SUMMARIZE'])
    expect(live).toHaveBeenCalledWith(owner.id, 'NOTE_PROCESSING', noteId)
    live.mockRestore()
  })

  it('shows readers, signed in or not, what the owner has not hidden; only the owner hides', async () => {
    expect((await insights())!.aiInsights).toHaveLength(5)
    expect((await insights(reader.token))!.noteProcessingStatus).toBeNull()
    const summary = (await insights(owner.token))!.aiInsights.find((i) => i.task === 'SUMMARIZE')!
    const refuse = await t.gql<{ setAiInsightHidden: { ok: boolean; userErrors: { code: string }[] } }>('mutation ($id: UUID!) { setAiInsightHidden(id: $id, hidden: true) { ok userErrors { code } } }', { id: summary.id }, reader.token)
    expect(refuse.errors?.[0]?.extensions.code ?? refuse.data?.setAiInsightHidden.userErrors[0]?.code).toBe('NOT_FOUND')
    const hide = await t.gql<{ setAiInsightHidden: { ok: boolean } }>('mutation ($id: UUID!) { setAiInsightHidden(id: $id, hidden: true) { ok userErrors { code } } }', { id: summary.id }, owner.token)
    expect(hide.data!.setAiInsightHidden.ok).toBe(true)
    expect((await insights(reader.token))!.aiInsights.map((i) => i.task)).toEqual(['KEY_CONCEPTS', 'PRACTICE_QUESTIONS', 'QUIZ', 'FLASHCARDS'])
    expect((await insights())!.aiInsights.map((i) => i.task)).not.toContain('SUMMARIZE')
    expect((await insights(owner.token))!.aiInsights.find((i) => i.task === 'SUMMARIZE')!.hidden).toBe(true)
  })

  it('lets a reader keep the flashcards as a note of their own, but not add them to the author’s note', async () => {
    const flashcards = (await insights(reader.token))!.aiInsights.find((i) => i.task === 'FLASHCARDS')!
    const keep = (into: string, who: Person) => t.gql<{ keepAiCards: { noteId: string | null; userErrors: { code: string }[] } }>(`mutation ($input: KeepAiCardsInput!) { keepAiCards(input: $input) { noteId ${ERRORS} } }`, { input: { artifactId: flashcards.id, cardIndexes: [1], into } }, who.token)
    const mine = (await keep('NEW_NOTE', reader)).data!.keepAiCards.noteId!
    const kept = await t.gql<{ note: { viewerAccess: string; visibility: string; cards: { edges: { node: { type: string } }[] } } }>('query ($id: UUID!) { note(id: $id) { viewerAccess visibility cards { edges { node { type } } } } }', { id: mine }, reader.token)
    expect(kept.data!.note).toMatchObject({ viewerAccess: 'OWNER', visibility: 'PRIVATE', cards: { edges: [{ node: { type: 'flashcard' } }] } })
    const into = await keep('NOTE', reader)
    expect(into.errors?.[0]?.extensions.code ?? into.data!.keepAiCards.userErrors[0]?.code).toBe('FORBIDDEN')
    // The shared aid records nothing of anyone's keeping; its owner may add it to the note.
    expect((await db.noteArtifact.findUniqueOrThrow({ where: { id: flashcards.id } })).keptAt).toBeNull()
    expect((await keep('NOTE', owner)).data!.keepAiCards.noteId).toBe(noteId)
  })

  it('replaces the aids with a new version’s, keeping what the owner hid', async () => {
    const before = (await insights(owner.token))!.aiInsights.map((i) => i.id)
    await t.gql(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { ${ERRORS} } }`, { input: { noteId, title: 'Binary heaps' } }, owner.token)
    await publish()
    const fresh = (await insights(owner.token))!
    expect(fresh.aiInsights.map((i) => i.id).some((id) => before.includes(id))).toBe(false)
    expect(fresh.aiInsights.map((i) => [i.task, i.status, i.hidden])).toEqual([['SUMMARIZE', 'QUEUED', true], ['KEY_CONCEPTS', 'QUEUED', false], ['PRACTICE_QUESTIONS', 'QUEUED', false], ['QUIZ', 'QUEUED', false], ['FLASHCARDS', 'QUEUED', false]])
  })

  it('makes nothing of a version that is no longer public by its turn, and shows nothing to readers who lost the note', async () => {
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId, visibility: 'PRIVATE' } }, owner.token)
    await runAll()
    const owners = (await insights(owner.token))!
    expect(owners.aiInsights.every((i) => i.status === 'FAILED')).toBe(true)
    expect(await insights(reader.token)).toBeNull()
    expect(await insights()).toBeNull()
  })

  it('starts nothing where the pipeline is switched off', async () => {
    const off = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma', AI_PUBLIC_PIPELINE: 'false' }, { resetDatabase: false })
    try {
      expect(await off.app.get(PublicPipeline).start(noteId, newId())).toBe(0)
    } finally {
      await off.close()
    }
  })
})

import { AiExport, AskService } from '@lvn-backend/ai'
import { LiveNotifier } from '@lvn-backend/communication'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { NoteChunks, SEMANTIC_SEARCH, type SemanticSearch } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeOllama } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Ask AI (§10.2, ADR-0060) through the API, with a stand-in model: one note as its asker reads it, chunks embedded per
 * published version, retrieval over my notes, my groups and public notes within what the asker may read, a workspace
 * doubt, streaming announced on the live channel, the refusals, and the answers' history and export.
 */
describe('Ask AI', () => {
  let t: TestApp
  let db: PrismaService
  let ollama: FakeOllama
  let ask: AskService
  let chunks: NoteChunks
  let bus: InProcessEventBus
  type Person = { id: string; token: string; handle: string }
  let asha: Person
  let ravi: Person
  let dev: Person
  const notes: Record<string, string> = {}
  const cards: Record<string, string> = {}
  const ERRORS = 'userErrors { field message code }'
  const ANSWER = 'id question scope status text sources { n noteId title versionId cardIds snippet } error noteId doubtId'
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
  type Answer = { id: string; status: string; text: string; scope: string; sources: { n: number; noteId: string; title: string; versionId: string | null; cardIds: string[]; snippet: string }[]; error: string | null }

  const person = async (name: string): Promise<Person> => {
    const s = await seedUser(t.app, { verified: true, displayName: name })
    return { id: s.id, token: tokenFor(t.config, s.id), handle: s.handle }
  }
  const write = async (who: Person, key: string, title: string, body: string, visibility: 'PRIVATE' | 'PUBLIC' | null) => {
    cards[key] = newId()
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title, cards: [{ id: cards[key], type: 'text', position: 'a0', content: text(body) }] } }, who.token)
    const id = created.data!.createNote.note.id
    notes[key] = id
    if (visibility) {
      await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId: id } }, who.token)
      if (visibility === 'PUBLIC') await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId: id, visibility } }, who.token)
    }
    return id
  }
  /** Events delivered, and every published note's chunks embedded as the worker would. */
  const settle = async () => {
    await bus.drain()
    for (const n of await db.note.findMany({ where: { publishedVersionId: { not: null } }, select: { id: true } })) await chunks.embedNote(n.id)
  }
  const asked = async (who: Person, input: object) => {
    const res = await t.gql<{ askAi: { answer: { id: string; status: string } | null; userErrors: { code: string; message: string }[] } }>(`mutation ($input: AskAiInput!) { askAi(input: $input) { answer { id status } ${ERRORS} } }`, { input }, who.token)
    return { payload: res.data?.askAi, error: res.errors?.[0]?.extensions.code as string | undefined }
  }
  const answer = async (who: Person, id: string) => (await t.gql<{ aiAnswer: Answer | null }>(`query ($id: UUID!) { aiAnswer(id: $id) { ${ANSWER} } }`, { id }, who.token)).data!.aiAnswer
  /** Asks, runs the worker's part in place, and reads the answer back. */
  const done = async (who: Person, input: object) => {
    const { payload, error } = await asked(who, input)
    expect({ error, userErrors: payload?.userErrors }).toEqual({ error: undefined, userErrors: [] })
    expect(payload!.answer!.status).toBe('QUEUED')
    await ask.process(payload!.answer!.id)
    return (await answer(who, payload!.answer!.id))!
  }
  /** The prompt the stand-in model got last. */
  const lastPrompt = () => ollama.chats.at(-1)!.messages.map((m) => m.content).join('\n')

  beforeAll(async () => {
    ollama = await startFakeOllama()
    t = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    db = t.app.get(PrismaService)
    ask = t.app.get(AskService)
    chunks = t.app.get(NoteChunks)
    bus = t.app.get(InProcessEventBus)
    asha = await person('Asha')
    ravi = await person('Ravi')
    dev = await person('Dev')
    await write(asha, 'draft', 'Heaps', 'A min-heap keeps the smallest item on top, at the root.', null)
    await write(asha, 'graphs', 'Graphs', 'Dijkstra finds shortest paths with a priority queue of distances.', 'PUBLIC')
    await write(asha, 'plan', 'Exam plan', 'My exam plan: revise heaps and graphs on Friday. SECRETPLAN', 'PRIVATE')
    await settle()
  })

  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
  })

  it('answers about one note as its owner reads it — the draft — citing it, streamed to the asker’s sockets', async () => {
    const live = jest.spyOn(t.app.get(LiveNotifier), 'notify')
    ollama.answer = () => 'A min-heap keeps the smallest item at the root [1].'
    const a = await done(asha, { question: 'What does a min-heap keep on top?', scope: 'THIS_NOTE', noteId: notes.draft })
    expect(a).toMatchObject({ status: 'READY', scope: 'THIS_NOTE', text: 'A min-heap keeps the smallest item at the root [1].', error: null })
    expect(a.sources).toEqual([{ n: 1, noteId: notes.draft, title: 'Heaps', versionId: null, cardIds: [cards.draft], snippet: 'A min-heap keeps the smallest item on top, at the root.' }])
    // The question and the note went in fenced, as material; the answer counts against Asha's day.
    expect(lastPrompt()).toContain('<content>\nWhat does a min-heap keep on top?')
    expect(lastPrompt()).toContain('[1] Heaps\nA min-heap keeps the smallest item on top')
    expect(ollama.chats.at(-1)!.stream).toBe(true)
    expect(await db.aiUsage.count({ where: { userId: asha.id, task: 'ASK', ok: true } })).toBe(1)
    expect(live).toHaveBeenCalledWith(asha.id, 'AI_ANSWER', a.id)
    live.mockRestore()
  })

  it('embeds a published version once, for its current model, and replaces it with the next version', async () => {
    const rows = await db.noteChunk.findMany({ where: { noteId: notes.graphs }, select: { versionId: true, model: true, cardIds: true, text: true } })
    const note = await db.note.findUniqueOrThrow({ where: { id: notes.graphs }, select: { publishedVersionId: true } })
    expect(rows).toEqual([{ versionId: note.publishedVersionId, model: 'embeddinggemma', cardIds: [cards.graphs], text: 'Dijkstra finds shortest paths with a priority queue of distances.' }])
    expect(await chunks.embedNote(notes.graphs)).toBe('kept')
    // Drafts are not embedded; the platform's embeddings count against no one's day.
    expect(await db.noteChunk.count({ where: { noteId: notes.draft } })).toBe(0)
    expect(await db.aiUsage.count({ where: { task: 'EMBED', userId: null } })).toBeGreaterThan(0)
    await t.gql(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { ${ERRORS} } }`, { input: { noteId: notes.graphs, ops: [{ kind: 'UPSERT', id: cards.graphs, type: 'text', position: 'a0', content: text('Dijkstra finds shortest paths; Bellman-Ford allows negative edges.'), baseRevision: 1 }] } }, asha.token)
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId: notes.graphs } }, asha.token)
    await settle()
    const next = await db.noteChunk.findMany({ where: { noteId: notes.graphs }, select: { text: true } })
    expect(next).toEqual([{ text: 'Dijkstra finds shortest paths; Bellman-Ford allows negative edges.' }])
  })

  it('answers from public notes and the asker’s own, never from a note they may not read', async () => {
    ollama.answer = () => 'Use Dijkstra [1].'
    const pub = await done(ravi, { question: 'How do I find shortest paths in a graph?', scope: 'PUBLIC' })
    expect(pub.sources.map((s) => s.noteId)).toEqual([notes.graphs])
    expect(pub.sources[0]!.versionId).not.toBeNull()
    // Ravi asks about Asha's private plan: the model never sees it.
    ollama.answer = () => 'Not covered.'
    const pry = await done(ravi, { question: 'What is the exam plan for Friday? heaps graphs revise', scope: 'PUBLIC' })
    expect(pry.sources.map((s) => s.noteId)).not.toContain(notes.plan)
    expect(lastPrompt()).not.toContain('SECRETPLAN')
    // Ravi has no notes: nothing to answer with, and no model call.
    const before = ollama.chats.length
    const none = await done(ravi, { question: 'What is my exam plan?', scope: 'MY_NOTES' })
    expect(none).toMatchObject({ status: 'READY', sources: [], text: expect.stringContaining('could not find this in your notes') })
    expect(ollama.chats.length).toBe(before)
    // Asha's own notes include her private one.
    ollama.answer = () => 'Friday [1].'
    const mine = await done(asha, { question: 'When do I revise heaps for the exam plan?', scope: 'MY_NOTES' })
    expect(mine.sources.map((s) => s.noteId)).toContain(notes.plan)
  })

  it('stops answering from a note the moment it leaves PUBLIC', async () => {
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId: notes.graphs, visibility: 'PRIVATE' } }, asha.token)
    const gone = await done(ravi, { question: 'How do I find shortest paths in a graph?', scope: 'PUBLIC' })
    expect(gone.sources).toEqual([])
    expect(gone.text).toContain('could not find this in the public notes')
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId: notes.graphs, visibility: 'PUBLIC' } }, asha.token)
  })

  it('answers members from the notes shared with their groups, and a workspace’s team from a doubt', async () => {
    const group = (await t.gql<{ createGroup: { group: { id: string } } }>(`mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } ${ERRORS} } }`, { input: { name: 'Heap visualiser', privacy: 'PUBLIC', joinPolicy: 'OPEN', type: 'PROJECT' } }, asha.token)).data!.createGroup.group.id
    await t.gql('mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id: group }, ravi.token)
    const shared = await write(asha, 'team', 'Team notes', 'Sift-down swaps the parent with its smaller child until order holds.', 'PRIVATE')
    await t.gql(`mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { ${ERRORS} } }`, { input: { noteId: shared, groupId: group } }, asha.token)
    await settle()
    ollama.answer = () => 'Swap with the smaller child [1].'
    const places = await done(ravi, { question: 'How does sift-down swap?', scope: 'MY_PLACES' })
    expect(places.sources.map((s) => s.noteId)).toEqual([shared])
    expect((await done(dev, { question: 'How does sift-down swap?', scope: 'MY_PLACES' })).sources).toEqual([])

    const doubt = (await t.gql<{ askDoubt: { doubt: { id: string } } }>(`mutation ($input: AskDoubtInput!) { askDoubt(input: $input) { doubt { id } ${ERRORS} } }`, { input: { groupId: group, title: 'Why does sift-down swap twice?', body: text('The loop swaps with the smaller child.').doc } }, ravi.token)).data!.askDoubt.doubt.id
    const res = await t.gql<{ askAiAboutDoubt: { answer: { id: string; status: string } | null; userErrors: { code: string }[] } }>(`mutation ($id: UUID!) { askAiAboutDoubt(doubtId: $id) { answer { id status } ${ERRORS} } }`, { id: doubt }, asha.token)
    const id = res.data!.askAiAboutDoubt.answer!.id
    await ask.process(id)
    const a = (await answer(asha, id))!
    expect(a).toMatchObject({ status: 'READY', scope: 'WORKSPACE' })
    expect(a.sources.map((s) => s.noteId)).toEqual([shared])
    expect(lastPrompt()).toContain('Why does sift-down swap twice?')
    expect(lastPrompt()).toContain('The loop swaps with the smaller child.')
    const listed = (await t.gql<{ myAiAnswers: { id: string }[] }>('query ($id: UUID!) { myAiAnswers(doubtId: $id) { id } }', { id: doubt }, asha.token)).data!.myAiAnswers
    expect(listed.map((x) => x.id)).toEqual([id])
    // Outside the workspace, the doubt is not there.
    const outsider = await t.gql<{ askAiAboutDoubt: { answer: unknown; userErrors: { code: string }[] } }>(`mutation ($id: UUID!) { askAiAboutDoubt(doubtId: $id) { answer { id } ${ERRORS} } }`, { id: doubt }, dev.token)
    expect(outsider.errors?.[0]?.extensions.code ?? outsider.data?.askAiAboutDoubt.userErrors[0]?.code).toBe('NOT_FOUND')
  })

  it('refuses a note the asker may not read, a missing or overlong question, and a used-up day', async () => {
    const hidden = await asked(dev, { question: 'What is in this plan?', scope: 'THIS_NOTE', noteId: notes.plan })
    expect(hidden.error ?? hidden.payload?.userErrors[0]?.code).toBe('NOT_FOUND')
    expect((await asked(dev, { question: 'Hi', scope: 'PUBLIC' })).payload!.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'question'] })
    expect((await asked(dev, { question: 'x'.repeat(1001), scope: 'PUBLIC' })).payload!.userErrors[0]!.code).toBe('VALIDATION')
    expect((await asked(dev, { question: 'Workspaces come from doubts', scope: 'WORKSPACE' })).payload!.userErrors[0]!.code).toBe('VALIDATION')
    await db.aiUsage.create({ data: { id: newId(), userId: dev.id, task: 'ASK', provider: 'OLLAMA', model: 'gemma4', promptTokens: 10_000_000, completionTokens: 0, latencyMs: 1, ok: true } })
    expect((await asked(dev, { question: 'What is a heap?', scope: 'PUBLIC' })).payload!.userErrors[0]!.code).toBe('RATE_LIMITED')
  })

  it('says why an answer failed, in words for the asker', async () => {
    ollama.answer = () => ({ status: 500 })
    const failed = await done(ravi, { question: 'How do I find shortest paths in a graph?', scope: 'PUBLIC' })
    expect(failed).toMatchObject({ status: 'FAILED', error: 'AI is not answering right now. Try again in a minute.' })
    ollama.answer = (req) => req.messages.at(-1)!.content.slice(0, 40)
  })

  it('lists, deletes and exports the asker’s answers', async () => {
    const mine = (await t.gql<{ myAiAnswers: { id: string; noteId: string | null }[] }>('query ($id: UUID!) { myAiAnswers(noteId: $id) { id noteId } }', { id: notes.draft }, asha.token)).data!.myAiAnswers
    expect(mine).toHaveLength(1)
    expect((await t.gql<{ myAiAnswers: unknown[] }>('query ($id: UUID!) { myAiAnswers(noteId: $id) { id } }', { id: notes.draft }, ravi.token)).data!.myAiAnswers).toEqual([])
    expect(await answer(ravi, mine[0]!.id)).toBeNull()
    const exported = await t.app.get(AiExport).exportFor(asha.id)
    expect(exported.counts.aiAnswers).toBeGreaterThanOrEqual(3)
    expect(exported.files.map((f) => f.path)).toContain('data/ai/answers.json')
    const removed = await t.gql<{ deleteAiAnswer: { ok: boolean } }>('mutation ($id: UUID!) { deleteAiAnswer(id: $id) { ok userErrors { code } } }', { id: mine[0]!.id }, asha.token)
    expect(removed.data!.deleteAiAnswer.ok).toBe(true)
    expect(await answer(asha, mine[0]!.id)).toBeNull()
  })

  it('gives hybrid search its semantic side from the same embeddings (ADR-0057)', async () => {
    const semantic = t.app.get<SemanticSearch>(SEMANTIC_SEARCH)
    expect((await semantic.similarNotes('shortest paths Dijkstra', 5))[0]).toBe(notes.graphs)
    expect(await semantic.similarNotes('   ', 5)).toEqual([])
  })

  it('says AI is off, as a payload error, where it is not switched on', async () => {
    const off = await createTestApp({}, { resetDatabase: false })
    try {
      const res = await off.gql<{ askAi: { userErrors: { code: string }[] } }>(`mutation { askAi(input: { question: "What is a heap?", scope: PUBLIC }) { answer { id } ${ERRORS} } }`, {}, ravi.token)
      expect(res.data!.askAi.userErrors[0]!.code).toBe('UNAVAILABLE')
      // Nothing is embedded, and nothing fails, without AI.
      expect(await off.app.get(NoteChunks).embedNote(notes.graphs)).toBe('off')
      expect(await off.app.get<SemanticSearch>(SEMANTIC_SEARCH).similarNotes('heaps', 5)).toEqual([])
    } finally {
      await off.close()
    }
  })
})

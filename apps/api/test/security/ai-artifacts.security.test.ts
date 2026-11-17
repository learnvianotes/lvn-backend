import { AiTaskType } from '@lvn/contracts/domain'
import { AiTasksService, AskService } from '@lvn-backend/ai'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeChatRequest, type FakeOllama } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Phase 5's exit (§18): every AI artifact is stored apart from the notes. Every AI task the API offers, Ask AI and a
 * public note's study aids run on a published note, by its owner and by a reader, against a stand-in model that
 * answers whatever shape is asked; the note's versions and its draft are exactly as they were, and the results live
 * in the `ai` schema. Only the person's own explicit step changes a note: keeping cards into it (its draft, never a
 * version) or into a new note of their own.
 */
describe('security: AI artifacts are stored apart from the notes (Phase 5 exit)', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  let ollama: FakeOllama
  type Person = { id: string; token: string }
  let owner: Person
  let reader: Person
  let noteId = ''
  const ERRORS = 'userErrors { field message code }'
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })

  /** The smallest answer of the asked JSON shape (the gateway checks it with the task's Zod schema). */
  const sample = (s: Record<string, unknown>): unknown => {
    if (Array.isArray(s.enum)) return s.enum[0]
    if (Array.isArray(s.anyOf)) return sample(s.anyOf[0] as Record<string, unknown>)
    switch (s.type) {
      case 'object':
        return Object.fromEntries(Object.entries((s.properties ?? {}) as Record<string, Record<string, unknown>>).map(([k, v]) => [k, sample(v)]))
      case 'array':
        return Array.from({ length: Math.max(1, Number(s.minItems ?? 1)) }, () => sample(s.items as Record<string, unknown>))
      case 'integer':
      case 'number':
        return Math.max(Number(s.minimum ?? 0), s.exclusiveMinimum != null ? Number(s.exclusiveMinimum) + 1 : 0)
      case 'boolean':
        return false
      default:
        return 'Binary search halves the range at every step'
    }
  }
  const answer = (req: FakeChatRequest) => (req.format && typeof req.format === 'object' ? JSON.stringify(sample(req.format as Record<string, unknown>)) : 'Binary search halves the range [1].')

  /** Everything a note is, apart from what AI keeps beside it. */
  const snapshot = async () => {
    const note = await db.note.findUniqueOrThrow({ where: { id: noteId }, select: { title: true, publishedVersionId: true, visibility: true } })
    const versions = await db.noteVersion.findMany({ where: { noteId }, orderBy: { number: 'asc' } })
    const cards = await db.card.findMany({ where: { noteId }, orderBy: { id: 'asc' }, select: { id: true, type: true, position: true, revision: true, content: true, deletedAt: true } })
    return { note, versions: versions.map((v) => ({ id: v.id, number: v.number, title: v.title, cards: v.cards })), cards }
  }
  const person = async (name: string) => {
    const u = await seedUser(t.app, { verified: true, displayName: name })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const run = async (who: Person, task: string, extra: object = {}) => {
    const res = await t.gql<{ runAiTask: { artifact: { id: string } | null; userErrors: { message: string }[] } }>(`mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } ${ERRORS} } }`, { input: { noteId, task, ...extra } }, who.token)
    return res.data?.runAiTask.artifact?.id ?? null
  }

  beforeAll(async () => {
    ollama = await startFakeOllama()
    ollama.answer = answer
    t = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    owner = await person('Asha')
    reader = await person('Ravi')
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, {
      input: {
        title: 'Searching',
        cards: [
          { id: newId(), type: 'heading', position: 'a0', content: { level: 2, content: [{ type: 'text', text: 'Binary search' }] } },
          { id: newId(), type: 'text', position: 'a1', content: text('Binary search halves the range at every step, so it takes O(log n) steps on sorted input.') },
          { id: newId(), type: 'code', position: 'a2', content: { language: 'python', code: 'def find(xs, x):\n    lo, hi = 0, len(xs)\n    return lo' } },
        ],
      },
    }, owner.token)
    noteId = created.data!.createNote.note.id
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId } }, owner.token)
    await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId, visibility: 'PUBLIC' } }, owner.token)
    await bus.drain()
  }, 120_000)

  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
  })

  it('runs every AI task, Ask AI and the study aids, and the note’s versions and draft stay exactly as they were', async () => {
    const before = await snapshot()
    expect(before.versions).toHaveLength(1)
    const tasks = t.app.get(AiTasksService)
    const ask = t.app.get(AskService)

    // Every task the API offers, but transcription (it needs a recording; ADR-0062's e2e covers it).
    // Five AI calls a minute per person: the owner runs the editor-only tasks and a few more, and other readers run the rest.
    const all = Object.values(AiTaskType).filter((task) => task !== 'TRANSCRIBE')
    const pinned = ['QUICK_NOTE', 'CLEAN_UP', 'QUIZ']
    const ownerTasks = [...pinned, ...all.filter((task) => !pinned.includes(task))].slice(0, 5)
    const ownerSet = new Set(ownerTasks)
    const rest = all.filter((task) => !ownerSet.has(task))
    const ids: string[] = []
    const queue = async (who: Person, task: string) => {
      const id = await run(who, task, task === 'TRANSLATE' ? { language: 'HINDI' } : {})
      expect({ task, queued: !!id }).toEqual({ task, queued: true })
      ids.push(id!)
    }
    for (const task of ownerTasks) await queue(owner, task)
    for (let i = 0; i < rest.length; i += 4) {
      const who = await person(`Reader ${i}`)
      for (const task of rest.slice(i, i + 4)) await queue(who, task)
    }
    // A reader runs what readers may run, on the published version.
    for (const task of ['SUMMARIZE', 'FLASHCARDS', 'QUIZ', 'EXPLAIN_CODE']) ids.push((await run(reader, task))!)
    for (const id of ids) await tasks.process(id)
    // The public note's study aids (ADR-0061), queued when it went public.
    const aids = await db.noteArtifact.findMany({ where: { noteId, ownerId: null } })
    expect(aids.length).toBeGreaterThan(0)
    for (const aid of aids) await tasks.process(aid.id)
    // Ask AI about the note (ADR-0060).
    const asked = await t.gql<{ askAi: { answer: { id: string } | null } }>(`mutation ($input: AskAiInput!) { askAi(input: $input) { answer { id } ${ERRORS} } }`, { input: { question: 'How many steps does binary search take?', scope: 'THIS_NOTE', noteId } }, reader.token)
    await ask.process(asked.data!.askAi.answer!.id)
    await bus.drain()

    const results = await db.noteArtifact.findMany({ where: { noteId } })
    // Every one was made (READY), so each really ran against the note.
    expect(results.filter((a) => ids.includes(a.id) && a.status !== 'READY').map((a) => `${a.task}: ${a.status} ${a.error ?? ''}`)).toEqual([])
    expect(aids.every((a) => results.find((r) => r.id === a.id)?.status === 'READY')).toBe(true)
    expect(await db.aiAnswer.count({ where: { noteId } })).toBe(1)
    expect(await snapshot()).toEqual(before)
  })

  it('only keeping cards changes a note: into its draft (never a version), or a new note of the person’s own', async () => {
    const before = await snapshot()
    const quiz = await db.noteArtifact.findFirstOrThrow({ where: { noteId, ownerId: owner.id, task: 'QUIZ', status: 'READY' } })
    const keep = (who: Person, artifactId: string, into: string) =>
      t.gql<{ keepAiCards: { noteId: string | null; userErrors: { message: string }[] } }>(`mutation ($input: KeepAiCardsInput!) { keepAiCards(input: $input) { noteId ${ERRORS} } }`, { input: { artifactId, cardIndexes: [0], into } }, who.token)
    const theirs = await db.noteArtifact.findFirstOrThrow({ where: { noteId, ownerId: reader.id, task: 'QUIZ', status: 'READY' } })
    const copy = (await keep(reader, theirs.id, 'NEW_NOTE')).data!.keepAiCards.noteId
    expect(copy).not.toBe(noteId)
    expect(await snapshot()).toEqual(before)

    expect((await keep(owner, quiz.id, 'NOTE')).data!.keepAiCards.noteId).toBe(noteId)
    const after = await snapshot()
    expect(after.versions).toEqual(before.versions)
    expect(after.note).toEqual(before.note)
    expect(after.cards.length).toBe(before.cards.length + 1)
  })
})

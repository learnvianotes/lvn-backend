import { AskService } from '@lvn-backend/ai'
import { AppError } from '@lvn-backend/errors'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { NoteChunks } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeOllama } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * §10.2's leakage test (ADR-0060; Phase 5's exit: 0 leaks in 1,000 questions). Learners A and B, a teacher T, a
 * member M of A's group G and an outsider O hold notes on one topic — private, shared with a person, shared with a
 * group, shared with a class, public, and public but trashed — each with a marker word. Random askers ask random
 * questions, many naming another note's marker to pull it in, over random scopes, through the real retrieval, rerank
 * and prompt with a stand-in model that cites every passage. A leak is a source the asker may not open, or the words of
 * such a note reaching the model. Who may open what is written out below, not taken from the code under test.
 */
describe('security: Ask AI leaks nothing (§10.2)', () => {
  const QUESTIONS = 1000
  let t: TestApp
  let db: PrismaService
  let ollama: FakeOllama
  let ask: AskService
  type Who = 'A' | 'B' | 'T' | 'M' | 'O'
  type Key = 'aPrivate' | 'aSharedB' | 'aGroup' | 'tClass' | 'bPrivate' | 'aPublic' | 'aTrashed'
  const people = {} as Record<Who, { id: string; token: string; handle: string }>
  const ids = {} as Record<Key, string>
  const marker = (key: Key) => `zq${key.toLowerCase()}`
  /**
   * What each person may ask about: the notes they may open, by the matrix §4.2 and ADR-0045/0046 describe. A trashed
   * note is its owner's to restore from the trash, not to ask about: AI reads live notes only (ADR-0059).
   */
  const MAY_OPEN: Record<Who, Key[]> = {
    A: ['aPrivate', 'aSharedB', 'aGroup', 'aPublic'],
    B: ['aSharedB', 'tClass', 'bPrivate', 'aPublic'],
    T: ['tClass', 'aPublic'],
    M: ['aGroup', 'aPublic'],
    O: ['aPublic'],
  }
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
  const gql = async <T>(who: Who, query: string, variables: object) => {
    const res = await t.gql<T>(query, variables, people[who].token)
    if (res.errors?.length) throw new Error(JSON.stringify(res.errors))
    return res.data!
  }

  beforeAll(async () => {
    ollama = await startFakeOllama()
    // A stand-in model that cites every passage it is given, so each one becomes a source.
    ollama.answer = () => 'Photosynthesis [1][2][3][4][5][6][7][8].'
    t = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    db = t.app.get(PrismaService)
    ask = t.app.get(AskService)
    for (const [who, role] of [['A', 'STUDENT'], ['B', 'STUDENT'], ['T', 'TEACHER'], ['M', 'STUDENT'], ['O', 'STUDENT']] as const) {
      const u = await seedUser(t.app, { verified: true, displayName: `Person ${who}`, globalRole: role })
      people[who] = { id: u.id, token: tokenFor(t.config, u.id, undefined, [role]), handle: u.handle }
    }
    const write = async (who: Who, key: Key, publish = true) => {
      const created = await gql<{ createNote: { note: { id: string } } }>(who, 'mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', {
        input: { title: `Photosynthesis ${key}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: text(`Photosynthesis turns light into sugar in the chloroplast; chlorophyll absorbs red and blue light. ${marker(key)} is this note's own word.`) }] },
      })
      ids[key] = created.createNote.note.id
      if (publish) await gql(who, 'mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: ids[key] } })
      return ids[key]
    }
    const visibility = (who: Who, key: Key, v: 'SHARED' | 'PUBLIC') => gql(who, 'mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: ids[key], visibility: v } })

    await write('A', 'aPrivate')
    await write('A', 'aSharedB')
    await visibility('A', 'aSharedB', 'SHARED')
    await gql('A', 'mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { id } } }', { input: { noteId: ids.aSharedB, person: people.B.handle, role: 'VIEWER' } })
    const group = (await gql<{ createGroup: { group: { id: string } } }>('A', 'mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } } }', { input: { name: 'Plant biology circle', privacy: 'PUBLIC', joinPolicy: 'OPEN' } })).createGroup.group.id
    await gql('M', 'mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id: group })
    await write('A', 'aGroup')
    await gql('A', 'mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { id } } }', { input: { noteId: ids.aGroup, groupId: group } })
    const classroom = (await gql<{ createClassroom: { classroom: { id: string } } }>('T', 'mutation ($input: CreateClassroomInput!) { createClassroom(input: $input) { classroom { id } } }', { input: { name: 'Biology, section C' } })).createClassroom.classroom.id
    await gql('T', 'mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } } }', { input: { classroomId: classroom, person: people.B.handle } })
    const invite = await db.classroomInvite.findFirstOrThrow({ where: { classroomId: classroom, invitedUserId: people.B.id } })
    await gql('B', 'mutation ($input: AnswerClassroomInviteInput!) { answerClassroomInvite(input: $input) { classroom { id } } }', { input: { inviteId: invite.id, accept: true } })
    await write('T', 'tClass')
    await gql('T', 'mutation ($input: NoteClassroomInput!) { shareNoteToClassroom(input: $input) { note { id } } }', { input: { noteId: ids.tClass, classroomId: classroom } })
    await write('B', 'bPrivate')
    await write('A', 'aPublic')
    await visibility('A', 'aPublic', 'PUBLIC')
    await write('A', 'aTrashed')
    await visibility('A', 'aTrashed', 'PUBLIC')
    await t.app.get(InProcessEventBus).drain()
    const chunks = t.app.get(NoteChunks)
    for (const key of Object.keys(ids) as Key[]) expect(await chunks.embedNote(ids[key])).toBe('made')
    // Trashed after it was embedded: its chunks are still there, so only the read rule keeps it out.
    await gql('A', 'mutation ($input: NoteIdInput!) { deleteNote(input: $input) { note { id } } }', { input: { noteId: ids.aTrashed } })
    expect(await db.noteChunk.count({ where: { noteId: ids.aTrashed } })).toBe(1)
  }, 120_000)

  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
  })

  it(`asks ${QUESTIONS} random questions and finds no leak`, async () => {
    // A seeded generator: a failure can be replayed.
    let seed = 20261013
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed / 2 ** 31)
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)]!
    const whos: Who[] = ['A', 'B', 'T', 'M', 'O']
    const keys = Object.keys(ids) as Key[]
    const scopes = ['MY_NOTES', 'MY_PLACES', 'PUBLIC', 'THIS_NOTE'] as const
    const templates = [(k: Key) => `What does ${marker(k)} say about photosynthesis?`, (k: Key) => `${marker(k)} chlorophyll light sugar`, () => 'How does photosynthesis make sugar from light?', (k: Key) => `Summarise the note about ${marker(k)} and the chloroplast`]
    const leaks: string[] = []
    let refused = 0
    let answeredWithSources = 0
    const keyOf = new Map(keys.map((k) => [ids[k], k]))

    for (let i = 0; i < QUESTIONS; i++) {
      const who = pick(whos)
      const scope = pick(scopes)
      const target = pick(keys)
      const question = pick(templates)(pick(keys))
      const mayOpen = new Set(MAY_OPEN[who])
      let answerId: string
      try {
        answerId = (await ask.ask(people[who].id, { question, scope, noteId: scope === 'THIS_NOTE' ? ids[target] : null })).id
      } catch (e) {
        // Only a note the asker may not open is refused.
        if (scope === 'THIS_NOTE' && e instanceof AppError && e.code === 'NOT_FOUND' && !mayOpen.has(target)) {
          refused++
          continue
        }
        throw new Error(`#${i} ${who} ${scope} ${target}: ${(e as Error).message}`)
      }
      if (scope === 'THIS_NOTE' && !mayOpen.has(target)) leaks.push(`#${i} ${who} could ask about ${target}`)
      const chatsBefore = ollama.chats.length
      await ask.process(answerId)
      const row = await db.aiAnswer.findUniqueOrThrow({ where: { id: answerId } })
      expect(row.status).toBe('READY')
      const sources = row.sources as { noteId: string }[]
      if (sources.length) answeredWithSources++
      for (const s of sources) {
        const key = keyOf.get(s.noteId)
        if (!key || !mayOpen.has(key)) leaks.push(`#${i} ${who} ${scope}: source ${key ?? s.noteId}`)
      }
      const prompts = ollama.chats.slice(chatsBefore).flatMap((c) => c.messages.map((m) => m.content)).join('\n')
      for (const key of keys) {
        // The asker's own question may name any marker; the sources block must not hold an unreadable note's words.
        const sourcesBlock = prompts.split('Sources:')[1] ?? ''
        if (!mayOpen.has(key) && sourcesBlock.includes(marker(key))) leaks.push(`#${i} ${who} ${scope}: the model read ${key}`)
      }
    }

    expect(leaks).toEqual([])
    // The test bites: most questions were answered from sources, and the refusals happened.
    expect(answeredWithSources).toBeGreaterThan(QUESTIONS * 0.4)
    expect(refused).toBeGreaterThan(0)
  }, 600_000)
})

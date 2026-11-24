import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Teachers (ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0044): connections by request, sharing with one connection or
 * with all of them (kept live as connections change), blogs, posts and projects, and the Skills tab.
 */
describe('teachers', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  const person = async (teacher: boolean, name: string): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: teacher ? 'TEACHER' : 'STUDENT', displayName: name })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  type Result = { data?: Record<string, { user: { id: string } | null; userErrors: { message: string; code: string }[] } | null>; errors?: { message: string; extensions: { code: string } }[] }
  /** A mutation's refusal (GraphQL error) or invalid input (userErrors), as one message, or null when it worked. */
  const problem = (res: Result, field: string) => res.errors?.[0]?.message ?? res.data?.[field]?.userErrors[0]?.message ?? null
  const personAct = async (field: string, who: Person, target: Person) => problem((await t.gql(`mutation ($input: PersonInput!) { ${field}(input: $input) { user { id } userErrors { message code } } }`, { input: { userId: target.id } }, who.token)) as Result, field)
  const relation = async (who: Person, target: Person) =>
    (await t.gql<{ userByHandle: { relation: { connected: boolean; pendingConnection: { direction: string; requestId: string } | null; viewerCan: { requestConnection: boolean; respondToConnection: boolean; removeConnection: boolean } } } }>('query ($h: String!) { userByHandle(handle: $h) { relation { connected pendingConnection { direction requestId } viewerCan { requestConnection respondToConnection removeConnection } } } }', { h: target.handle }, who.token)).data!.userByHandle.relation
  const respond = async (who: Person, requestId: string, accept: boolean) => problem((await t.gql('mutation ($input: RespondToConnectionRequestInput!) { respondToConnectionRequest(input: $input) { user { id } userErrors { message code } } }', { input: { requestId, accept } }, who.token)) as Result, 'respondToConnectionRequest')
  const connect = async (a: Person, b: Person) => {
    expect(await personAct('requestConnection', a, b)).toBeNull()
    expect(await respond(b, (await relation(b, a)).pendingConnection!.requestId, true)).toBeNull()
  }
  const notifications = async (who: Person) => {
    await bus.drain()
    return (await t.gql<{ notifications: { edges: { node: { category: string; data: { kind?: string } | null; actor: { id: string } | null } }[] } }>('{ notifications { edges { node { category data actor { id } } } } }', {}, who.token)).data!.notifications.edges.map((e) => e.node)
  }
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
  const publishedNote = async (who: Person, title: string, kind = 'NOTE') => {
    const res = await t.gql<{ createNote: { note: { id: string; allowForks: boolean } | null; userErrors: { message: string }[] } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id allowForks } userErrors { message } } }', { input: { title, kind, cards: [{ id: newId(), type: 'text', position: 'a0', content: text(title) }] } }, who.token)
    const note = res.data?.createNote.note
    if (note) await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: note.id } }, who.token)
    return { note, error: res.errors?.[0]?.message }
  }
  const reads = async (who: Person, noteId: string) => (await t.gql<{ note: { id: string } | null }>('query ($id: UUID!) { note(id: $id) { id } }', { id: noteId }, who.token)).data?.note?.id === noteId

  let asha: Person
  let meera: Person
  let ravi: Person
  let student: Person

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    asha = await person(true, 'Asha Teacher')
    meera = await person(true, 'Meera Teacher')
    ravi = await person(true, 'Ravi Teacher')
    student = await person(false, 'Sam Student')
  })
  afterAll(() => t.close())

  describe('connections (ADR-0013)', () => {
    it('a teacher asks, the other is told and accepts, and the one who asked is told', async () => {
      expect(await personAct('requestConnection', asha, meera)).toBeNull()
      expect(await relation(asha, meera)).toMatchObject({ connected: false, pendingConnection: { direction: 'OUTGOING' }, viewerCan: { requestConnection: false } })
      const incoming = await relation(meera, asha)
      expect(incoming).toMatchObject({ pendingConnection: { direction: 'INCOMING' }, viewerCan: { respondToConnection: true } })
      expect((await notifications(meera)).filter((n) => n.category === 'CONNECTION')).toEqual([{ category: 'CONNECTION', data: { kind: 'REQUESTED' }, actor: { id: asha.id } }])
      // Asking again changes nothing; the other side asking back is told to accept instead.
      expect(await personAct('requestConnection', asha, meera)).toBeNull()
      expect(await personAct('requestConnection', meera, asha)).toMatch(/accept their request instead/)

      expect(await respond(meera, incoming.pendingConnection!.requestId, true)).toBeNull()
      expect(await relation(asha, meera)).toMatchObject({ connected: true, pendingConnection: null, viewerCan: { removeConnection: true } })
      expect((await notifications(asha)).filter((n) => n.category === 'CONNECTION')).toEqual([{ category: 'CONNECTION', data: { kind: 'ACCEPTED' }, actor: { id: meera.id } }])
      const mine = await t.gql<{ myConnections: { node: { id: string } }[] }>('{ myConnections { node { id } } }', {}, asha.token)
      expect(mine.data!.myConnections.map((e) => e.node.id)).toEqual([meera.id])
      expect(await respond(meera, incoming.pendingConnection!.requestId, true)).toMatch(/already answered/)
    })

    it('a decline is silent, a request can be withdrawn, and only teachers connect', async () => {
      await personAct('requestConnection', ravi, asha)
      const { requestId } = (await relation(asha, ravi)).pendingConnection!
      const before = (await notifications(ravi)).length
      expect(await respond(asha, requestId, false)).toBeNull()
      expect(await notifications(ravi)).toHaveLength(before)
      expect((await relation(ravi, asha)).connected).toBe(false)

      await personAct('requestConnection', ravi, asha)
      const pending = await t.gql<{ myConnectionRequests: { id: string; direction: string; person: { id: string } }[] }>('{ myConnectionRequests { id direction person { id } } }', {}, ravi.token)
      const outgoing = pending.data!.myConnectionRequests.find((r) => r.direction === 'OUTGOING')!
      expect(outgoing.person.id).toBe(asha.id)
      await t.gql('mutation ($input: ConnectionRequestInput!) { withdrawConnectionRequest(input: $input) { user { id } } }', { input: { requestId: outgoing.id } }, ravi.token)
      expect((await relation(asha, ravi)).pendingConnection).toBeNull()

      expect(await personAct('requestConnection', student, asha)).toBe('Teachers connect with other teachers.')
      expect(await personAct('requestConnection', asha, student)).toBe('Teachers connect with other teachers.')
    })

    it('teachers share directly with each other only once connected', async () => {
      const { note } = await publishedNote(ravi, 'For a colleague')
      const share = async (from: Person, noteId: string, to: Person) => problem((await t.gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { id } userErrors { message code } } }', { input: { noteId, person: to.handle, role: 'VIEWER' } }, from.token)) as Result, 'shareNote')
      expect(await share(ravi, note!.id, asha)).toBe('Teachers share with other teachers once they are connected or teach a class together.')
      expect(await share(ravi, note!.id, student)).toBeNull()
      await connect(ravi, meera)
      expect(await share(ravi, note!.id, meera)).toBeNull()
    })
  })

  describe('sharing with all connections, live (ADR-0044)', () => {
    it('every connection reads it; a new one does too, a removed one stops; direct shares stay', async () => {
      // Asha is connected with Meera (above); Ravi is not, yet.
      const { note } = await publishedNote(asha, 'Lesson plan: graphs')
      const id = note!.id
      const set = (shared: boolean, who = asha) => t.gql<{ setNoteSharedWithConnections: { note: { sharedWithConnections: boolean; visibility: string } | null } }>('mutation ($input: SetNoteSharedWithConnectionsInput!) { setNoteSharedWithConnections(input: $input) { note { sharedWithConnections visibility } userErrors { message } } }', { input: { noteId: id, shared } }, who.token)
      expect((await set(true)).data!.setNoteSharedWithConnections.note).toEqual({ sharedWithConnections: true, visibility: 'SHARED' })
      expect(await reads(meera, id)).toBe(true)
      expect(await reads(ravi, id)).toBe(false)

      // Ravi connects: he reads it now, without anyone sharing again.
      await connect(ravi, asha)
      await bus.drain()
      expect(await reads(ravi, id)).toBe(true)
      const shares = await t.gql<{ note: { shares: { user: { id: string }; source: string }[] } }>('query ($id: UUID!) { note(id: $id) { shares { user { id } source } } }', { id }, asha.token)
      expect(shares.data!.note.shares.map((s) => s.source).sort()).toEqual(['CONNECTIONS', 'CONNECTIONS'])

      // Meera is also shared with directly; when the connection ends she keeps that, Ravi loses his.
      await t.gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { id } } }', { input: { noteId: id, person: meera.handle, role: 'EDITOR' } }, asha.token)
      await personAct('removeConnection', asha, meera)
      await personAct('removeConnection', ravi, asha)
      await bus.drain()
      expect(await reads(meera, id)).toBe(true)
      expect(await reads(ravi, id)).toBe(false)

      // Stopping removes only rows that came through connections.
      await connect(asha, ravi)
      await bus.drain()
      expect(await reads(ravi, id)).toBe(true)
      expect((await set(false)).data!.setNoteSharedWithConnections.note!.sharedWithConnections).toBe(false)
      expect(await reads(ravi, id)).toBe(false)
      expect(await reads(meera, id)).toBe(true)

      // A student has no connections to share with.
      const own = (await publishedNote(student, 'Mine')).note!
      const refused = await t.gql('mutation ($input: SetNoteSharedWithConnectionsInput!) { setNoteSharedWithConnections(input: $input) { note { id } } }', { input: { noteId: own.id, shared: true } }, student.token)
      expect(refused.errors?.[0]?.message).toBe('Only teachers share with their connections.')
    })

    it('a block ends the connection, and with it what was shared through it', async () => {
      const { note } = await publishedNote(asha, 'Shared with connections')
      await t.gql('mutation ($input: SetNoteSharedWithConnectionsInput!) { setNoteSharedWithConnections(input: $input) { note { id } } }', { input: { noteId: note!.id, shared: true } }, asha.token)
      expect(await reads(ravi, note!.id)).toBe(true)
      await personAct('blockUser', ravi, asha)
      await bus.drain()
      expect((await relation(ravi, asha)).connected).toBe(false)
      expect(await reads(ravi, note!.id)).toBe(false)
      expect(await db.noteShare.count({ where: { noteId: note!.id, userId: ravi.id } })).toBe(0)
      await personAct('unblockUser', ravi, asha)
    })
  })

  describe('publications (ADR-0014, ADR-0015)', () => {
    it('teachers write blogs and posts, anyone writes projects; posts and projects start with copies off', async () => {
      expect((await publishedNote(asha, 'Why graphs first', 'BLOG')).note).toMatchObject({ allowForks: true })
      expect((await publishedNote(asha, 'Office hours moved', 'POST')).note).toMatchObject({ allowForks: false })
      expect((await publishedNote(student, 'My compiler', 'PROJECT')).note).toMatchObject({ allowForks: false })
      expect((await publishedNote(student, 'My opinion', 'BLOG')).error).toBe('Blogs and posts are for teachers.')
      expect((await publishedNote(student, 'Update', 'POST')).error).toBe('Blogs and posts are for teachers.')
    })
  })

  describe('the Skills tab (ADR-0012)', () => {
    const SAVE = 'mutation ($input: UpdateTeacherProfileInput!) { updateTeacherProfile(input: $input) { profile { headline bio skills { kind name detail source } } userErrors { message field } } }'

    it('a teacher fills it by hand; anyone reads it, in the teacher’s order', async () => {
      const input = {
        headline: '  Teaches   algorithms ',
        bio: 'Ten years of teaching data structures.',
        skills: [
          { kind: 'QUALIFICATION', name: 'M.Tech, Computer Science', detail: 'IIT Madras, 2014' },
          { kind: 'SKILL', name: 'Graph algorithms' },
          { kind: 'EXPERIENCE', name: 'Assistant professor', detail: 'Since 2016' },
        ],
      }
      const saved = await t.gql<{ updateTeacherProfile: { profile: { headline: string; skills: { name: string; source: string }[] } } }>(SAVE, { input }, asha.token)
      expect(saved.data!.updateTeacherProfile.profile).toMatchObject({ headline: 'Teaches algorithms', skills: [{ name: 'M.Tech, Computer Science', source: 'MANUAL' }, { name: 'Graph algorithms' }, { name: 'Assistant professor' }] })
      const anyone = await t.gql<{ userByHandle: { teacherProfile: { bio: string; skills: { kind: string; detail: string | null }[] } } }>('query ($h: String!) { userByHandle(handle: $h) { teacherProfile { bio skills { kind detail } } } }', { h: asha.handle })
      expect(anyone.data!.userByHandle.teacherProfile).toEqual({ bio: input.bio, skills: [{ kind: 'QUALIFICATION', detail: 'IIT Madras, 2014' }, { kind: 'SKILL', detail: null }, { kind: 'EXPERIENCE', detail: 'Since 2016' }] })
      // Saving replaces the whole tab.
      await t.gql(SAVE, { input: { headline: null, bio: null, skills: [] } }, asha.token)
      expect((await t.gql<{ userByHandle: { teacherProfile: { skills: unknown[] } } }>('query ($h: String!) { userByHandle(handle: $h) { teacherProfile { skills { name } } } }', { h: asha.handle })).data!.userByHandle.teacherProfile.skills).toEqual([])
    })

    it('students have none and cannot write one; limits are checked', async () => {
      const none = await t.gql<{ userByHandle: { teacherProfile: unknown } }>('query ($h: String!) { userByHandle(handle: $h) { teacherProfile { headline } } }', { h: student.handle })
      expect(none.data!.userByHandle.teacherProfile).toBeNull()
      expect((await t.gql(SAVE, { input: { skills: [] } }, student.token)).errors?.[0]?.message).toBe('Only teachers have a Skills tab.')
      const tooMany = await t.gql<{ updateTeacherProfile: { userErrors: { field: string[] }[] } }>(SAVE, { input: { skills: Array.from({ length: 61 }, (_, i) => ({ kind: 'SKILL', name: `Skill ${i}` })) } }, asha.token)
      expect(tooMany.data!.updateTeacherProfile.userErrors[0]!.field).toEqual(['input', 'skills'])
      const unnamed = await t.gql<{ updateTeacherProfile: { userErrors: { field: string[] }[] } }>(SAVE, { input: { skills: [{ kind: 'SKILL', name: '   ' }] } }, asha.token)
      expect(unnamed.data!.updateTeacherProfile.userErrors[0]!.field).toEqual(['input', 'skills', '0', 'name'])
    })
  })
})

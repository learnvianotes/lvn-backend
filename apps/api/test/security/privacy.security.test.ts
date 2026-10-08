import { getNamedType, isObjectType, type GraphQLSchema } from 'graphql'
import { createTestApp, type TestApp } from '../support/app'
import { seedActors, type Actors } from './support/actors'
import { publicSchema } from './support/fuzz'

/**
 * §17.1: B cannot read A's private data through any channel. In Phase 1 the private data is account data; notes,
 * groups, classrooms, search, recommendations, RAG, subscriptions and SEO pages arrive later and their assertions are
 * listed as todos until then.
 */
describe('security: privacy', () => {
  let t: TestApp
  let actors: Actors
  let schema: GraphQLSchema

  beforeAll(async () => {
    t = await createTestApp()
    actors = await seedActors(t)
    schema = await publicSchema(t)
  })
  afterAll(() => t.close())

  it('returns null for every viewer-only field of someone else (found through the schema’s own descriptions)', async () => {
    const user = schema.getType('User')
    if (!isObjectType(user)) throw new Error('no User type')
    const viewerOnly = Object.values(user.getFields()).filter((f) => /^viewer only/i.test(f.description ?? ''))
    expect(viewerOnly.map((f) => f.name)).toEqual(expect.arrayContaining(['email', 'institutionalEmail', 'restrictedMinor', 'legacyImport', 'limits']))
    const selection = viewerOnly.map((f) => (isObjectType(getNamedType(f.type)) ? `${f.name} { __typename }` : f.name)).join(' ')

    // B finds T through the only Phase 1 query that returns other people.
    const res = await t.gql<{ teachers: Record<string, unknown>[] }>(`{ teachers(search: "Teacher T") { id ${selection} } }`, {}, actors.b.token)
    const t1 = res.data!.teachers.find((u) => u.id === actors.teacher.id)
    expect(t1).toBeDefined()
    for (const f of viewerOnly) expect({ [f.name]: t1![f.name] }).toEqual({ [f.name]: null })

    // The same fields are there for T themself — the check above is about who asks, not about empty fields.
    const own = await t.gql<{ viewer: Record<string, unknown> }>(`{ viewer { email } }`, {}, actors.teacher.token)
    expect(own.data!.viewer.email).toBe(actors.teacher.email)
  })

  it('shows a verification request only to its requester, the teacher it is addressed to and platform admins', async () => {
    const asked = await t.gql<{ requestTeacherVerification: { request: { id: string } } }>(
      'mutation ($t: UUID!) { requestTeacherVerification(input: { teacherId: $t, message: "Please verify me" }) { request { id } userErrors { message } } }',
      { t: actors.teacher.id },
      actors.a.token,
    )
    const id = asked.data!.requestTeacherVerification.request.id
    const mine = async (token: string) => (await t.gql<{ myVerificationRequests: { id: string }[] }>('{ myVerificationRequests { id } }', {}, token)).data!.myVerificationRequests.map((r) => r.id)
    const queue = async (token: string) => t.gql<{ verificationRequestsToReview: { id: string }[] }>('{ verificationRequestsToReview { id } }', {}, token)
    expect(await mine(actors.a.token)).toContain(id)
    expect(await mine(actors.b.token)).not.toContain(id)
    expect((await queue(actors.b.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await queue(actors.teacher.token)).data!.verificationRequestsToReview.map((r) => r.id)).toContain(id)
    expect((await queue(actors.admin.token)).data!.verificationRequestsToReview.map((r) => r.id)).toContain(id)
  })

  describe('notes (Phase 2) and AI (Phase 5)', () => {
    it('B cannot read, change or even detect A’s private note by id — it answers exactly like a note that does not exist', async () => {
      const created = await t.gql<{ createNote: { note: { id: string } } }>(
        'mutation { createNote(input: { title: "A’s diary", cards: [{ id: "01920000-0000-7000-8000-00000000d1a1", type: text, position: "a0", content: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "secret" }] }] } } }] }) { note { id } } }',
        {},
        actors.a.token,
      )
      const id = created.data!.createNote.note.id
      const missing = '01920000-0000-7000-8000-0000000000ff'
      const probe = async (noteId: string) => {
        const read = await t.gql<{ note: unknown }>('query ($id: UUID!) { note(id: $id) { id title } }', { id: noteId }, actors.b.token)
        const anon = await t.gql<{ note: unknown }>('query ($id: UUID!) { note(id: $id) { id title } }', { id: noteId })
        const save = await t.gql('mutation ($id: UUID!) { updateNoteDraft(input: { noteId: $id, title: "mine now" }) { note { id } userErrors { code message } } }', { id: noteId }, actors.b.token)
        const publish = await t.gql('mutation ($id: UUID!) { publishNote(input: { noteId: $id }) { note { id } userErrors { code message } } }', { id: noteId }, actors.b.token)
        const trash = await t.gql('mutation ($id: UUID!) { deleteNote(input: { noteId: $id }) { note { id } userErrors { code message } } }', { id: noteId }, actors.b.token)
        return { read: read.data, anon: anon.data, save: save.data ?? save.errors, publish: publish.data ?? publish.errors, trash: trash.data ?? trash.errors }
      }
      const answers = await probe(id)
      expect(answers.read).toEqual({ note: null })
      expect(answers.anon).toEqual({ note: null })
      expect(answers).toEqual(await probe(missing))
      const mine = await t.gql<{ myNotes: { edges: { node: { id: string } }[] } }>('{ myNotes { edges { node { id } } } }', {}, actors.b.token)
      expect(mine.data!.myNotes.edges.map((e) => e.node.id)).not.toContain(id)
      // Nothing changed.
      const own = await t.gql<{ note: { title: string; deletedAt: string | null } }>('query ($id: UUID!) { note(id: $id) { title deletedAt } }', { id }, actors.a.token)
      expect(own.data!.note).toEqual({ title: 'A’s diary', deletedAt: null })
    })
    it.todo('B cannot read A’s private note through a public-note SEO page or a file URL (P2c, P2d)')
    it.todo('B cannot fork or comment on A’s private note')
    it.todo('B gets no search results, recommendations or Ask AI answers that draw on A’s private notes')
    it.todo('unpublishing a note removes it from search, recommendations and RAG within 60 seconds')
    it.todo('subscriptions never deliver A’s private note events to B')
  })

  describe('groups and classrooms (Phase 3)', () => {
    it.todo('B, not in Group G, cannot see G’s shared notes or posts through any channel')
    it.todo('A, not in Classroom C, cannot see C’s content through any channel')
  })
})

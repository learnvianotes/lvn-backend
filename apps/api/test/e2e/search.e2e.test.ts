import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { SearchIndex } from '@lvn-backend/notes'
import { createTestApp, infra, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Search (§11): published words, while typing and with typos, and only what the searcher may read (§5) — the same
 * answers from either provider (ADR-0055).
 */
describe.each(['postgres', 'typesense'] as const)('search on %s', (provider) => {
  let t: TestApp
  let db: PrismaService
  let index: SearchIndex
  let owner: { id: string; token: string }
  let friend: { id: string; token: string }
  let stranger: { id: string; token: string }
  const ids: Record<string, string> = {}

  const ERRORS = 'userErrors { field message code }'
  type Hit = { note: { id: string; title: string; viewerAccess: string }; snippet: string }
  const search = async (query: string, token?: string, scopes?: string[]) => {
    const res = await t.gql<{ search: { notes: Hit[]; people: { id: string }[]; topics: { title: string }[] } }>(
      'query ($q: String!, $scopes: [SearchScope!]) { search(query: $q, scopes: $scopes, first: 10) { notes { note { id title viewerAccess } snippet } people { id } topics { title } } }',
      { q: query, scopes },
      token,
    )
    return { data: res.data?.search, errors: res.errors }
  }
  const titles = async (query: string, token?: string) => (await search(query, token, ['NOTES'])).data!.notes.map((h) => h.note.title).sort()
  const write = async (title: string, body: string, visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC', kind: 'NOTE' | 'PROJECT' = 'NOTE') => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title, kind, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] } } }] } }, owner.token)
    const id = created.data!.createNote.note.id
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId: id } }, owner.token)
    if (visibility !== 'PRIVATE') await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId: id, visibility } }, owner.token)
    // The worker drains the search outbox; here a turn runs in place.
    await index.drainAll()
    return id
  }

  beforeAll(async () => {
    const typesense = infra().typesense
    t = await createTestApp(
      provider === 'typesense' ? { SEARCH_PROVIDER: 'typesense', TYPESENSE_URL: typesense.url, TYPESENSE_API_KEY: typesense.apiKey, TYPESENSE_COLLECTION_PREFIX: `e${Date.now().toString(36)}_` } : {},
    )
    db = t.app.get(PrismaService)
    index = t.app.get(SearchIndex)
    // The worker creates Typesense's collections when it starts (filling them with people and topics).
    await index.ensureCollections()
    await index.drainAll()
    const u = async (name: string, handle: string) => {
      const s = await seedUser(t.app, { verified: true, displayName: name, handle })
      return { id: s.id, token: tokenFor(t.config, s.id) }
    }
    owner = await u('Asha Rao', `asha${Date.now()}`)
    friend = await u('Ravi Kumar', `ravi${Date.now()}`)
    stranger = await u('Meera Iyer', `meera${Date.now()}`)
    // Seeded straight into the database: no UserRegistered event marks them for people search.
    await index.touchAll('USER')
    ids.public = await write("Dijkstra's algorithm", 'Always settle the closest unvisited vertex; heaps make it fast.', 'PUBLIC')
    ids.shared = await write('Graph exam notes', 'Dijkstra fails with negative edges.', 'SHARED')
    await db.noteShare.create({ data: { noteId: ids.shared, userId: friend.id, role: 'VIEWER', createdById: owner.id } })
    await index.drainAll()
    ids.private = await write('My Dijkstra mistakes', 'I forgot to use a priority queue.', 'PRIVATE')
  })

  afterAll(() => t.close())

  it('a publish leaves a row in the search outbox, which the drainer takes', async () => {
    const note = await db.note.findUniqueOrThrow({ where: { id: ids.public } })
    await db.note.update({ where: { id: note.id }, data: { publishedVersionId: note.publishedVersionId } })
    expect(await db.searchChange.count({ where: { entityId: note.id } })).toBe(0)
    await db.note.update({ where: { id: note.id }, data: { visibility: 'SHARED' } })
    await db.note.update({ where: { id: note.id }, data: { visibility: 'PUBLIC' } })
    expect(await db.searchChange.count({ where: { entity: 'NOTE', entityId: note.id } })).toBe(2)
    await index.drainAll()
    expect(await db.searchChange.count()).toBe(0)
  })

  it('finds only what each person may read', async () => {
    expect(await titles('dijkstra')).toEqual(["Dijkstra's algorithm"])
    expect(await titles('dijkstra', stranger.token)).toEqual(["Dijkstra's algorithm"])
    expect(await titles('dijkstra', friend.token)).toEqual(["Dijkstra's algorithm", 'Graph exam notes'])
    expect(await titles('dijkstra', owner.token)).toEqual(["Dijkstra's algorithm", 'Graph exam notes', 'My Dijkstra mistakes'])
  })

  it('matches while typing, word forms and typos in titles, with the match marked', async () => {
    expect(await titles('dijk')).toEqual(["Dijkstra's algorithm"])
    const heap = (await search('heap', undefined, ['NOTES'])).data!.notes
    expect(heap.map((h) => h.note.title)).toEqual(["Dijkstra's algorithm"])
    expect(heap[0]!.snippet).toContain('heaps')
    expect(await titles('dijsktra algorithm')).toEqual(["Dijkstra's algorithm"])
  })

  it('follows the note: unpublished words are not found, a private note leaves public search at once', async () => {
    await db.note.update({ where: { id: ids.public }, data: { visibility: 'PRIVATE' } })
    expect(await titles('dijkstra')).toEqual([])
    await db.note.update({ where: { id: ids.public }, data: { visibility: 'PUBLIC' } })
    await index.drainAll()
    await t.gql(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { ${ERRORS} } }`, { input: { noteId: ids.public, title: 'Bellman-Ford instead' } }, owner.token)
    await index.drainAll()
    expect(await titles('bellman')).toEqual([])
  })

  it('finds adults by handle or name, never minors, and topics', async () => {
    const minor = await seedUser(t.app, { verified: true, displayName: 'Ravi Junior', handle: `ravijr${Date.now()}` })
    await db.user.update({ where: { id: minor.id }, data: { dateOfBirth: new Date('2014-05-01') } })
    await index.touch('USER', [minor.id])
    await index.drainAll()
    const people = (await search('ravi', stranger.token, ['PEOPLE'])).data!.people.map((p) => p.id)
    expect(people).toContain(friend.id)
    expect(people).not.toContain(minor.id)
    const topic = await db.topic.findFirstOrThrow({ where: { origin: 'CURATED' } })
    const topics = (await search(topic.title, undefined, ['TOPICS'])).data!.topics.map((x) => x.title)
    expect(topics).toContain(topic.title)
  })

  it('refuses very long queries and ignores ones without words', async () => {
    expect((await search('x'.repeat(101))).errors?.[0]).toMatchObject({ extensions: { code: 'VALIDATION' } })
    expect((await search('!!! ??')).data).toEqual({ notes: [], people: [], topics: [] })
  })

  describe('everywhere (ADR-0056)', () => {
    type Found = { notes: { note: { id: string; title: string } }[]; notesCursor: string | null; groups: { id: string; name: string }[]; classrooms: { id: string; name: string }[] }
    const find = async (query: string, token?: string, extra: { filters?: object; after?: string; first?: number; scopes?: string[] } = {}) => {
      const res = await t.gql<{ search: Found }>(
        'query ($q: String!, $scopes: [SearchScope!], $first: Int, $filters: SearchFilters, $after: String) { search(query: $q, scopes: $scopes, first: $first, filters: $filters, after: $after) { notes { note { id title } } notesCursor groups { id name } classrooms { id name } } }',
        { q: query, first: 10, ...extra },
        token,
      )
      return { data: res.data?.search, errors: res.errors }
    }
    const noteTitles = async (query: string, token: string | undefined, filters: object) => (await find(query, token, { filters, scopes: ['NOTES'] })).data!.notes.map((h) => h.note.title).sort()
    const settle = async () => {
      await t.app.get(InProcessEventBus).drain()
      await index.drainAll()
    }
    let teacher: { id: string; token: string }
    const places: Record<string, string> = {}

    beforeAll(async () => {
      const s = await seedUser(t.app, { verified: true, displayName: 'Kavya Teacher', handle: `kavya${Date.now()}`, globalRole: 'TEACHER' })
      teacher = { id: s.id, token: tokenFor(t.config, s.id) }
      const group = async (name: string, privacy: 'PUBLIC' | 'PRIVATE', description: string) =>
        (await t.gql<{ createGroup: { group: { id: string } } }>(`mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } ${ERRORS} } }`, { input: { name, privacy, description } }, owner.token)).data!.createGroup.group.id
      places.open = await group('Graph theory circle', 'PUBLIC', 'Shortest paths every Friday.')
      places.closed = await group('Graph exam crew', 'PRIVATE', 'Only us.')
      places.classroom = (await t.gql<{ createClassroom: { classroom: { id: string } } }>(`mutation ($input: CreateClassroomInput!) { createClassroom(input: $input) { classroom { id } ${ERRORS} } }`, { input: { name: 'Graph algorithms, section B', description: 'Tuesdays' } }, teacher.token)).data!.createClassroom.classroom.id
      ids.project = await write('Graph visualiser project', 'A tool that draws shortest paths.', 'PUBLIC', 'PROJECT')
      await settle()
    })

    it('finds public groups for everyone, private ones for their members, classes for theirs only', async () => {
      const groups = async (token?: string) => (await find('graph', token, { scopes: ['GROUPS'] })).data!.groups.map((g) => g.name).sort()
      // Group pages need an account: signed out, none.
      expect(await groups()).toEqual([])
      expect(await groups(stranger.token)).toEqual(['Graph theory circle'])
      expect(await groups(owner.token)).toEqual(['Graph exam crew', 'Graph theory circle'])
      const classes = async (token?: string) => (await find('graph', token, { scopes: ['CLASSROOMS'] })).data!.classrooms.map((c) => c.name)
      expect(await classes(teacher.token)).toEqual(['Graph algorithms, section B'])
      expect(await classes(owner.token)).toEqual([])
      expect(await classes()).toEqual([])
      // Renamed, then deleted: search follows.
      await t.gql(`mutation ($input: UpdateGroupInput!) { updateGroup(input: $input) { ${ERRORS} } }`, { input: { groupId: places.open, name: 'Network flows circle' } }, owner.token)
      await settle()
      expect(await groups(stranger.token)).toEqual([])
      expect((await find('flows', stranger.token, { scopes: ['GROUPS'] })).data!.groups.map((g) => g.id)).toEqual([places.open])
      await t.gql(`mutation ($input: GroupIdInput!) { deleteGroup(input: $input) { ${ERRORS} } }`, { input: { groupId: places.open } }, owner.token)
      await settle()
      expect((await find('flows', stranger.token, { scopes: ['GROUPS'] })).data!.groups).toEqual([])
    })

    it('narrows notes by kind, source, author and topic, never past what the viewer may read', async () => {
      expect(await noteTitles('graph', owner.token, { kinds: ['PROJECT'] })).toEqual(['Graph visualiser project'])
      // By id: the owner reads their draft titles, which an earlier test changes.
      const mine = (await find('dijkstra', owner.token, { filters: { sources: ['MINE'] }, scopes: ['NOTES'] })).data!.notes.map((h) => h.note.id).sort()
      expect(mine).toEqual([ids.public, ids.shared, ids.private].sort())
      expect(await noteTitles('dijkstra', friend.token, { sources: ['SHARED'] })).toEqual(['Graph exam notes'])
      expect(await noteTitles('dijkstra', friend.token, { sources: ['PUBLIC'] })).toEqual(["Dijkstra's algorithm"])
      expect(await noteTitles('dijkstra', stranger.token, { sources: ['MINE', 'SHARED'] })).toEqual([])
      expect(await noteTitles('dijkstra', undefined, { sources: ['MINE'] })).toEqual([])
      expect(await noteTitles('dijkstra', stranger.token, { authorId: owner.id })).toEqual(["Dijkstra's algorithm"])
      const topic = await db.topic.findFirstOrThrow({ where: { origin: 'CURATED' } })
      await db.noteTopic.create({ data: { noteId: ids.shared!, topicId: topic.id } })
      await index.drainAll()
      expect(await noteTitles('dijkstra', friend.token, { topicId: topic.id })).toEqual(['Graph exam notes'])
      expect(await noteTitles('dijkstra', friend.token, { subjectId: topic.subjectId })).toEqual(['Graph exam notes'])
      expect(await noteTitles('dijkstra', stranger.token, { topicId: topic.id })).toEqual([])
      // Filters alone list what they allow, newest first.
      expect(await noteTitles('', friend.token, { topicId: topic.id })).toEqual(['Graph exam notes'])
      // Any of several topics, as an exam's notes are found (ADR-0076); at most 20.
      const other = await db.topic.findFirstOrThrow({ where: { origin: 'CURATED', id: { not: topic.id } } })
      expect(await noteTitles('', friend.token, { topicIds: [other.id, topic.id] })).toEqual(['Graph exam notes'])
      expect(await noteTitles('dijkstra', friend.token, { topicIds: [other.id] })).toEqual([])
      expect(await noteTitles('', stranger.token, { topicIds: [topic.id] })).toEqual([])
      const many = (await db.topic.findMany({ where: { origin: 'CURATED' }, take: 21, select: { id: true } })).map((x) => x.id)
      expect((await find('', friend.token, { filters: { topicIds: many }, scopes: ['NOTES'] })).errors?.[0]?.message).toBe('Filter by at most 20 topics.')
      expect((await find('', undefined, { filters: { authorId: owner.id }, scopes: ['NOTES'] })).data!.notes.map((h) => h.note.title)).toEqual(['Graph visualiser project', "Dijkstra's algorithm"])
    })

    it('gives more notes page by page, and refuses a page of another search', async () => {
      const made: string[] = []
      for (let i = 1; i <= 7; i++) made.push(await write(`Paging lesson ${i}`, 'Pagination keeps pages small.', 'PUBLIC'))
      const seen: string[] = []
      let after: string | undefined
      for (let page = 0; page < 4; page++) {
        const res = (await find('pagination', undefined, { first: 3, after, scopes: ['NOTES', 'GROUPS'] })).data!
        seen.push(...res.notes.map((h) => h.note.id))
        if (page > 0) expect(res.groups).toEqual([])
        if (!res.notesCursor) break
        after = res.notesCursor
      }
      expect(seen.sort()).toEqual(made.sort())
      const first = (await find('pagination', undefined, { first: 3 })).data!.notesCursor!
      expect((await find('dijkstra', undefined, { after: first })).errors?.[0]).toMatchObject({ extensions: { code: 'VALIDATION' } })
      expect((await find('pagination', undefined, { after: 'nonsense' })).errors?.[0]).toMatchObject({ extensions: { code: 'VALIDATION' } })
    })
  })
})

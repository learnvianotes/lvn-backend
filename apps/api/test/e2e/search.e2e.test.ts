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
  const write = async (title: string, body: string, visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC') => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] } } }] } }, owner.token)
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
})

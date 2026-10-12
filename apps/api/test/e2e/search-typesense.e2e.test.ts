import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { SearchIndex } from '@lvn-backend/notes'
import { createTestApp, infra, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Search on Typesense (ADR-0055), §18's exit criteria: the index holds exactly what Postgres says after every kind of
 * change (index parity); both providers give the same notes to the same people (query parity); and Typesense failing
 * changes nothing a reader can see.
 */
describe('search on Typesense', () => {
  let t: TestApp
  let pg: TestApp
  let db: PrismaService
  let index: SearchIndex
  const prefix = `x${Date.now().toString(36)}_`
  const ts = infra().typesense
  type Person = { id: string; token: string; handle: string }
  let owner: Person
  let friend: Person
  let member: Person
  let pupil: Person
  let stranger: Person
  const group = newId()
  const classroom = newId()
  const notes: Record<string, string> = {}

  const ERRORS = 'userErrors { field message code }'
  const typesense = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${ts.url}${path}`, { ...init, headers: { 'X-TYPESENSE-API-KEY': ts.apiKey, 'Content-Type': 'application/json' } })
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
    return (path.includes('/export') ? res.text() : res.json()) as Promise<T>
  }
  const typesenseIds = async () =>
    (await typesense<string>(`/collections/${prefix}notes/documents/export?include_fields=id`))
      .split('\n')
      .filter(Boolean)
      .map((l) => (JSON.parse(l) as { id: string }).id)
      .sort()
  const write = async (who: Person, title: string, body: string, visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC') => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>(
      `mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`,
      { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] } } }] } },
      who.token,
    )
    const id = created.data!.createNote.note.id
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId: id } }, who.token)
    if (visibility !== 'PRIVATE') await t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId: id, visibility } }, who.token)
    return id
  }
  const found = async (app: TestApp, query: string, who?: Person) => {
    const res = await app.gql<{ search: { notes: { note: { id: string } }[] } }>('query ($q: String!) { search(query: $q, scopes: [NOTES], first: 20) { notes { note { id } } } }', { q: query }, who?.token)
    return res.data!.search.notes.map((h) => h.note.id).sort()
  }

  beforeAll(async () => {
    const settings = { SEARCH_PROVIDER: 'typesense', TYPESENSE_URL: ts.url, TYPESENSE_API_KEY: ts.apiKey, TYPESENSE_COLLECTION_PREFIX: prefix }
    t = await createTestApp(settings)
    // The same database, answered by Postgres: query parity compares the two.
    pg = await createTestApp({}, { resetDatabase: false })
    db = t.app.get(PrismaService)
    index = t.app.get(SearchIndex)
    const u = async (displayName: string) => {
      const handle = `${displayName.toLowerCase()}${Date.now().toString(36)}`
      const s = await seedUser(t.app, { verified: true, displayName, handle })
      return { id: s.id, token: tokenFor(t.config, s.id), handle }
    }
    owner = await u('Asha')
    friend = await u('Ravi')
    member = await u('Meera')
    pupil = await u('Kiran')
    stranger = await u('Dev')
    await db.groupRead.create({ data: { id: group, members: { create: [{ userId: member.id }] } } })
    await db.classroomRead.create({ data: { id: classroom, members: { create: [{ userId: pupil.id, role: 'STUDENT' }] } } })
    await index.ensureCollections()
    notes.graphs = await write(owner, 'Graph algorithms', 'Dijkstra settles the closest vertex; a priority queue makes it fast.', 'PUBLIC')
    notes.exam = await write(owner, 'Exam notes', 'Recursion, graph traversal and the heap property.', 'SHARED')
    notes.trees = await write(owner, 'Trees', 'Binary search trees keep keys in order; a heap is a tree too.', 'PRIVATE')
    notes.draft = (await t.gql<{ createNote: { note: { id: string } } }>(`mutation { createNote(input: { title: "Unpublished graph ideas" }) { note { id } } }`, {}, owner.token)).data!.createNote.note.id
    await index.drainAll()
  })

  afterAll(async () => {
    await pg?.close()
    await t?.close()
  })

  /** Every note's Typesense document is what Postgres says now, and both indexes hold the same notes. */
  const expectParity = async () => {
    await index.drainAll()
    const indexed = (await db.noteSearchDocument.findMany({ select: { noteId: true } })).map((d) => d.noteId).sort()
    expect(await typesenseIds()).toEqual(indexed)
    const shouldBe = (await db.note.findMany({ where: { publishedVersionId: { not: null }, deletedAt: null }, select: { id: true } })).map((n) => n.id).sort()
    expect(indexed).toEqual(shouldBe)
    for (const id of indexed) {
      const [doc, note] = await Promise.all([
        typesense<Record<string, unknown>>(`/collections/${prefix}notes/documents/${id}`),
        db.note.findUniqueOrThrow({ where: { id }, include: { shares: true, groupShares: true, classroomShares: true, topics: true } }),
      ])
      expect(doc).toMatchObject({ visibility: note.visibility, moderation: note.moderation, ownerId: note.ownerId, kind: note.kind })
      expect((doc.sharedUserIds as string[]).sort()).toEqual(note.shares.map((s) => s.userId).sort())
      expect(doc.groupIds).toEqual(note.groupShares.map((s) => s.groupId))
      expect(doc.classroomIds).toEqual(note.classroomShares.map((s) => s.classroomId))
      expect((doc.topicIds as string[]).sort()).toEqual(note.topics.map((s) => s.topicId).sort())
    }
  }

  it('creates the collections behind their aliases, with what Postgres holds', async () => {
    expect(await typesense(`/aliases/${prefix}notes`)).toMatchObject({ collection_name: `${prefix}notes_v1` })
    expect(await typesense(`/aliases/${prefix}users`)).toMatchObject({ collection_name: `${prefix}users_v1` })
    expect(await typesense(`/aliases/${prefix}topics`)).toMatchObject({ collection_name: `${prefix}topics_v1` })
    expect(await db.searchCollection.findMany({ where: { marker: { not: null } } })).toEqual([])
    await expectParity()
  })

  it('keeps every document in step through shares, places, moderation, topics, trash and deletion (index parity)', async () => {
    const share = await t.gql(`mutation ($input: ShareNoteInput!) { shareNote(input: $input) { ${ERRORS} } }`, { input: { noteId: notes.exam, person: friend.handle, role: 'VIEWER' } }, owner.token)
    expect(share.errors).toBeUndefined()
    await expectParity()
    // Straight to the tables, as every write path does: the triggers see each one.
    await db.groupShare.create({ data: { noteId: notes.exam!, groupId: group, sharedById: owner.id } })
    await db.classroomShare.create({ data: { noteId: notes.exam!, classroomId: classroom, sharedById: owner.id } })
    const topic = await db.topic.findFirstOrThrow({ where: { origin: 'CURATED' } })
    await db.noteTopic.create({ data: { noteId: notes.graphs!, topicId: topic.id } })
    await expectParity()
    expect((await typesense<{ topics: string[] }>(`/collections/${prefix}notes/documents/${notes.graphs}`)).topics).toEqual([topic.title])
    await db.topic.update({ where: { id: topic.id }, data: { title: `${topic.title} (renamed)` } })
    await expectParity()
    expect((await typesense<{ topics: string[] }>(`/collections/${prefix}notes/documents/${notes.graphs}`)).topics).toEqual([`${topic.title} (renamed)`])
    await db.topic.update({ where: { id: topic.id }, data: { title: topic.title } })
    await db.note.update({ where: { id: notes.graphs }, data: { moderation: 'HIDDEN' } })
    await expectParity()
    await db.note.update({ where: { id: notes.graphs }, data: { moderation: 'OK' } })
    await db.noteShare.deleteMany({ where: { noteId: notes.exam } })
    await db.note.update({ where: { id: notes.trees }, data: { deletedAt: new Date() } })
    await expectParity()
    expect(await typesenseIds()).not.toContain(notes.trees)
    await db.note.update({ where: { id: notes.trees }, data: { deletedAt: null } })
    await expectParity()
    const gone = await write(owner, 'Short-lived', 'Soon deleted for good.', 'PUBLIC')
    await index.drainAll()
    await db.note.delete({ where: { id: gone } })
    await expectParity()
  })

  it('gives each person the same notes from either provider (query parity)', async () => {
    await db.noteShare.create({ data: { noteId: notes.exam!, userId: friend.id, role: 'VIEWER', createdById: owner.id } })
    await index.drainAll()
    for (const who of [owner, friend, member, pupil, stranger, undefined]) {
      for (const query of ['graph', 'heap', 'priority queue', 'tree', 'recursion', 'dijkstra', 'unpublished']) {
        expect([who?.handle ?? 'anonymous', query, await found(t, query, who)]).toEqual([who?.handle ?? 'anonymous', query, await found(pg, query, who)])
      }
    }
    expect(await found(t, 'heap', pupil)).toEqual([notes.exam])
    expect(await found(t, 'heap', owner)).toEqual([notes.exam, notes.trees].sort())
    expect(await found(t, 'graph')).toEqual([notes.graphs])
  })

  it('removes documents whose note is gone and rewrites stale ones on reindex-all', async () => {
    await typesense(`/collections/${prefix}notes_v1/documents`, { method: 'POST', body: JSON.stringify({ id: newId(), title: 'Orphan', topics: [], body: 'graph', kind: 'NOTE', visibility: 'PUBLIC', moderation: 'OK', ownerId: owner.id, sharedUserIds: [], groupIds: [], classroomIds: [], topicIds: [], subjectIds: [], publishedAt: 1 }) })
    await typesense(`/collections/${prefix}notes_v1/documents/${notes.exam}`, { method: 'PATCH', body: JSON.stringify({ visibility: 'PUBLIC' }) })
    await index.reindexAll()
    await expectParity()
  })

  it('builds a new collection version beside the old one and moves the alias when it is complete', async () => {
    // As if this code had just bumped the version: the alias points at an older one, and v1 does not exist yet.
    const old = `${prefix}notes_v0`
    await typesense('/collections', { method: 'POST', body: JSON.stringify({ name: old, fields: [{ name: 'title', type: 'string' }] }) })
    await typesense(`/aliases/${prefix}notes`, { method: 'PUT', body: JSON.stringify({ collection_name: old }) })
    await typesense(`/collections/${prefix}notes_v1`, { method: 'DELETE' })
    await index.ensureCollections()
    expect((await db.searchCollection.findUniqueOrThrow({ where: { name: 'notes' } })).marker).not.toBeNull()
    await index.drainAll()
    expect(await typesense(`/aliases/${prefix}notes`)).toMatchObject({ collection_name: `${prefix}notes_v1` })
    const names = (await typesense<{ name: string }[]>('/collections')).map((c) => c.name)
    expect(names).not.toContain(old)
    await expectParity()
    expect(await found(t, 'graph')).toEqual([notes.graphs])
  })

  it('finds people past the consent age by name or handle, never minors or across a block', async () => {
    const minor = await seedUser(t.app, { verified: true, displayName: 'Ravi Junior', handle: `ravijr${Date.now().toString(36)}` })
    await db.user.update({ where: { id: minor.id }, data: { dateOfBirth: new Date('2014-05-01') } })
    await index.touchAll('USER')
    await index.drainAll()
    const people = async (q: string, who: Person) => (await t.gql<{ search: { people: { id: string }[] } }>('query ($q: String!) { search(query: $q, scopes: [PEOPLE]) { people { id } } }', { q }, who.token)).data!.search.people.map((p) => p.id)
    expect(await people('ravi', stranger)).toEqual([friend.id])
    expect(await people(`@${friend.handle.slice(0, 6)}`, stranger)).toEqual([friend.id])
    await db.block.create({ data: { blockerId: friend.id, blockedId: stranger.id } })
    expect(await people('ravi', stranger)).toEqual([])
    // The block is between Ravi and Dev: Dev still finds Asha's public note.
    expect(await found(t, 'graph', stranger)).toEqual([notes.graphs])
  })

  it('answers from Postgres when Typesense is unreachable, and keeps the Postgres index moving', async () => {
    const down = await createTestApp({ SEARCH_PROVIDER: 'typesense', TYPESENSE_URL: 'http://127.0.0.1:9', TYPESENSE_API_KEY: ts.apiKey, TYPESENSE_COLLECTION_PREFIX: prefix, LOG_LEVEL: 'warn' }, { resetDatabase: false })
    try {
      expect(await found(down, 'graph', owner)).toEqual([notes.exam, notes.graphs].sort())
      expect(down.logs().some((l) => String(l.msg).includes('search.fallback'))).toBe(true)
      // A note published while Typesense is away: Postgres's index takes it, and the row waits for Typesense.
      const id = await write(owner, 'Written during the outage', 'Tarjan finds bridges.', 'PUBLIC')
      await expect(down.app.get(SearchIndex).drain()).rejects.toThrow()
      expect(await db.noteSearchDocument.findUnique({ where: { noteId: id } })).not.toBeNull()
      expect(await db.searchChange.count({ where: { entityId: id, postgresAt: { not: null } } })).toBeGreaterThan(0)
      expect(await found(down, 'tarjan', owner)).toEqual([id])
      // Typesense back: the waiting rows reach it.
      await index.drainAll()
      expect(await found(t, 'tarjan', owner)).toEqual([id])
      expect(await db.searchChange.count()).toBe(0)
    } finally {
      await down.close()
    }
  })
})

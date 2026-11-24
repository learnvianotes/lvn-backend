import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { NotesMaintenance } from '@lvn-backend/notes'
import { positionBetween, positionsBetween } from '@lvn/contracts/validation'
import { Storage } from '@lvn-backend/storage'
import { createTestApp, type TestApp } from '../support/app'
import { createIntent, SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** The notes core of Phase 2 (§4.1–§4.5, §13.2) through the public GraphQL endpoint, against real Postgres. */

const NOTE = `id title slug kind visibility viewerAccess draftRevision cardCount deletedAt publishedAt
  viewerCan { edit publish delete share fork }
  folder { id name } tags { name } topics { slug }
  owner { id displayName email }
  outline { cardId level text }
  publishedVersion { number kind }
  cards(first: 100) { edges { node { id type position revision content } } pageInfo { hasNextPage endCursor } }`
const ERRORS = 'userErrors { field message code }'

type Card = { id: string; type: string; position: string; revision: number; content: Record<string, unknown> }
type Note = {
  id: string
  title: string
  slug: string
  viewerAccess: string
  draftRevision: number | null
  cardCount: number
  deletedAt: string | null
  publishedAt: string | null
  viewerCan: Record<string, boolean>
  folder: { id: string; name: string } | null
  tags: { name: string }[]
  topics: { slug: string }[]
  owner: { id: string; displayName: string; email: string | null }
  outline: { cardId: string; level: number; text: string }[]
  publishedVersion: { number: number; kind: string } | null
  cards: { edges: { node: Card }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
}
type UserErrors = { field: string[] | null; message: string; code: string }[]

const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
const heading = (s: string, level = 1) => ({ level, content: [{ type: 'text', text: s }] })
const cardsOf = (n: Note) => n.cards.edges.map((e) => e.node)
const words = (c: Card) => (c.content.doc as { content: { content: { text: string }[] }[] }).content[0]!.content[0]!.text

describe('notes', () => {
  let t: TestApp
  let db: PrismaService
  let owner: { id: string; token: string }
  let unverified: { id: string; token: string }
  let other: { id: string; token: string }

  const user = async (verified: boolean, name: string) => {
    const u = await seedUser(t.app, { verified, displayName: name })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }

  const create = async (token: string, input: object) => {
    const res = await t.gql<{ createNote: { note: Note | null; userErrors: UserErrors } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { ${NOTE} } ${ERRORS} } }`, { input }, token)
    return res.data!.createNote
  }
  const save = async (token: string, input: object) => {
    const res = await t.gql<{ updateNoteDraft: { note: Note | null; results: { id: string; status: string; revision: number | null; message: string | null }[]; conflictVersion: { kind: string; number: number; cards: { edges: { node: Card }[] } } | null; userErrors: UserErrors } }>(
      `mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { note { ${NOTE} } results { id status revision message } conflictVersion { kind number cards { edges { node { id content } } } } ${ERRORS} } }`,
      { input },
      token,
    )
    if (res.errors) return { errors: res.errors }
    return res.data!.updateNoteDraft
  }
  const read = async (id: string, token?: string) => (await t.gql<{ note: Note | null }>(`query ($id: UUID!) { note(id: $id) { ${NOTE} } }`, { id }, token)).data!.note
  const mutate = async (name: string, input: object, token: string, selection = `note { ${NOTE} } ${ERRORS}`) => {
    const res = await t.gql<Record<string, { note: Note | null; ok?: boolean; userErrors: UserErrors }>>(`mutation ($input: ${name === 'restoreNoteVersion' ? 'RestoreNoteVersionInput' : 'NoteIdInput'}!) { ${name}(input: $input) { ${selection} } }`, { input }, token)
    return { payload: res.data?.[name], errors: res.errors }
  }
  const share = (noteId: string, userId: string, role: 'EDITOR' | 'VIEWER', visibility: 'SHARED' | 'PUBLIC' = 'SHARED') =>
    db.$transaction([db.note.update({ where: { id: noteId }, data: { visibility } }), db.noteShare.create({ data: { noteId, userId, role, createdById: owner.id } })])

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    owner = await user(true, 'Asha Rao')
    unverified = await user(false, 'New Student')
    other = await user(true, 'Ravi Kumar')
  })
  afterAll(() => t.close())

  describe('creating and reading', () => {
    it('creates a note with its cards, in order, and shows the owner everything', async () => {
      const [p1, p2, p3] = positionsBetween(null, null, 3)
      const ids = [newId(), newId(), newId()]
      const { note, userErrors } = await create(owner.token, {
        title: '  Binary   search ',
        cards: [
          { id: ids[2], type: 'text', position: p3, content: text('third') },
          { id: ids[0], type: 'heading', position: p1, content: heading('Idea') },
          { id: ids[1], type: 'code', position: p2, content: { language: 'python', code: 'lo, hi = 0, n' } },
        ],
        tagNames: ['DSA', 'dsa', 'exam prep'],
      })
      expect(userErrors).toEqual([])
      expect(note).toMatchObject({ title: 'Binary search', viewerAccess: 'OWNER', draftRevision: 1, cardCount: 3, folder: null, publishedVersion: null })
      expect(cardsOf(note!).map((c) => c.id)).toEqual(ids)
      expect(note!.outline).toEqual([{ cardId: ids[0], level: 1, text: 'Idea' }])
      expect(note!.tags.map((x) => x.name)).toEqual(['DSA', 'exam prep'])
      expect(note!.owner).toMatchObject({ id: owner.id, displayName: 'Asha Rao' })
      expect(note!.viewerCan).toEqual({ edit: true, publish: true, delete: true, share: true, fork: true })
    })

    it('lists notes with the first words of each, in one query for the page', async () => {
      const first = await create(owner.token, { title: 'Excerpts', cards: [
        { id: newId(), type: 'heading', position: 'a0', content: heading('Skipped: headings are titles') },
        { id: newId(), type: 'text', position: 'a1', content: text(`Queues ${'keep order. '.repeat(30)}`) },
      ] })
      await create(owner.token, { title: 'Empty one' })
      const res = await t.gql<{ myNotes: { edges: { node: { id: string; title: string; excerpt: string } }[] } }>('{ myNotes(first: 50) { edges { node { id title excerpt } } } }', {}, owner.token)
      const byTitle = Object.fromEntries(res.data!.myNotes.edges.map((e) => [e.node.title, e.node.excerpt]))
      expect(byTitle['Excerpts']).toMatch(/^Queues keep order\. keep order\./)
      expect(byTitle['Excerpts']!.length).toBeLessThanOrEqual(180)
      expect(byTitle['Excerpts']!.endsWith('…')).toBe(true)
      expect(byTitle['Empty one']).toBe('')
      expect(first.note!.id).toBeDefined()
    })

    it('pages through cards with a cursor', async () => {
      const keys = positionsBetween(null, null, 7)
      const { note } = await create(owner.token, { cards: keys.map((position, i) => ({ id: newId(), type: 'text', position, content: text(`card ${i}`) })) })
      const seen: string[] = []
      let after: string | null = null
      do {
        const res: { data?: { note: { cards: Note['cards'] } } } = await t.gql<{ note: { cards: Note['cards'] } }>('query ($id: UUID!, $after: String) { note(id: $id) { cards(first: 3, after: $after) { edges { node { id content } } pageInfo { hasNextPage endCursor } } } }', { id: note!.id, after }, owner.token)
        const page: Note['cards'] = res.data!.note.cards
        seen.push(...page.edges.map((e) => words(e.node as Card)))
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
      } while (after)
      expect(seen).toEqual(keys.map((_, i) => `card ${i}`))
    })

    it('refuses invalid cards and writes nothing', async () => {
      const bad = [
        [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] } } }, ['input', 'cards', '0', 'content']],
        [{ id: newId(), type: 'image', position: 'a0', content: { fileId: newId() } }, ['input', 'cards', '0', 'type']],
        [{ id: newId(), type: 'text', position: 'not a position', content: text('x') }, ['input', 'cards', '0', 'position']],
      ] as const
      const before = await db.note.count()
      for (const [card, field] of bad) {
        const { note, userErrors } = await create(owner.token, { title: 'nope', cards: [card] })
        expect(note).toBeNull()
        expect(userErrors[0]).toMatchObject({ code: 'VALIDATION', field })
      }
      expect(await db.note.count()).toBe(before)
    })

    it('creates notes and projects for anyone; blogs and posts are for teachers (ADR-0014, ADR-0044)', async () => {
      const res = await t.gql(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { kind: 'BLOG' } }, owner.token)
      expect(res.errors?.[0]).toMatchObject({ message: 'Blogs and posts are for teachers.', extensions: { code: 'FORBIDDEN' } })
      expect((await create(owner.token, { kind: 'PROJECT', title: 'A project' })).note).not.toBeNull()
    })
  })

  describe('saving the draft (§13.2)', () => {
    it('applies card changes, bumps revisions and keeps metadata last-writer-wins', async () => {
      const a = newId()
      const { note } = await create(owner.token, { title: 'Draft', cards: [{ id: a, type: 'text', position: 'a0', content: text('one') }] })
      const b = newId()
      const saved = await save(owner.token, {
        noteId: note!.id,
        title: 'Draft, renamed',
        ops: [
          { kind: 'UPSERT', id: a, type: 'text', position: 'a0', content: text('one, edited'), baseRevision: 1 },
          { kind: 'UPSERT', id: b, type: 'quote', position: positionBetween(null, 'a0'), content: { doc: text('first').doc, attribution: 'me' } },
        ],
      })
      if ('errors' in saved) throw new Error(JSON.stringify(saved.errors))
      expect(saved.results).toEqual([
        { id: a, status: 'APPLIED', revision: 2, message: null },
        { id: b, status: 'APPLIED', revision: 1, message: null },
      ])
      expect(saved.note).toMatchObject({ title: 'Draft, renamed', draftRevision: 2 })
      expect(cardsOf(saved.note!).map((c) => c.id)).toEqual([b, a])

      const moved = await save(owner.token, { noteId: note!.id, ops: [{ kind: 'MOVE', id: b, position: 'a1' }] })
      if ('errors' in moved) throw new Error()
      expect(cardsOf(moved.note!).map((c) => [c.id, c.revision])).toEqual([[a, 2], [b, 1]])
    })

    it('keeps both sides when a card was changed on two devices, and never loses a delete conflict', async () => {
      const a = newId()
      const { note } = await create(owner.token, { cards: [{ id: a, type: 'text', position: 'a0', content: text('base') }] })
      const phone = await save(owner.token, { noteId: note!.id, ops: [{ kind: 'UPSERT', id: a, type: 'text', position: 'a0', content: text('from the phone'), baseRevision: 1 }] })
      const laptop = await save(owner.token, { noteId: note!.id, ops: [{ kind: 'UPSERT', id: a, type: 'text', position: 'a0', content: text('from the laptop'), baseRevision: 1 }] })
      if ('errors' in phone || 'errors' in laptop) throw new Error()
      expect(laptop.results[0]).toMatchObject({ status: 'APPLIED_WITH_CONFLICT', revision: 3 })
      // The latest write wins; the phone's text is kept as a CONFLICT version, restorable.
      expect(words(cardsOf(laptop.note!)[0]!)).toBe('from the laptop')
      expect(laptop.conflictVersion).toMatchObject({ kind: 'CONFLICT' })
      expect(words(laptop.conflictVersion!.cards.edges[0]!.node)).toBe('from the phone')

      // A delete from a device that has not seen the latest change is refused; a delete of a card deleted elsewhere is fine.
      const del = await save(owner.token, { noteId: note!.id, ops: [{ kind: 'DELETE', id: a, baseRevision: 1 }] })
      if ('errors' in del) throw new Error()
      expect(del.results[0]).toMatchObject({ status: 'REJECTED' })
      expect(del.note!.cardCount).toBe(1)
      const ok = await save(owner.token, { noteId: note!.id, ops: [{ kind: 'DELETE', id: a, baseRevision: 3 }] })
      const again = await save(owner.token, { noteId: note!.id, ops: [{ kind: 'DELETE', id: a, baseRevision: 3 }] })
      if ('errors' in ok || 'errors' in again) throw new Error()
      expect([ok.results[0]!.status, again.results[0]!.status, again.note!.cardCount]).toEqual(['APPLIED', 'APPLIED', 0])

      // Create wins: editing a card that was deleted on another device brings it back.
      const back = await save(owner.token, { noteId: note!.id, ops: [{ kind: 'UPSERT', id: a, type: 'text', position: 'a0', content: text('still needed'), baseRevision: 3 }] })
      if ('errors' in back) throw new Error()
      expect(back.results[0]).toMatchObject({ status: 'APPLIED', revision: 4 })
      expect(back.note!.cardCount).toBe(1)
    })

    it('fails the whole save when one card is invalid', async () => {
      const a = newId()
      const { note } = await create(owner.token, { cards: [{ id: a, type: 'text', position: 'a0', content: text('keep me') }] })
      const res = await save(owner.token, {
        noteId: note!.id,
        title: 'changed',
        ops: [
          { kind: 'UPSERT', id: a, type: 'text', position: 'a0', content: text('changed'), baseRevision: 1 },
          { kind: 'UPSERT', id: newId(), type: 'heading', position: 'a1', content: { level: 9, content: [] } },
        ],
      })
      if ('errors' in res) throw new Error()
      expect(res.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'ops', '1', 'content'] })
      const after = await read(note!.id, owner.token)
      expect([after!.title, words(cardsOf(after!)[0]!), after!.draftRevision]).toEqual(['', 'keep me', 1])
    })

    it('refuses a card id that belongs to another note', async () => {
      const a = newId()
      await create(owner.token, { cards: [{ id: a, type: 'text', position: 'a0', content: text('mine') }] })
      const { note } = await create(owner.token, {})
      const res = await save(owner.token, { noteId: note!.id, ops: [{ kind: 'UPSERT', id: a, type: 'text', position: 'a0', content: text('stolen') }] })
      if ('errors' in res) throw new Error()
      expect(res.userErrors[0]).toMatchObject({ code: 'CONFLICT' })
    })
  })

  describe('publishing, readers and versions (§4.3)', () => {
    it('lets only a verified owner publish, and readers then see the published version, not the draft', async () => {
      const a = newId()
      const draft = await create(unverified.token, { title: 'Mine', cards: [{ id: a, type: 'text', position: 'a0', content: text('v1') }] })
      const refused = await mutate('publishNote', { noteId: draft.note!.id }, unverified.token)
      expect(refused.errors?.[0]).toMatchObject({ message: 'Verify your account to publish notes.', extensions: { code: 'FORBIDDEN' } })

      const { note } = await create(owner.token, { title: 'Graphs: BFS', cards: [{ id: a + '', type: 'text', position: 'a0', content: text('v1') }].map((c) => ({ ...c, id: newId() })) })
      const published = await mutate('publishNote', { noteId: note!.id }, owner.token)
      expect(published.payload!.note).toMatchObject({ slug: 'graphs-bfs', publishedVersion: { number: 1, kind: 'PUBLISHED' } })
      const cardId = cardsOf(published.payload!.note!)[0]!.id
      await save(owner.token, { noteId: note!.id, ops: [{ kind: 'UPSERT', id: cardId, type: 'text', position: 'a0', content: text('v2, unpublished'), baseRevision: 1 }] })

      // PRIVATE: nobody else, not even with the id.
      expect(await read(note!.id, other.token)).toBeNull()
      expect(await read(note!.id)).toBeNull()

      // SHARED with a viewer: the published version only, no draft revision, no history.
      await share(note!.id, other.id, 'VIEWER')
      const asViewer = await read(note!.id, other.token)
      expect(asViewer).toMatchObject({ viewerAccess: 'READER', draftRevision: null, tags: [], folder: null, owner: { displayName: 'Asha Rao', email: null } })
      expect(words(cardsOf(asViewer!)[0]!)).toBe('v1')
      expect(asViewer!.viewerCan).toMatchObject({ edit: false, publish: false, delete: false })
      const history = await t.gql<{ note: { versions: unknown } }>('query ($id: UUID!) { note(id: $id) { versions { edges { node { id } } } } }', { id: note!.id }, other.token)
      expect(history.data!.note.versions).toBeNull()
      const edit = await save(other.token, { noteId: note!.id, ops: [{ kind: 'UPSERT', id: cardId, type: 'text', position: 'a0', content: text('hacked') }] })
      expect('errors' in edit && edit.errors![0]!.extensions.code).toBe('FORBIDDEN')

      // PUBLIC: anyone, signed in or not — still the published version.
      await db.note.update({ where: { id: note!.id }, data: { visibility: 'PUBLIC' } })
      expect(words(cardsOf((await read(note!.id))!)[0]!)).toBe('v1')
    })

    it('lets a share editor work on the draft but not publish, delete or reorganise', async () => {
      const a = newId()
      const { note } = await create(owner.token, { title: 'Together', cards: [{ id: a, type: 'text', position: 'a0', content: text('owner wrote') }] })
      const editor = await user(true, 'Editor E')
      await share(note!.id, editor.id, 'EDITOR')
      const seen = await read(note!.id, editor.token)
      expect(seen).toMatchObject({ viewerAccess: 'EDITOR', draftRevision: 1, viewerCan: { edit: true, publish: false, delete: false, share: false } })
      const saved = await save(editor.token, { noteId: note!.id, ops: [{ kind: 'UPSERT', id: a, type: 'text', position: 'a0', content: text('editor wrote'), baseRevision: 1 }] })
      if ('errors' in saved) throw new Error()
      expect(saved.results[0]!.status).toBe('APPLIED')
      expect((await mutate('publishNote', { noteId: note!.id }, editor.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      expect((await mutate('deleteNote', { noteId: note!.id }, editor.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      const tags = await save(editor.token, { noteId: note!.id, tagNames: ['mine'] })
      expect('errors' in tags && tags.errors![0]!.extensions.code).toBe('FORBIDDEN')
    })

    it('restores an old version and keeps the replaced draft as a DRAFT version', async () => {
      const a = newId()
      const { note } = await create(owner.token, { title: 'v1 title', cards: [{ id: a, type: 'text', position: 'a0', content: text('version one') }] })
      const v1 = (await mutate('publishNote', { noteId: note!.id }, owner.token, `note { id publishedVersion { number } } ${ERRORS}`)).payload!
      const versionId = (await db.noteVersion.findFirstOrThrow({ where: { noteId: note!.id, number: 1 } })).id
      expect(v1.note!.publishedVersion).toEqual({ number: 1 })
      const b = newId()
      await save(owner.token, { noteId: note!.id, title: 'v2 title', ops: [{ kind: 'DELETE', id: a, baseRevision: 1 }, { kind: 'UPSERT', id: b, type: 'text', position: 'a1', content: text('version two') }] })

      const restored = (await mutate('restoreNoteVersion', { noteId: note!.id, versionId }, owner.token)).payload!
      expect(restored.userErrors).toEqual([])
      expect(restored.note!.title).toBe('v1 title')
      expect(cardsOf(restored.note!).map((c) => [c.id, words(c)])).toEqual([[a, 'version one']])
      const versions = await db.noteVersion.findMany({ where: { noteId: note!.id }, orderBy: { number: 'asc' } })
      expect(versions.map((v) => [v.number, v.kind, v.title])).toEqual([[1, 'PUBLISHED', 'v1 title'], [2, 'DRAFT', 'v2 title']])
      expect(((versions[1]!.cards as unknown) as Card[]).map((c) => c.id)).toEqual([b])

      // The history, newest first, page by page.
      const page1 = await t.gql<{ note: { versions: { edges: { node: { number: number; kind: string; createdBy: { displayName: string } } }[]; pageInfo: { hasNextPage: boolean; endCursor: string } } } }>(
        'query ($id: UUID!) { note(id: $id) { versions(first: 1) { edges { node { number kind createdBy { displayName } } } pageInfo { hasNextPage endCursor } } } }',
        { id: note!.id },
        owner.token,
      )
      expect(page1.errors).toBeUndefined()
      expect(page1.data!.note.versions.edges.map((e) => e.node)).toEqual([{ number: 2, kind: 'DRAFT', createdBy: { displayName: 'Asha Rao' } }])
      const page2 = await t.gql<{ note: { versions: { edges: { node: { number: number } }[]; pageInfo: { hasNextPage: boolean } } } }>(
        'query ($id: UUID!, $after: String) { note(id: $id) { versions(first: 5, after: $after) { edges { node { number } } pageInfo { hasNextPage } } } }',
        { id: note!.id, after: page1.data!.note.versions.pageInfo.endCursor },
        owner.token,
      )
      expect(page2.data!.note.versions.edges.map((e) => e.node.number)).toEqual([1])
      expect(page2.data!.note.versions.pageInfo.hasNextPage).toBe(false)

      // Editors preview one version; it must belong to this note, and readers get nothing.
      const preview = await t.gql<{ note: { version: { number: number; kind: string; cards: { edges: { node: Card }[] } } | null } }>('query ($id: UUID!, $v: UUID!) { note(id: $id) { version(id: $v) { number kind cards { edges { node { id content } } } } } }', { id: note!.id, v: versions[1]!.id }, owner.token)
      expect(preview.data!.note.version).toMatchObject({ number: 2, kind: 'DRAFT' })
      expect(words(preview.data!.note.version!.cards.edges[0]!.node)).toBe('version two')
      const { note: elsewhere } = await create(owner.token, {})
      const foreign = await t.gql<{ note: { version: unknown } }>('query ($id: UUID!, $v: UUID!) { note(id: $id) { version(id: $v) { number } } }', { id: elsewhere!.id, v: versions[1]!.id }, owner.token)
      expect(foreign.data!.note.version).toBeNull()
    })

    it('prunes old versions nightly but keeps what readers see and every version of a public note', async () => {
      const { note } = await create(owner.token, { title: 'Busy note', cards: [{ id: newId(), type: 'text', position: 'a0', content: text('x') }] })
      const { note: pub } = await create(owner.token, { title: 'Busy public note', cards: [{ id: newId(), type: 'text', position: 'a0', content: text('x') }] })
      for (const n of [note!, pub!]) for (let i = 0; i < 53; i++) await mutate('publishNote', { noteId: n.id }, owner.token, 'note { id }')
      await db.note.update({ where: { id: pub!.id }, data: { visibility: 'PUBLIC' } })
      await t.app.get(NotesMaintenance).pruneVersions()
      expect(await db.noteVersion.count({ where: { noteId: note!.id } })).toBe(50)
      expect(await db.noteVersion.count({ where: { noteId: pub!.id } })).toBe(53)
      expect((await read(note!.id, owner.token))!.publishedVersion!.number).toBe(53)
    })
  })

  describe('visibility, sharing and forking (§4.2, §4.4, ADR-0010)', () => {
    const run = async (mutation: string, input: object, token: string, selection = 'note { id visibility allowForks }') => {
      const res = await t.gql<Record<string, { note: { id: string; visibility: string; allowForks: boolean } | null; userErrors: UserErrors }>>(`mutation ($input: ${mutation[0]!.toUpperCase()}${mutation.slice(1)}Input!) { ${mutation}(input: $input) { ${selection} ${ERRORS} } }`, { input }, token)
      return { payload: res.data?.[mutation], error: res.errors?.[0] }
    }
    const fork = (noteId: string, token: string) =>
      t.gql<{ forkNote: { note: { id: string; visibility: string; forkedFrom: { title: string | null; author: { displayName: string }; note: { id: string } | null } | null } | null; userErrors: UserErrors } }>(
        'mutation ($input: NoteIdInput!) { forkNote(input: $input) { note { id visibility forkedFrom { title author { displayName } note { id } } } userErrors { field message code } } }',
        { input: { noteId } },
        token,
      )
    const publishedNote = async (token: string, title: string) => {
      const { note } = await create(token, { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: text(`${title} body`) }] })
      await mutate('publishNote', { noteId: note!.id }, token, 'note { id }')
      return note!.id
    }

    it('lets an unverified owner set Shared, and still needs a published version before going public', async () => {
      const { note } = await create(unverified.token, { title: 'Mine' })
      expect((await run('changeNoteVisibility', { noteId: note!.id, visibility: 'SHARED' }, unverified.token)).payload!.note!.visibility).toBe('SHARED')
      expect((await run('changeNoteVisibility', { noteId: note!.id, visibility: 'PUBLIC' }, unverified.token)).error).toMatchObject({ message: 'Your account cannot make notes public.', extensions: { code: 'FORBIDDEN' } })
      const { note: draft } = await create(owner.token, { title: 'Not yet' })
      expect((await run('changeNoteVisibility', { noteId: draft!.id, visibility: 'PUBLIC' }, owner.token)).payload!.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'visibility'] })

      const id = await publishedNote(owner.token, 'Going public')
      expect((await run('changeNoteVisibility', { noteId: id, visibility: 'PUBLIC' }, owner.token)).payload!.note!.visibility).toBe('PUBLIC')
      expect(await read(id)).not.toBeNull()
      await run('changeNoteVisibility', { noteId: id, visibility: 'PRIVATE' }, owner.token)
      expect(await read(id)).toBeNull()
      const audit = await db.auditLog.findMany({ where: { targetId: id, action: 'note.visibility' }, orderBy: { createdAt: 'asc' } })
      expect(audit.map((a) => a.metadata)).toEqual([{ from: 'PRIVATE', to: 'PUBLIC' }, { from: 'PUBLIC', to: 'PRIVATE' }])
    })

    it('shares with a person by handle or email, changes their role and takes it back', async () => {
      const reader = await seedUser(t.app, { verified: true, displayName: 'Reader R', handle: `reader${Date.now()}` })
      const readerToken = tokenFor(t.config, reader.id)
      const id = await publishedNote(owner.token, 'For my friend')
      expect((await run('shareNote', { noteId: id, person: 'nobody-here', role: 'VIEWER' }, owner.token)).payload!.userErrors[0]).toMatchObject({ field: ['input', 'person'] })
      expect((await run('shareNote', { noteId: id, person: (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).handle, role: 'VIEWER' }, owner.token)).payload!.userErrors[0]!.message).toBe('This is your own note.')

      const shared = await run('shareNote', { noteId: id, person: `@${reader.handle}`, role: 'VIEWER' }, owner.token)
      // A PRIVATE note becomes SHARED: share rows grant nothing on a PRIVATE note.
      expect(shared.payload!.note!.visibility).toBe('SHARED')
      const listed = await t.gql<{ sharedWithMe: { edges: { node: { id: string; viewerAccess: string } }[] } }>('{ sharedWithMe { edges { node { id viewerAccess } } } }', {}, readerToken)
      expect(listed.data!.sharedWithMe.edges.map((e) => e.node)).toContainEqual({ id, viewerAccess: 'READER' })
      const shares = await t.gql<{ note: { shares: { user: { id: string }; role: string }[] | null } }>('query ($id: UUID!) { note(id: $id) { shares { user { id } role } } }', { id }, owner.token)
      expect(shares.data!.note.shares).toEqual([{ user: { id: reader.id }, role: 'VIEWER' }])
      const hidden = await t.gql<{ note: { shares: unknown } }>('query ($id: UUID!) { note(id: $id) { shares { role } } }', { id }, readerToken)
      expect(hidden.data!.note.shares).toBeNull()

      await run('shareNote', { noteId: id, person: reader.email, role: 'EDITOR' }, owner.token)
      expect((await read(id, readerToken))!.viewerAccess).toBe('EDITOR')
      await run('unshareNote', { noteId: id, userId: reader.id }, owner.token)
      expect(await read(id, readerToken)).toBeNull()
      expect((await db.auditLog.findMany({ where: { targetId: id, action: { startsWith: 'note.' } } })).map((a) => a.action).sort()).toEqual(['note.share', 'note.share.role', 'note.unshare', 'note.visibility'])
    })

    it('lets teachers share with teachers only once connected (ADR-0013)', async () => {
      const teacher = await seedUser(t.app, { verified: true, globalRole: 'TEACHER' })
      const other = await seedUser(t.app, { verified: true, globalRole: 'TEACHER' })
      const { note } = await create(tokenFor(t.config, teacher.id), { title: 'Lesson plan' })
      const res = await run('shareNote', { noteId: note!.id, person: other.handle, role: 'VIEWER' }, tokenFor(t.config, teacher.id))
      expect(res.error).toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    })

    it('forks with a credit that stays, and a copy of a shared note never goes public', async () => {
      const forker = await seedUser(t.app, { verified: true, displayName: 'Forker F' })
      const forkerToken = tokenFor(t.config, forker.id)
      const publicId = await publishedNote(owner.token, 'Open origin')
      await run('changeNoteVisibility', { noteId: publicId, visibility: 'PUBLIC' }, owner.token)

      const copy = (await fork(publicId, forkerToken)).data!.forkNote.note!
      expect(copy).toMatchObject({ visibility: 'PRIVATE', forkedFrom: { title: 'Open origin', author: { displayName: 'Asha Rao' }, note: { id: publicId } } })
      expect(words(cardsOf((await read(copy.id, forkerToken))!)[0]!)).toBe('Open origin body')
      // The origin was PUBLIC when forked, so the copy may become PUBLIC.
      await mutate('publishNote', { noteId: copy.id }, forkerToken, 'note { id }')
      expect((await run('changeNoteVisibility', { noteId: copy.id, visibility: 'PUBLIC' }, forkerToken)).payload!.note!.visibility).toBe('PUBLIC')
      // Later the origin goes private: readers of the copy still see who wrote it, not the hidden origin.
      await run('changeNoteVisibility', { noteId: publicId, visibility: 'PRIVATE' }, owner.token)
      const credit = await t.gql<{ note: { forkedFrom: unknown } }>('query ($id: UUID!) { note(id: $id) { forkedFrom { title author { displayName } note { id } } } }', { id: copy.id })
      expect(credit.data!.note.forkedFrom).toEqual({ title: null, author: { displayName: 'Asha Rao' }, note: null })

      const sharedId = await publishedNote(owner.token, 'Shared origin')
      await run('shareNote', { noteId: sharedId, person: forker.email, role: 'VIEWER' }, owner.token)
      const sharedCopy = (await fork(sharedId, forkerToken)).data!.forkNote.note!
      await mutate('publishNote', { noteId: sharedCopy.id }, forkerToken, 'note { id }')
      expect((await run('changeNoteVisibility', { noteId: sharedCopy.id, visibility: 'PUBLIC' }, forkerToken)).error).toMatchObject({ extensions: { code: 'FORBIDDEN' } })
      expect((await run('changeNoteVisibility', { noteId: sharedCopy.id, visibility: 'SHARED' }, forkerToken)).payload!.note!.visibility).toBe('SHARED')
    })

    it('stops copies when the owner turns forking off, except the owner’s own', async () => {
      const id = await publishedNote(owner.token, 'No copies please')
      await run('changeNoteVisibility', { noteId: id, visibility: 'PUBLIC' }, owner.token)
      expect((await run('setNoteForking', { noteId: id, enabled: false }, owner.token)).payload!.note!.allowForks).toBe(false)
      expect((await fork(id, other.token)).errors?.[0]).toMatchObject({ extensions: { code: 'FORBIDDEN' } })
      expect((await fork(id, owner.token)).data!.forkNote.note!.forkedFrom).toMatchObject({ note: { id } })
      // Nobody else can fork what they cannot read.
      const { note: secret } = await create(owner.token, { title: 'Secret' })
      expect((await fork(secret!.id, other.token)).data!.forkNote.userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
    })

    it('keeps restricted minors from making notes public (§15.2)', async () => {
      const minor = await seedUser(t.app, { verified: true })
      await db.user.update({ where: { id: minor.id }, data: { dateOfBirth: new Date('2013-01-01') } })
      const token = tokenFor(t.config, minor.id)
      const id = await publishedNote(token, 'Homework')
      expect((await run('changeNoteVisibility', { noteId: id, visibility: 'PUBLIC' }, token)).error).toMatchObject({ message: 'Your account cannot make notes public.' })
      expect((await run('changeNoteVisibility', { noteId: id, visibility: 'SHARED' }, token)).payload!.note!.visibility).toBe('SHARED')
    })
  })

  describe('media cards (§4.1, §8)', () => {
    type Media = { id: string; url: string; mimeType: string; fileName: string; sizeBytes: number } | null
    const media = async (noteId: string, token?: string) =>
      (await t.gql<{ note: { cards: { edges: { node: { id: string; type: string; media: Media } }[] } } | null }>('query ($id: UUID!) { note(id: $id) { cards { edges { node { id type media { id url mimeType fileName sizeBytes } } } } } }', { id: noteId }, token)).data!.note
    const imageCard = (fileId: string, id = newId()) => ({ kind: 'UPSERT', id, type: 'image', position: 'a5', content: { fileId, alt: 'A diagram' } })

    it('uploads a picture to a note, shows it in an image card and hands readers a read URL', async () => {
      const { note } = await create(owner.token, { title: 'With a picture' })
      const fileId = await upload(t, owner.token, 'ATTACHMENT', 'image/png', SAMPLES.png, 'graph.png', note!.id)
      expect(await db.noteAttachment.findMany({ where: { fileId } })).toEqual([expect.objectContaining({ noteId: note!.id })])
      const saved = await save(owner.token, { noteId: note!.id, ops: [imageCard(fileId)] })
      expect('results' in saved && saved.results[0]!.status).toBe('APPLIED')

      const card = (await media(note!.id, owner.token))!.cards.edges[0]!.node
      expect(card.media).toMatchObject({ id: fileId, mimeType: 'image/png', fileName: 'graph.png', sizeBytes: SAMPLES.png.length })
      const res = await fetch(card.media!.url)
      expect(res.status).toBe(200)
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(SAMPLES.png)

      // Readers of the published version get it too; strangers get nothing.
      await mutate('publishNote', { noteId: note!.id }, owner.token, 'note { id }')
      await share(note!.id, other.id, 'VIEWER')
      expect((await media(note!.id, other.token))!.cards.edges[0]!.node.media).toMatchObject({ id: fileId })
      expect(await media(note!.id, unverified.token)).toBeNull()
    })

    it('only takes uploads to a note its owner or editors can change', async () => {
      const { note } = await create(owner.token, { title: 'Not yours' })
      const asOther = await createIntent(t, other.token, { fileName: 'x.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length, purpose: 'ATTACHMENT', parentId: note!.id })
      expect(asOther.userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
      const noParent = await createIntent(t, owner.token, { fileName: 'x.png', mimeType: 'image/png', sizeBytes: SAMPLES.png.length, purpose: 'ATTACHMENT' })
      expect(noParent.userErrors[0]).toMatchObject({ field: ['input', 'parentId'] })
      const tooBig = await createIntent(t, owner.token, { fileName: 'x.pdf', mimeType: 'application/pdf', sizeBytes: 51 * 1024 ** 2, purpose: 'ATTACHMENT', parentId: note!.id })
      expect(tooBig.userErrors[0]).toMatchObject({ field: ['input', 'sizeBytes'] })
      // A share editor may add files; they count against the editor's own storage.
      await share(note!.id, other.id, 'EDITOR')
      const fileId = await upload(t, other.token, 'ATTACHMENT', 'application/pdf', SAMPLES.pdf, 'notes.pdf', note!.id)
      expect((await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })).ownerId).toBe(other.id)
    })

    it('refuses a card showing a file from another note, a missing file or the wrong kind of file', async () => {
      const { note: mine } = await create(owner.token, { title: 'Mine' })
      const { note: theirs } = await create(other.token, { title: 'Theirs' })
      const theirFile = await upload(t, other.token, 'ATTACHMENT', 'image/png', SAMPLES.png, 'secret.png', theirs!.id)
      const pdf = await upload(t, owner.token, 'ATTACHMENT', 'application/pdf', SAMPLES.pdf, 'a.pdf', mine!.id)
      for (const [op, message] of [
        [imageCard(theirFile), 'Upload the file to this note first.'],
        [imageCard(newId()), 'Upload the file to this note first.'],
        [imageCard(pdf), 'This file cannot be shown in a image card.'],
      ] as const) {
        const res = await save(owner.token, { noteId: mine!.id, ops: [op] })
        expect('userErrors' in res && res.userErrors[0]).toMatchObject({ code: 'VALIDATION', message, field: ['input', 'ops', '0', 'content', 'fileId'] })
      }
      // A file card shows any attachment; a new note cannot start with media cards.
      const ok = await save(owner.token, { noteId: mine!.id, ops: [{ kind: 'UPSERT', id: newId(), type: 'file', position: 'a6', content: { fileId: pdf } }] })
      expect('results' in ok && ok.results[0]!.status).toBe('APPLIED')
      expect((await create(owner.token, { title: 'x', cards: [{ id: newId(), type: 'image', position: 'a0', content: { fileId: pdf } }] })).userErrors[0]).toMatchObject({ field: ['input', 'cards', '0', 'type'] })
    })

    it('copies keep their pictures, and files go when no note links to them any more', async () => {
      const { note } = await create(owner.token, { title: 'Pictured origin' })
      const fileId = await upload(t, owner.token, 'ATTACHMENT', 'image/png', SAMPLES.png, 'p.png', note!.id)
      await save(owner.token, { noteId: note!.id, ops: [imageCard(fileId)] })
      await mutate('publishNote', { noteId: note!.id }, owner.token, 'note { id }')
      await db.note.update({ where: { id: note!.id }, data: { visibility: 'PUBLIC' } })
      const copy = (await t.gql<{ forkNote: { note: { id: string } } }>('mutation ($input: NoteIdInput!) { forkNote(input: $input) { note { id } } }', { input: { noteId: note!.id } }, other.token)).data!.forkNote.note

      // The origin is deleted for good: the copy still shows the picture, so the file stays.
      await mutate('deleteNote', { noteId: note!.id }, owner.token, 'note { id }')
      await mutate('deleteNoteForever', { noteId: note!.id }, owner.token, 'ok')
      expect((await media(copy.id, other.token))!.cards.edges[0]!.node.media).toMatchObject({ id: fileId })
      const row = await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })
      expect(row.deletedAt).toBeNull()

      // Then the copy goes too: nothing links to the file, so its bytes are deleted.
      await mutate('deleteNote', { noteId: copy.id }, other.token, 'note { id }')
      await mutate('deleteNoteForever', { noteId: copy.id }, other.token, 'ok')
      expect(await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ status: 'DELETED' })
      expect(await t.app.get(Storage).head(row.bucket, row.storageKey)).toBeNull()
    })
  })

  describe('the trash (§4.5)', () => {
    it('hides trashed notes from everyone but the owner, restores them, and deletes them for good', async () => {
      const { note } = await create(owner.token, { title: 'To bin' })
      await share(note!.id, other.id, 'EDITOR')
      const binned = (await mutate('deleteNote', { noteId: note!.id }, owner.token)).payload!.note!
      expect(binned.deletedAt).not.toBeNull()
      expect(await read(note!.id, other.token)).toBeNull()
      const list = async (trashed: boolean) => (await t.gql<{ myNotes: { edges: { node: { id: string } }[] } }>('query ($f: NoteFilter) { myNotes(filter: $f) { edges { node { id } } } }', { f: { trashed } }, owner.token)).data!.myNotes.edges.map((e) => e.node.id)
      expect(await list(false)).not.toContain(note!.id)
      expect(await list(true)).toContain(note!.id)
      const edit = await save(owner.token, { noteId: note!.id, title: 'x' })
      expect('userErrors' in edit && edit.userErrors[0]!.message).toBe('Restore the note from the trash first.')

      expect((await mutate('restoreNote', { noteId: note!.id }, owner.token)).payload!.note!.deletedAt).toBeNull()
      expect((await mutate('deleteNoteForever', { noteId: note!.id }, owner.token, `ok ${ERRORS}`)).payload!.userErrors[0]!.message).toBe('Move the note to the trash first.')
      await mutate('deleteNote', { noteId: note!.id }, owner.token)
      expect((await mutate('deleteNoteForever', { noteId: note!.id }, owner.token, `ok ${ERRORS}`)).payload!.ok).toBe(true)
      expect(await db.note.findUnique({ where: { id: note!.id } })).toBeNull()
    })

    it('empties notes left in the trash for 30 days', async () => {
      const { note } = await create(owner.token, { title: 'Old' })
      await db.note.update({ where: { id: note!.id }, data: { deletedAt: new Date(Date.now() - 31 * 24 * 3600 * 1000) } })
      const { note: recent } = await create(owner.token, { title: 'Recent' })
      await mutate('deleteNote', { noteId: recent!.id }, owner.token)
      await t.app.get(NotesMaintenance).emptyTrash()
      expect(await db.note.findUnique({ where: { id: note!.id } })).toBeNull()
      expect(await db.note.findUnique({ where: { id: recent!.id } })).not.toBeNull()
    })
  })

  describe('folders, tags and topics', () => {
    const folderMut = async (name: string, input: object, token = owner.token) =>
      (await t.gql<Record<string, { folder: { id: string; name: string; parentId: string | null; noteCount: number } | null; userErrors: UserErrors }>>(`mutation ($input: ${name === 'createFolder' ? 'CreateFolderInput' : 'UpdateFolderInput'}!) { ${name}(input: $input) { folder { id name parentId noteCount } ${ERRORS} } }`, { input }, token)).data![name]!

    it('nests folders up to five levels, never inside themselves, and moves contents up on delete', async () => {
      const ids: string[] = []
      let parentId: string | null = null
      for (let i = 0; i < 5; i++) {
        const r = await folderMut('createFolder', { name: `Level ${i + 1}`, parentId })
        ids.push(r.folder!.id)
        parentId = r.folder!.id
      }
      expect((await folderMut('createFolder', { name: 'Too deep', parentId })).userErrors[0]!.message).toBe('Folders nest at most 5 levels deep.')
      expect((await folderMut('updateFolder', { id: ids[0], parentId: ids[2] })).userErrors[0]!.message).toBe('A folder cannot go inside itself.')

      const { note } = await create(owner.token, { title: 'Filed', folderId: ids[2] })
      expect(note!.folder).toEqual({ id: ids[2], name: 'Level 3' })
      expect((await create(other.token, { folderId: ids[2] })).userErrors[0]).toMatchObject({ field: ['input', 'folderId'] })
      await t.gql('mutation ($id: UUID!) { deleteFolder(input: { id: $id }) { ok } }', { id: ids[2] }, owner.token)
      expect((await read(note!.id, owner.token))!.folder!.id).toBe(ids[1])
      const folders = (await t.gql<{ myFolders: { id: string; parentId: string | null; noteCount: number }[] }>('{ myFolders { id parentId noteCount } }', {}, owner.token)).data!.myFolders
      expect(folders.find((f) => f.id === ids[3])!.parentId).toBe(ids[1])
      expect(folders.find((f) => f.id === ids[1])!.noteCount).toBe(1)
    })

    it('keeps tags per user, unique ignoring case', async () => {
      const { note } = await create(owner.token, { tagNames: ['Graphs'] })
      await save(owner.token, { noteId: note!.id, tagNames: ['graphs', 'BFS'] })
      const tags = (await t.gql<{ myTags: { id: string; name: string; noteCount: number }[] }>('{ myTags { id name noteCount } }', {}, owner.token)).data!.myTags
      const graphs = tags.find((x) => x.name.toLowerCase() === 'graphs')!
      expect(tags.filter((x) => x.name.toLowerCase() === 'graphs')).toHaveLength(1)
      const bfs = tags.find((x) => x.name === 'BFS')!
      const rename = await t.gql<{ renameTag: { userErrors: UserErrors } }>('mutation ($id: UUID!) { renameTag(input: { id: $id, name: "GRAPHS" }) { tag { id } userErrors { code } } }', { id: bfs.id }, owner.token)
      expect(rename.data!.renameTag.userErrors[0]).toMatchObject({ code: 'CONFLICT' })
      expect((await t.gql<{ myTags: unknown[] }>('{ myTags { id } }', {}, other.token)).data!.myTags).toEqual([])
      await t.gql('mutation ($id: UUID!) { deleteTag(input: { id: $id }) { ok } }', { id: graphs.id }, owner.token)
      expect((await read(note!.id, owner.token))!.tags.map((x) => x.name)).toEqual(['BFS'])
    })

    it('offers the curated subjects and topics, and proposals only to their proposer', async () => {
      const subjects = (await t.gql<{ subjects: { slug: string }[] }>('{ subjects { slug } }')).data!.subjects
      expect(subjects).toHaveLength(22)
      expect(subjects[0]!.slug).toBe('dsa-basics')
      const dsa = (await t.gql<{ subject: { id: string; topics: { title: string; children: { slug: string }[] }[] } }>('{ subject(slug: "dsa-basics") { id topics { title children { slug } } } }')).data!.subject
      expect(dsa.topics.length).toBeGreaterThan(1)
      expect(dsa.topics.flatMap((g) => g.children.map((c) => c.slug))).toContain('analysis')

      const found = (await t.gql<{ findTopics: { slug: string; subject: { slug: string } }[] }>('{ findTopics(query: "binary search") { slug subject { slug } } }')).data!.findTopics
      expect(found.length).toBeGreaterThan(0)

      const proposed = await t.gql<{ proposeTopic: { topic: { id: string; origin: string } } }>('mutation ($s: UUID!) { proposeTopic(input: { subjectId: $s, title: "Bloom filters, gently" }) { topic { id origin } userErrors { message } } }', { s: dsa.id }, owner.token)
      const topic = proposed.data!.proposeTopic.topic
      expect(topic.origin).toBe('PROPOSED')
      const { note } = await create(owner.token, { topicIds: [topic.id] })
      expect(note!.topics).toHaveLength(1)
      expect((await create(other.token, { topicIds: [topic.id] })).userErrors[0]).toMatchObject({ field: ['input', 'topicIds'] })
      const asOther = (await t.gql<{ findTopics: { id: string }[] }>('{ findTopics(query: "bloom filters gently") { id } }', {}, other.token)).data!.findTopics
      expect(asOther).toEqual([])
    })
  })
})

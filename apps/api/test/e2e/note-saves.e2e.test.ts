import { InProcessEventBus } from '@lvn-backend/event-bus'
import { NotesExport } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Saved notes (ADR-0076): a person saves notes they can read; saving is private and has no count; the list shows only
 * what they can still read, page by page; export and erasure.
 */
describe('saved notes', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; token: string; handle: string }

  const person = async (): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true })
    return { id: u.id, token: tokenFor(t.config, u.id), handle: u.handle }
  }
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const gql = async <T>(query: string, variables: object, who?: Person) => {
    const res = await t.gql<T>(query, variables as Record<string, unknown>, who?.token)
    return res
  }
  /** A note, published, at a visibility; returns its id. */
  const note = async (who: Person, title: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') => {
    const id = (await gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc(title) } }] } }, who)).data!.createNote.note.id
    await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, who)
    if (visibility === 'PUBLIC') await visibility_(who, id, 'PUBLIC')
    return id
  }
  const visibility_ = (who: Person, noteId: string, visibility: 'PUBLIC' | 'PRIVATE') => gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId, visibility } }, who)
  const save = async (who: Person, noteId: string, op: 'saveNote' | 'unsaveNote' = 'saveNote') => {
    const res = await gql<Record<string, { note: { id: string; viewerSaved: boolean } | null; userErrors: { message: string; code: string }[] }>>(`mutation ($input: NoteIdInput!) { ${op}(input: $input) { note { id viewerSaved } userErrors { message code } } }`, { input: { noteId } }, who)
    const error = res.errors?.[0] as { message: string; extensions: { code: string } } | undefined
    return { error: error ? { message: error.message, code: error.extensions.code } : (res.data![op]!.userErrors[0] ?? null), note: res.data?.[op]?.note ?? null }
  }
  const saved = async (who: Person, first?: number, after?: string | null) =>
    (await gql<{ savedNotes: { edges: { node: { id: string; title: string; viewerSaved: boolean } }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }>('query ($first: Int, $after: String) { savedNotes(first: $first, after: $after) { edges { node { id title viewerSaved } } pageInfo { hasNextPage endCursor } } }', { first, after }, who)).data!.savedNotes
  const viewerSaved = async (noteId: string, who?: Person) => (await gql<{ note: { viewerSaved: boolean } | null }>('query ($id: UUID!) { note(id: $id) { viewerSaved } }', { id: noteId }, who)).data?.note?.viewerSaved

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
  })
  afterAll(() => t?.close())

  it('saves privately and once; the list is newest saved first, page by page; unsaving takes it off', async () => {
    const author = await person()
    const me = await person()
    const other = await person()
    const a = await note(author, 'Heaps')
    const b = await note(author, 'Tries')
    const c = await note(author, 'Graphs')
    expect((await save(me, a)).error).toBeNull()
    expect((await save(me, a)).note).toEqual({ id: a, viewerSaved: true })
    await save(me, b)
    await save(me, c)
    // Private: only the saver sees it; visitors and others see false, and there is no count to read.
    expect(await viewerSaved(a, me)).toBe(true)
    expect(await viewerSaved(a, other)).toBe(false)
    expect(await viewerSaved(a)).toBe(false)
    expect(await db.noteSave.count({ where: { noteId: a } })).toBe(1)

    const first = await saved(me, 2)
    expect(first.edges.map((e) => e.node.title)).toEqual(['Graphs', 'Tries'])
    expect(first.pageInfo.hasNextPage).toBe(true)
    const second = await saved(me, 2, first.pageInfo.endCursor)
    expect(second.edges.map((e) => e.node.title)).toEqual(['Heaps'])
    expect(second.pageInfo.hasNextPage).toBe(false)
    expect((await saved(other)).edges).toEqual([])

    expect((await save(me, b, 'unsaveNote')).note).toEqual({ id: b, viewerSaved: false })
    expect((await saved(me)).edges.map((e) => e.node.title)).toEqual(['Graphs', 'Heaps'])
    // Visitors cannot save or list.
    expect((await gql('mutation ($input: NoteIdInput!) { saveNote(input: $input) { note { id } } }', { input: { noteId: a } })).errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED')
  })

  it('refuses a note the viewer cannot read, the same as one that does not exist; their own notes can be saved', async () => {
    const author = await person()
    const me = await person()
    const hidden = await note(author, 'Private plans', 'PRIVATE')
    expect((await save(me, hidden)).error).toEqual({ message: 'Note not found.', code: 'NOT_FOUND' })
    expect((await save(me, newId())).error).toEqual({ message: 'Note not found.', code: 'NOT_FOUND' })
    const mine = await note(me, 'My own', 'PRIVATE')
    expect((await save(me, mine)).error).toBeNull()
  })

  it('shows a saved note only while the viewer can read it: private, trashed or blocked leaves it out, and it comes back', async () => {
    const author = await person()
    const me = await person()
    const shown = await note(author, 'Stays')
    const flips = await note(author, 'Goes private')
    const trashed = await note(author, 'Goes to the trash')
    for (const id of [shown, flips, trashed]) await save(me, id)
    await visibility_(author, flips, 'PRIVATE')
    await gql('mutation ($input: NoteIdInput!) { deleteNote(input: $input) { note { id } } }', { input: { noteId: trashed } }, author)
    expect((await saved(me)).edges.map((e) => e.node.title)).toEqual(['Stays'])
    // A page keeps its place when notes in it are left out.
    const one = await saved(me, 1)
    expect(one.edges.map((e) => e.node.title)).toEqual([])
    expect(one.pageInfo.hasNextPage).toBe(true)
    await visibility_(author, flips, 'PUBLIC')
    expect((await saved(me)).edges.map((e) => e.node.title)).toEqual(['Goes private', 'Stays'])
    // A block, either way, keeps the author's notes out of the list.
    await gql('mutation ($input: PersonInput!) { blockUser(input: $input) { userErrors { message } } }', { input: { userId: me.id } }, author)
    expect((await saved(me)).edges).toEqual([])
    expect((await save(me, shown)).error?.code).toBe('NOT_FOUND')
    // Deleting the note for good takes its saves with it.
    await gql('mutation ($noteId: UUID!) { deleteNoteForever(input: { noteId: $noteId }) { ok } }', { noteId: trashed }, author)
    expect(await db.noteSave.count({ where: { noteId: trashed } })).toBe(0)
  })

  it('exports the person’s saves, and erases them with the account', async () => {
    const author = await person()
    const me = await person()
    const id = await note(author, 'Exported')
    await save(me, id)
    const files = (await t.app.get(NotesExport).exportFor(me.id, 10_000_000)).files
    const savedFile = JSON.parse(Buffer.from(files.find((f) => f.path === 'notes/saved.json')!.bytes).toString()) as { noteId: string }[]
    expect(savedFile.map((s) => s.noteId)).toEqual([id])
    await bus.publish('UserDeleted', { userId: me.id })
    for (let i = 0; i < 20 && (await db.noteSave.count({ where: { userId: me.id } })); i++) await new Promise((r) => setTimeout(r, 50))
    expect(await db.noteSave.count({ where: { userId: me.id } })).toBe(0)
  })
})

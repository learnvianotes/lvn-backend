import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { NoteImportService } from '@lvn-backend/notes'
import { DataExportService } from '@lvn-backend/users'
import { strToU8, zipSync } from 'fflate'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** ADR-0018: Settings → Data → Import notes — from other apps and from LearnViaNotes exports, safely. */
describe('importing notes', () => {
  let t: TestApp
  let db: PrismaService
  let me: { id: string; token: string }

  const ERRORS = 'userErrors { field message code }'
  type Imp = { id: string; status: string; created: number; notes: { id: string; title: string }[]; skipped: { path: string; reason: string }[]; error: string | null }
  const start = async (token: string, fileId: string) => (await t.gql<{ importNotes: { noteImport: Imp | null; userErrors: { code: string }[] } }>(`mutation ($input: ImportNotesInput!) { importNotes(input: $input) { noteImport { id status } ${ERRORS} } }`, { input: { fileId } }, token)).data!.importNotes
  const latest = async (token: string) => (await t.gql<{ noteImports: Imp[] }>('{ noteImports { id status created notes { id title } skipped { path reason } error } }', {}, token)).data!.noteImports[0]!
  const run = async (token: string, bytes: Uint8Array, mime = 'application/zip', name = 'notes.zip') => {
    const fileId = await upload(t, token, 'IMPORT', mime, bytes, name)
    const started = await start(token, fileId)
    await t.app.get(NoteImportService).run(started.noteImport!.id)
    return latest(token)
  }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const u = await seedUser(t.app, { verified: true })
    me = { id: u.id, token: tokenFor(t.config, u.id) }
  })

  afterAll(() => t.close())

  it('imports an Obsidian vault: folders, front matter, pictures; other files are listed as skipped', async () => {
    const vault = zipSync({
      'Vault/Algorithms/Graphs.md': strToU8('---\ntags: [dsa, graphs]\n---\n# Graph traversal\n\nBFS uses a **queue**.\n\n![[tree.png]]\n\n- [ ] revise\n'),
      'Vault/Algorithms/tree.png': SAMPLES.png,
      'Vault/todo.txt': strToU8('Buy notebooks\n\nRevise heaps'),
      'Vault/.obsidian/app.json': strToU8('{}'),
      'Vault/setup.exe': strToU8('MZ'),
    })
    const imp = await run(me.token, vault)
    expect(imp).toMatchObject({ status: 'DONE', created: 2, error: null })
    expect(imp.skipped).toEqual([{ path: 'Vault/setup.exe', reason: 'not Markdown, text or a file notes accept' }])
    const graphs = await db.note.findFirstOrThrow({ where: { ownerId: me.id, title: 'Graph traversal' }, include: { cards: { orderBy: { position: 'asc' } }, folder: true, tags: { include: { tag: true } }, attachments: true } })
    expect(graphs).toMatchObject({ visibility: 'PRIVATE', kind: 'NOTE', folder: { name: 'Algorithms' } })
    expect(graphs.tags.map((x) => x.tag.name).sort()).toEqual(['dsa', 'graphs'])
    expect(graphs.cards.map((c) => c.type)).toEqual(['text', 'image', 'checklist'])
    expect(graphs.attachments).toHaveLength(1)
    expect(graphs.cards[1]!.content).toEqual({ fileId: graphs.attachments[0]!.fileId, alt: '' })
    const todo = await db.note.findFirstOrThrow({ where: { ownerId: me.id, title: 'todo' }, include: { cards: true } })
    expect(todo.folderId).toBeNull()
    expect(JSON.stringify(todo.cards[0]!.content)).toContain('Revise heaps')
  })

  it('asks before importing the same file twice', async () => {
    const file = strToU8('# Same note\n\nOnce is enough.')
    expect(await run(me.token, file, 'text/markdown', 'same.md')).toMatchObject({ status: 'DONE', created: 1 })
    const again = await run(me.token, file, 'text/markdown', 'same.md')
    expect(again.status).toBe('NEEDS_CONFIRMATION')
    await t.gql(`mutation ($input: NoteIdInput!) { confirmNoteImport(input: $input) { noteImport { status } ${ERRORS} } }`, { input: { noteId: again.id } }, me.token)
    await t.app.get(NoteImportService).run(again.id)
    expect(await latest(me.token)).toMatchObject({ id: again.id, status: 'DONE', created: 1 })
    expect(await db.note.count({ where: { ownerId: me.id, title: 'Same note' } })).toBe(2)
  })

  it('brings back a LearnViaNotes export exactly, fork credit included', async () => {
    const author = await seedUser(t.app, { verified: true })
    const reader = await seedUser(t.app, { verified: true })
    const origin = newId()
    const version = newId()
    await db.note.create({ data: { id: origin, ownerId: author.id, title: 'Origin', visibility: 'SHARED' } })
    await db.noteVersion.create({ data: { id: version, noteId: origin, number: 1, kind: 'PUBLISHED', title: 'Origin', createdById: author.id, cards: [] } })
    const copyId = newId()
    const cards = [
      { id: newId(), type: 'quiz' as const, position: 'a0', content: { question: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'BFS uses' }] }] }, choices: [{ id: 'a', content: [{ type: 'text', text: 'a queue' }] }, { id: 'b', content: [{ type: 'text', text: 'a stack' }] }], correct: ['a'], multiple: false } },
      { id: newId(), type: 'flashcard' as const, position: 'a1', content: { front: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'LIFO' }] }] }, back: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'stack' }] }] } } },
    ]
    await db.note.create({ data: { id: copyId, ownerId: reader.id, title: 'My copy', forkedFromNoteId: origin, forkedFromVersionId: version, forkedFromOwnerId: author.id, forkedFromVisibility: 'SHARED', forkedAsRole: 'READER', cards: { create: cards.map(({ id, ...c }) => ({ id, ...c })) } } })

    const exporter = t.app.get(DataExportService)
    const row = await exporter.request(reader.id)
    await exporter.build(row.id)
    const ready = (await exporter.list(reader.id))[0]!
    const archive = new Uint8Array(await (await fetch(ready.downloadUrl!)).arrayBuffer())
    const imp = await run(tokenFor(t.config, reader.id), archive, 'application/zip', 'learnvianotes-export.zip')
    expect(imp).toMatchObject({ status: 'DONE', created: 1 })
    const back = await db.note.findUniqueOrThrow({ where: { id: imp.notes[0]!.id }, include: { cards: { orderBy: { position: 'asc' } } } })
    expect(back).toMatchObject({ title: 'My copy', visibility: 'PRIVATE', forkedFromOwnerId: author.id, forkedFromNoteId: origin, forkedFromVisibility: 'SHARED' })
    expect(back.cards.map((c) => c.content)).toEqual(cards.map((c) => c.content))
  })

  it('refuses archives with unsafe paths or packed too tightly, and uploads that are not yours', async () => {
    expect(await run(me.token, zipSync({ '../escape.md': strToU8('# x') }))).toMatchObject({ status: 'FAILED', error: 'The archive has an unsafe path: ../escape.md' })
    expect(await run(me.token, zipSync({ 'bomb.md': new Uint8Array(5 * 1024 ** 2) }, { level: 9 }))).toMatchObject({ status: 'FAILED', error: 'The archive is packed suspiciously tightly.' })
    const other = await seedUser(t.app, { verified: true })
    const theirs = await upload(t, tokenFor(t.config, other.id), 'IMPORT', 'text/markdown', strToU8('# Theirs'), 'theirs.md')
    // (A fresh account: this one has used its five imports for today.)
    const fresh = tokenFor(t.config, (await seedUser(t.app, { verified: true })).id)
    expect((await start(fresh, theirs)).userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect((await start(me.token, theirs)).userErrors[0]).toMatchObject({ code: 'RATE_LIMITED' })
  })
})

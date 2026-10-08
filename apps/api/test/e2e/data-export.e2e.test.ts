import { createHash } from 'node:crypto'
import { MailService } from '@lvn-backend/communication'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { DataExportService } from '@lvn-backend/users'
import { strFromU8, unzipSync } from 'fflate'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** ADR-0018: Settings → Data → Export — everything about a person in one archive, once a day, kept 7 days. */
describe('data export', () => {
  let t: TestApp
  let db: PrismaService
  let me: { id: string; token: string }

  const ERRORS = 'userErrors { field message code }'
  const request = (token: string) => t.gql<{ requestDataExport: { export: { id: string; status: string } | null; userErrors: { message: string }[] } }>(`mutation { requestDataExport { export { id status } ${ERRORS} } }`, {}, token)
  const list = async (token: string) => (await t.gql<{ myDataExports: { id: string; status: string; downloadUrl: string | null; sizeBytes: number | null; expiresAt: string | null }[] }>('{ myDataExports { id status downloadUrl sizeBytes expiresAt } }', {}, token)).data!.myDataExports
  const doc = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s, marks: [{ type: 'bold' }] }] }] } })

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const u = await seedUser(t.app, { verified: true, displayName: 'Asha Rao' })
    me = { id: u.id, token: tokenFor(t.config, u.id) }
  })

  afterAll(() => t.close())

  it('packs notes as Markdown and JSON with their files, and the account without secrets', async () => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title: 'Heaps', cards: [{ id: newId(), type: 'heading', position: 'a0', content: { level: 1, content: [{ type: 'text', text: 'Binary heap' }] } }, { id: newId(), type: 'text', position: 'a1', content: doc('Smallest on top') }], tagNames: ['dsa'] } }, me.token)
    const noteId = created.data!.createNote.note.id
    const fileId = await upload(t, me.token, 'ATTACHMENT', 'image/png', SAMPLES.png, 'heap.png', noteId)
    await t.gql(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { ${ERRORS} } }`, { input: { noteId, ops: [{ kind: 'UPSERT', id: newId(), type: 'image', position: 'a2', content: { fileId, alt: 'A heap' } }] } }, me.token)
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId } }, me.token)

    const sent = jest.spyOn(t.app.get(MailService), 'send').mockResolvedValue()
    const asked = (await request(me.token)).data!.requestDataExport
    expect(asked.export).toMatchObject({ status: 'PENDING' })
    // One a day.
    expect((await request(me.token)).data!.requestDataExport.userErrors[0]!.message).toBe('Your export is being prepared.')

    // apps/worker runs this from the users.export queue.
    await t.app.get(DataExportService).build(asked.export!.id)
    const [ready] = await list(me.token)
    expect(ready).toMatchObject({ id: asked.export!.id, status: 'READY' })
    expect(sent).toHaveBeenCalledWith(expect.any(String), 'dataExportReady', expect.objectContaining({ displayName: 'Asha Rao', link: expect.stringMatching(/\/profile#your-data$/) }))

    const zip = unzipSync(new Uint8Array(await (await fetch(ready!.downloadUrl!)).arrayBuffer()))
    const paths = Object.keys(zip)
    const dir = `notes/NOTE/heaps-${noteId.slice(-8)}`
    expect(paths).toEqual(expect.arrayContaining(['README.html', 'manifest.json', `${dir}/index.md`, `${dir}/note.json`, `${dir}/media/${fileId.slice(-8)}-heap.png`, 'data/users/account.json', 'data/core/study-progress.json']))
    const md = strFromU8(zip[`${dir}/index.md`]!)
    expect(md).toMatch(/^---\ntitle: Heaps\nid: [0-9a-f-]+\nkind: NOTE\nvisibility: PRIVATE\ntags:\n {2}- dsa\n/)
    expect(md).toContain('# Heaps\n\n## Binary heap\n\n**Smallest on top**\n\n![A heap](media/')
    const note = JSON.parse(strFromU8(zip[`${dir}/note.json`]!)) as { format: string; draft: unknown[]; versions: { number: number; kind: string }[] }
    expect(note).toMatchObject({ format: 'lvn-note/1', versions: [{ number: 1, kind: 'PUBLISHED' }] })
    expect(note.draft).toHaveLength(3)
    expect(zip[`${dir}/media/${fileId.slice(-8)}-heap.png`]).toEqual(SAMPLES.png)
    const account = JSON.parse(strFromU8(zip['data/users/account.json']!)) as Record<string, unknown>
    expect(account).toMatchObject({ id: me.id, displayName: 'Asha Rao' })
    expect(account).not.toHaveProperty('passwordHash')
    // The manifest's checksums match the files.
    const manifest = JSON.parse(strFromU8(zip['manifest.json']!)) as { counts: Record<string, number>; files: { path: string; sha256: string }[] }
    expect(manifest.counts).toMatchObject({ notes: 1, versions: 1, media: 1 })
    for (const f of manifest.files) expect(createHash('sha256').update(zip[f.path]!).digest('hex')).toBe(f.sha256)
  })

  it('deletes archives after 7 days', async () => {
    const [ready] = await list(me.token)
    await t.app.get(DataExportService).expire(new Date(Date.now() + 8 * 86_400_000))
    const [after] = await list(me.token)
    expect(after).toMatchObject({ id: ready!.id, status: 'EXPIRED', downloadUrl: null })
    expect((await db.fileObject.findFirstOrThrow({ where: { parentType: 'DATA_EXPORT', parentId: ready!.id } })).status).toBe('DELETED')
  })
})

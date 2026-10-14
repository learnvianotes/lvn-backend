import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { NoteImportService } from '@lvn-backend/notes'
import { DataExportService } from '@lvn-backend/users'
import { strFromU8, unzipSync } from 'fflate'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/** ADR-0040: the PDF reader — cards that remember their page, highlights, reading links and studying a PDF. */
describe('the PDF reader', () => {
  let t: TestApp
  let db: PrismaService
  type Person = { id: string; token: string }
  let owner: Person
  let editor: Person
  let viewer: Person
  let stranger: Person

  const ERRORS = 'userErrors { field message code }'
  type UserErrors = { field: string[] | null; message: string; code: string }[]
  type Highlight = { id: string; fileId: string; page: number; kind: string; color: string; rects: number[][]; quote: string | null; comment: string | null; cardId: string | null; createdBy: { id: string } }
  const HIGHLIGHT = 'id fileId page kind color rects quote comment cardId createdBy { id }'
  const quote = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })

  const person = async (name: string): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, displayName: name })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const createNote = async (token: string, title: string, cards: object[] = []) =>
    (await t.gql<{ createNote: { note: { id: string } | null; userErrors: UserErrors } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title, cards } }, token)).data!.createNote
  const save = async (token: string, noteId: string, ops: object[]) =>
    (await t.gql<{ updateNoteDraft: { results: { id: string; status: string }[]; userErrors: UserErrors } }>(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { id status } ${ERRORS} } }`, { input: { noteId, ops } }, token)).data!.updateNoteDraft
  const publish = (token: string, noteId: string) => t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId } }, token)
  const add = async (token: string, input: object) => {
    const res = await t.gql<{ addPdfHighlight: { highlight: Highlight | null; userErrors: UserErrors } }>(`mutation ($input: AddPdfHighlightInput!) { addPdfHighlight(input: $input) { highlight { ${HIGHLIGHT} } ${ERRORS} } }`, { input }, token)
    // FORBIDDEN is an error of the request, not a userError (withUserErrors).
    if (res.errors) return { highlight: null, userErrors: [], error: res.errors[0]!.extensions.code }
    return res.data!.addPdfHighlight
  }
  const highlights = async (token: string, noteId: string, fileId?: string) =>
    (await t.gql<{ note: { highlights: Highlight[] } | null }>(`query ($id: UUID!, $fileId: UUID) { note(id: $id) { highlights(fileId: $fileId) { ${HIGHLIGHT} } } }`, { id: noteId, fileId }, token)).data!.note?.highlights
  const noteFile = async (token: string | undefined, noteId: string, fileId: string) =>
    (await t.gql<{ noteFile: { id: string; url: string; mimeType: string; fileName: string; expiresAt: string } | null }>('query ($noteId: UUID!, $fileId: UUID!) { noteFile(noteId: $noteId, fileId: $fileId) { id url mimeType fileName expiresAt } }', { noteId, fileId }, token)).data!.noteFile
  const study = async (token: string, noteId: string, fileId: string) => {
    const res = await t.gql<{ studyPdf: { note: { id: string; title: string; visibility: string; forkedFrom: { author: { id: string } } | null } | null; userErrors: UserErrors } }>(
      `mutation ($input: StudyPdfInput!) { studyPdf(input: $input) { note { id title visibility forkedFrom { author { id } } } ${ERRORS} } }`,
      { input: { noteId, fileId } },
      token,
    )
    if (res.errors) return { note: null, userErrors: [], error: res.errors[0]!.extensions.code }
    return res.data!.studyPdf
  }

  /** A note of the owner's with a PDF in a file card; `pdf` is the file. */
  const pdfNote = async (title = 'Cell biology') => {
    const { note } = await createNote(owner.token, title)
    const pdf = await upload(t, owner.token, 'ATTACHMENT', 'application/pdf', SAMPLES.pdf, 'Cell_biology chapter 3.pdf', note!.id)
    const fileCard = newId()
    expect((await save(owner.token, note!.id, [{ kind: 'UPSERT', id: fileCard, type: 'file', position: 'a0', content: { fileId: pdf } }])).userErrors).toEqual([])
    return { noteId: note!.id, pdf, fileCard }
  }
  const share = (noteId: string, userId: string, role: 'EDITOR' | 'VIEWER') => db.noteShare.create({ data: { noteId, userId, role, createdById: owner.id } })

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    owner = await person('Asha Rao')
    editor = await person('Ravi Kumar')
    viewer = await person('Meena Iyer')
    stranger = await person('Arjun Das')
  })
  afterAll(() => t.close())

  describe('cards made from a PDF', () => {
    it('keep their page and passage, and only point into PDFs of their own note', async () => {
      const { noteId, pdf } = await pdfNote()
      const card = newId()
      const anchor = { fileId: pdf, page: 3, rects: [[0.1, 0.2, 0.8, 0.24]], quote: 'Mitochondria make ATP' }
      expect((await save(owner.token, noteId, [{ kind: 'UPSERT', id: card, type: 'quote', position: 'a1', content: { ...quote('Mitochondria make ATP'), anchor } }])).results).toEqual([{ id: card, status: 'APPLIED' }])
      expect((await db.card.findUniqueOrThrow({ where: { id: card } })).content).toMatchObject({ anchor })

      // A picture is not a PDF; a PDF of another note is not attached here; a new note has no files yet.
      const png = await upload(t, owner.token, 'ATTACHMENT', 'image/png', SAMPLES.png, 'cell.png', noteId)
      const notPdf = await save(owner.token, noteId, [{ kind: 'UPSERT', id: newId(), type: 'text', position: 'a2', content: { ...quote('x'), anchor: { fileId: png, page: 1 } } }])
      expect(notPdf.userErrors[0]).toMatchObject({ code: 'VALIDATION', message: 'This file cannot be used in an anchor.', field: ['input', 'ops', '0', 'content', 'anchor', 'fileId'] })
      const other = await pdfNote('Other')
      const elsewhere = await save(owner.token, noteId, [{ kind: 'UPSERT', id: newId(), type: 'text', position: 'a2', content: { ...quote('x'), anchor: { fileId: other.pdf, page: 1 } } }])
      expect(elsewhere.userErrors[0]).toMatchObject({ code: 'VALIDATION', message: 'Upload the file to this note first.' })
      const fresh = await createNote(owner.token, 'New', [{ id: newId(), type: 'text', position: 'a0', content: { ...quote('x'), anchor: { fileId: pdf, page: 1 } } }])
      expect(fresh.userErrors[0]).toMatchObject({ code: 'VALIDATION', message: 'Add cards from a PDF once the note exists.' })
      const offPage = await save(owner.token, noteId, [{ kind: 'UPSERT', id: newId(), type: 'text', position: 'a2', content: { ...quote('x'), anchor: { fileId: pdf, page: 1, rects: [[0, 0, 2, 1]] } } }])
      expect(offPage.userErrors[0]).toMatchObject({ code: 'VALIDATION' })
    })

    it('take their PDF along into copies, even when no file card shows it', async () => {
      const { noteId, pdf, fileCard } = await pdfNote('Photosynthesis')
      await save(owner.token, noteId, [
        { kind: 'UPSERT', id: newId(), type: 'quote', position: 'a1', content: { ...quote('Light reactions'), anchor: { fileId: pdf, page: 2 } } },
        { kind: 'DELETE', id: fileCard, baseRevision: 1 },
      ])
      await publish(owner.token, noteId)
      await db.note.update({ where: { id: noteId }, data: { visibility: 'PUBLIC' } })
      const fork = await t.gql<{ forkNote: { note: { id: string } | null } }>('mutation ($input: NoteIdInput!) { forkNote(input: $input) { note { id } } }', { input: { noteId } }, stranger.token)
      const copy = fork.data!.forkNote.note!.id
      expect(await db.noteAttachment.findUnique({ where: { noteId_fileId: { noteId: copy, fileId: pdf } } })).not.toBeNull()
      expect(await noteFile(stranger.token, copy, pdf)).toMatchObject({ id: pdf })
    })
  })

  describe('highlights', () => {
    it('are made, coloured, commented and removed by the owner and editors; readers never see them', async () => {
      const { noteId, pdf } = await pdfNote('Genetics')
      const passage = await add(owner.token, { noteId, fileId: pdf, page: 4, kind: 'TEXT', rects: [[0.1, 0.3, 0.9, 0.33], [0.1, 0.33, 0.5, 0.36]], quote: '  DNA is a double helix ', comment: 'exam!' })
      expect(passage).toMatchObject({ userErrors: [], highlight: { page: 4, kind: 'TEXT', color: 'YELLOW', quote: 'DNA is a double helix', comment: 'exam!', createdBy: { id: owner.id } } })
      const card = newId()
      await save(owner.token, noteId, [{ kind: 'UPSERT', id: card, type: 'image', position: 'a1', content: { fileId: await upload(t, owner.token, 'ATTACHMENT', 'image/png', SAMPLES.png, 'figure.png', noteId), alt: 'Figure 2', anchor: { fileId: pdf, page: 1, rects: [[0.2, 0.2, 0.6, 0.5]] } } }])
      const area = await add(owner.token, { noteId, fileId: pdf, page: 1, kind: 'AREA', color: 'GREEN', rects: [[0.2, 0.2, 0.6, 0.5]], cardId: card })
      expect(area.highlight).toMatchObject({ kind: 'AREA', color: 'GREEN', cardId: card, quote: null })

      // Page order, and one PDF at a time.
      expect((await highlights(owner.token, noteId))!.map((h) => h.page)).toEqual([1, 4])
      expect(await highlights(owner.token, noteId, newId())).toEqual([])

      const updated = await t.gql<{ updatePdfHighlight: { highlight: Highlight | null } }>(`mutation ($input: UpdatePdfHighlightInput!) { updatePdfHighlight(input: $input) { highlight { ${HIGHLIGHT} } } }`, { input: { highlightId: passage.highlight!.id, color: 'PINK', comment: '' } }, owner.token)
      expect(updated.data!.updatePdfHighlight.highlight).toMatchObject({ color: 'PINK', comment: null })

      await share(noteId, editor.id, 'EDITOR')
      await share(noteId, viewer.id, 'VIEWER')
      await db.note.update({ where: { id: noteId }, data: { visibility: 'SHARED' } })
      await publish(owner.token, noteId)
      expect(await add(editor.token, { noteId, fileId: pdf, page: 2, kind: 'TEXT', rects: [[0, 0, 0.5, 0.1]], quote: 'Genes' })).toMatchObject({ userErrors: [], highlight: { createdBy: { id: editor.id } } })
      expect(await highlights(editor.token, noteId)).toHaveLength(3)
      expect(await highlights(viewer.token, noteId)).toEqual([])
      expect(await add(viewer.token, { noteId, fileId: pdf, page: 2, kind: 'TEXT', rects: [[0, 0, 0.5, 0.1]] })).toMatchObject({ error: 'FORBIDDEN' })
      expect((await add(stranger.token, { noteId, fileId: pdf, page: 2, kind: 'TEXT', rects: [[0, 0, 0.5, 0.1]] })).userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
      const removeAs = (token: string) => t.gql<{ removePdfHighlight: { ok: boolean; userErrors: UserErrors } }>(`mutation ($input: PdfHighlightIdInput!) { removePdfHighlight(input: $input) { ok ${ERRORS} } }`, { input: { highlightId: passage.highlight!.id } }, token)
      expect((await removeAs(viewer.token)).data!.removePdfHighlight).toMatchObject({ ok: false, userErrors: [{ code: 'NOT_FOUND' }] })
      expect((await removeAs(editor.token)).data!.removePdfHighlight).toEqual({ ok: true, userErrors: [] })
      expect(await highlights(owner.token, noteId)).toHaveLength(2)
    })

    it('are checked: on a PDF of the note, inside the page, one rectangle for an area', async () => {
      const { noteId, pdf } = await pdfNote('Checks')
      const png = await upload(t, owner.token, 'ATTACHMENT', 'image/png', SAMPLES.png, 'x.png', noteId)
      const base = { noteId, fileId: pdf, page: 1, kind: 'TEXT', rects: [[0, 0, 0.5, 0.1]] }
      const refused = async (input: object) => (await add(owner.token, { ...base, ...input })).userErrors[0]
      expect(await refused({ fileId: png })).toMatchObject({ message: 'Only PDFs can be highlighted.', field: ['input', 'fileId'] })
      expect(await refused({ fileId: newId() })).toMatchObject({ message: 'This PDF is not in the note.' })
      expect(await refused({ page: 0 })).toMatchObject({ field: ['input', 'page'] })
      expect(await refused({ rects: [] })).toMatchObject({ message: 'Mark at least one rectangle.' })
      expect(await refused({ rects: [[0.5, 0.5, 0.4, 0.6]] })).toMatchObject({ field: ['input', 'rects'] })
      expect(await refused({ kind: 'AREA', rects: [[0, 0, 0.1, 0.1], [0.2, 0.2, 0.3, 0.3]] })).toMatchObject({ message: 'An area is one rectangle.' })
      expect(await refused({ comment: 'x'.repeat(2001) })).toMatchObject({ field: ['input', 'comment'] })
      expect(await refused({ cardId: newId() })).toMatchObject({ message: 'That card is not in this note.' })
    })

    it('go when the note is deleted for good', async () => {
      const { noteId, pdf } = await pdfNote('Gone')
      await add(owner.token, { noteId, fileId: pdf, page: 1, kind: 'TEXT', rects: [[0, 0, 0.5, 0.1]] })
      await t.gql('mutation ($input: NoteIdInput!) { deleteNote(input: $input) { note { id } } }', { input: { noteId } }, owner.token)
      await t.gql('mutation ($input: NoteIdInput!) { deleteNoteForever(input: $input) { ok } }', { input: { noteId } }, owner.token)
      expect(await db.noteHighlight.count({ where: { noteId } })).toBe(0)
    })
  })

  describe('reading links', () => {
    it('open the PDF for 15 minutes, by ranges, for people who may see it; the reader asks again after (ADR-0090)', async () => {
      const { noteId, pdf } = await pdfNote('Reading')
      const draftOnly = await upload(t, owner.token, 'ATTACHMENT', 'application/pdf', SAMPLES.pdf, 'later.pdf', noteId)
      const link = await noteFile(owner.token, noteId, pdf)
      expect(link).toMatchObject({ id: pdf, mimeType: 'application/pdf', fileName: 'Cell_biology chapter 3.pdf' })
      const lives = new Date(link!.expiresAt).getTime() - Date.now()
      expect(lives).toBeGreaterThan(14 * 60_000)
      expect(lives).toBeLessThanOrEqual(15 * 60_000)
      const part = await fetch(link!.url, { headers: { Range: 'bytes=0-4' } })
      expect(part.status).toBe(206)
      expect(await part.text()).toBe('%PDF-')

      // Readers see the files of the published version only; strangers and anonymous visitors nothing.
      await share(noteId, viewer.id, 'VIEWER')
      await db.note.update({ where: { id: noteId }, data: { visibility: 'SHARED' } })
      expect(await noteFile(viewer.token, noteId, pdf)).toBeNull()
      await publish(owner.token, noteId)
      expect(await noteFile(viewer.token, noteId, pdf)).toMatchObject({ id: pdf })
      expect(await noteFile(viewer.token, noteId, draftOnly)).toBeNull()
      expect(await noteFile(owner.token, noteId, draftOnly)).toMatchObject({ id: draftOnly })
      expect(await noteFile(stranger.token, noteId, pdf)).toBeNull()
      expect(await noteFile(undefined, noteId, pdf)).toBeNull()
    })
  })

  describe('studying a PDF', () => {
    it('makes a private note of my own with the PDF, crediting the note it came from', async () => {
      const { noteId, pdf } = await pdfNote('Ecology')
      await publish(owner.token, noteId)
      await db.note.update({ where: { id: noteId }, data: { visibility: 'PUBLIC' } })
      const mine = await study(stranger.token, noteId, pdf)
      expect(mine).toMatchObject({ userErrors: [], note: { title: 'Cell biology chapter 3', visibility: 'PRIVATE', forkedFrom: { author: { id: owner.id } } } })
      const cards = await db.card.findMany({ where: { noteId: mine.note!.id } })
      expect(cards.map((c) => [c.type, c.content])).toEqual([['file', { fileId: pdf }]])
      expect(await add(stranger.token, { noteId: mine.note!.id, fileId: pdf, page: 1, kind: 'TEXT', rects: [[0, 0, 0.5, 0.1]] })).toMatchObject({ userErrors: [] })

      // My own PDF: no credit line. Copies turned off: no.
      expect((await study(owner.token, noteId, pdf)).note).toMatchObject({ forkedFrom: null })
      await db.note.update({ where: { id: noteId }, data: { forkingEnabled: false } })
      expect(await study(viewer.token, noteId, pdf)).toMatchObject({ error: 'FORBIDDEN' })
      await db.note.update({ where: { id: noteId }, data: { forkingEnabled: true } })
      expect((await study(viewer.token, noteId, newId())).userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
      const priv = await pdfNote('Private')
      expect((await study(stranger.token, priv.noteId, priv.pdf)).userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('export and import', () => {
    it('carry anchors and highlights there and back', async () => {
      const me = await person('Kiran Rao')
      const { note } = await createNote(me.token, 'Optics')
      const pdf = await upload(t, me.token, 'ATTACHMENT', 'application/pdf', SAMPLES.pdf, 'optics.pdf', note!.id)
      const card = newId()
      await save(me.token, note!.id, [
        { kind: 'UPSERT', id: newId(), type: 'file', position: 'a0', content: { fileId: pdf } },
        { kind: 'UPSERT', id: card, type: 'quote', position: 'a1', content: { ...quote('Light bends'), anchor: { fileId: pdf, page: 7, rects: [[0.1, 0.1, 0.5, 0.15]], quote: 'Light bends' } } },
      ])
      await add(me.token, { noteId: note!.id, fileId: pdf, page: 7, kind: 'TEXT', color: 'BLUE', rects: [[0.1, 0.1, 0.5, 0.15]], quote: 'Light bends', comment: 'Snell', cardId: card })

      const exporter = t.app.get(DataExportService)
      const row = await exporter.request(me.id)
      await exporter.build(row.id)
      const ready = (await exporter.list(me.id))[0]!
      const archive = new Uint8Array(await (await fetch(ready.downloadUrl!)).arrayBuffer())
      const zip = unzipSync(archive)
      const dir = `notes/NOTE/optics-${note!.id.slice(-8)}`
      const md = strFromU8(zip[`${dir}/index.md`]!)
      expect(md).toContain(`> Light bends\n\n_From page 7 of [optics.pdf](media/${pdf.slice(-8)}-optics.pdf#page=7)_`)
      expect(md).toContain(`## Highlights\n\n### optics.pdf\n\n- [page 7](media/${pdf.slice(-8)}-optics.pdf#page=7), blue: “Light bends” — Snell`)
      const json = JSON.parse(strFromU8(zip[`${dir}/note.json`]!)) as { highlights: { media: string; page: number; cardId: string }[] }
      expect(json.highlights).toEqual([expect.objectContaining({ media: `media/${pdf.slice(-8)}-optics.pdf`, page: 7, cardId: card })])

      // Back in, as a new note: one stored PDF that the file card, the anchor and the highlight all use.
      const fileId = await upload(t, me.token, 'IMPORT', 'application/zip', archive, 'export.zip')
      const started = await t.gql<{ importNotes: { noteImport: { id: string } } }>('mutation ($input: ImportNotesInput!) { importNotes(input: $input) { noteImport { id } } }', { input: { fileId } }, me.token)
      await t.app.get(NoteImportService).run(started.data!.importNotes.noteImport.id)
      const copy = await db.note.findFirstOrThrow({ where: { ownerId: me.id, title: 'Optics', id: { not: note!.id } }, include: { attachments: { include: { file: true, highlights: true } }, cards: { orderBy: { position: 'asc' } } } })
      expect(copy.attachments).toHaveLength(1)
      const newPdf = copy.attachments[0]!
      expect(newPdf.file.originalFileName).toBe('optics.pdf')
      expect(copy.cards.map((c) => c.content)).toEqual([{ fileId: newPdf.fileId }, expect.objectContaining({ anchor: { fileId: newPdf.fileId, page: 7, rects: [[0.1, 0.1, 0.5, 0.15]], quote: 'Light bends' } })])
      expect(newPdf.highlights).toEqual([expect.objectContaining({ page: 7, color: 'BLUE', comment: 'Snell', quote: 'Light bends', cardId: copy.cards[1]!.id, createdById: me.id })])
    })
  })
})

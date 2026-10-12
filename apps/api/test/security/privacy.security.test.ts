import { getNamedType, isObjectType, type GraphQLSchema } from 'graphql'
import { LIVE_SDL, NotificationService } from '@lvn-backend/communication'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { PdfConversionService, SearchIndex } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { liveUrl, openLive } from '../support/live'
import { seedActors, type Actors } from './support/actors'
import { publicSchema } from './support/fuzz'

/**
 * §17.1: B cannot read A's private data through any channel: account data (Phase 1); notes, their files, PDF
 * highlights and conversions, public pages, copies, search and exports (Phase 2); notifications and live updates
 * (Phase 3); groups and classrooms (Phase 3). Comments, recommendations and RAG arrive later; their assertions are todos
 * until then.
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
    describe('A’s private note with a PDF, a highlight and a published version', () => {
      const WORD = `zygomorphic${Date.now()}`
      let noteId = ''
      let pdf = ''
      let highlight = ''
      beforeAll(async () => {
        // A must be verified to publish; the note stays PRIVATE (published only for A and their shares).
        await t.app.get(PrismaService).user.update({ where: { id: actors.a.id }, data: { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } })
        const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }`, { input: { title: `Private ${WORD}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `secret ${WORD}` }] }] } } }] } }, actors.a.token)
        noteId = created.data!.createNote.note.id
        pdf = await upload(t, actors.a.token, 'ATTACHMENT', 'application/pdf', SAMPLES.pdf, 'private.pdf', noteId)
        await t.gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }', { input: { noteId, ops: [{ kind: 'UPSERT', id: newId(), type: 'file', position: 'a1', content: { fileId: pdf } }] } }, actors.a.token)
        await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, actors.a.token)
        const added = await t.gql<{ addPdfHighlight: { highlight: { id: string } } }>('mutation ($input: AddPdfHighlightInput!) { addPdfHighlight(input: $input) { highlight { id } } }', { input: { noteId, fileId: pdf, page: 1, kind: 'TEXT', rects: [[0, 0, 0.5, 0.1]], quote: 'secret' } }, actors.a.token)
        highlight = added.data!.addPdfHighlight.highlight.id
        await t.app.get(SearchIndex).indexNote(noteId)
      })

      it('B cannot read it through the public-note pages, sitemaps or a file URL (P2c, P2d)', async () => {
        for (const token of [actors.b.token, undefined]) {
          const listed = await t.gql<{ publicNotes: { edges: { node: { id: string } }[] } }>('{ publicNotes(first: 100) { edges { node { id } } } }', {}, token)
          expect(listed.data!.publicNotes.edges.map((e) => e.node.id)).not.toContain(noteId)
          const file = await t.gql<{ noteFile: unknown }>('query ($n: UUID!, $f: UUID!) { noteFile(noteId: $n, fileId: $f) { url } }', { n: noteId, f: pdf }, token)
          expect(file.data!.noteFile).toBeNull()
        }
      })

      it('B cannot copy it, study or convert its PDF, or see or touch its highlights (P2c, P2h)', async () => {
        const missing = '01920000-0000-7000-8000-0000000000fe'
        const attempt = async (id: string) => {
          const fork = await t.gql<{ forkNote: { note: unknown; userErrors: { code: string }[] } }>('mutation ($id: UUID!) { forkNote(input: { noteId: $id }) { note { id } userErrors { code } } }', { id }, actors.b.token)
          const study = await t.gql<{ studyPdf: { note: unknown; userErrors: { code: string }[] } }>('mutation ($n: UUID!, $f: UUID!) { studyPdf(input: { noteId: $n, fileId: $f }) { note { id } userErrors { code } } }', { n: id, f: pdf }, actors.b.token)
          const convert = await t.gql<{ convertPdfToNote: { conversion: unknown; userErrors: { code: string }[] } }>('mutation ($n: UUID!, $f: UUID!) { convertPdfToNote(input: { noteId: $n, fileId: $f }) { conversion { id } userErrors { code } } }', { n: id, f: pdf }, actors.b.token)
          return [fork.data!.forkNote, study.data!.studyPdf, convert.data!.convertPdfToNote]
        }
        // Exactly like a note that does not exist.
        expect(await attempt(noteId)).toEqual(await attempt(missing))
        expect((await attempt(noteId)).map((p) => p.userErrors[0]?.code)).toEqual(['NOT_FOUND', 'NOT_FOUND', 'NOT_FOUND'])
        const touch = await t.gql<{ updatePdfHighlight: { userErrors: { code: string }[] }; removePdfHighlight: { userErrors: { code: string }[] } }>(
          'mutation ($id: UUID!) { updatePdfHighlight(input: { highlightId: $id, comment: "mine" }) { userErrors { code } } removePdfHighlight(input: { highlightId: $id }) { userErrors { code } } }',
          { id: highlight },
          actors.b.token,
        )
        expect(touch.data!.updatePdfHighlight.userErrors[0]?.code).toBe('NOT_FOUND')
        expect(touch.data!.removePdfHighlight.userErrors[0]?.code).toBe('NOT_FOUND')
        expect(await t.app.get(PrismaService).noteHighlight.count({ where: { id: highlight } })).toBe(1)
      })

      it('B gets no search results that draw on it, and A does', async () => {
        const find = async (token?: string) => (await t.gql<{ search: { notes: { note: { id: string } }[] } }>('query ($q: String!) { search(query: $q) { notes { note { id } } } }', { q: WORD }, token)).data!.search.notes.map((n) => n.note.id)
        expect(await find(actors.a.token)).toContain(noteId)
        expect(await find(actors.b.token)).toEqual([])
        expect(await find()).toEqual([])
      })

      it('B never sees A’s PDF conversions or data exports', async () => {
        const conversions = t.app.get(PdfConversionService)
        const asked = await conversions.request(actors.a.id, noteId, pdf)
        const seen = await t.gql<{ pdfConversion: unknown }>('query ($id: UUID!) { pdfConversion(id: $id) { id } }', { id: asked.conversion.id }, actors.b.token)
        expect(seen.data!.pdfConversion).toBeNull()
        await conversions.failed({ conversionId: asked.conversion.id, error: 'test' })
        const exports = await t.gql<{ myDataExports: { id: string }[] }>('{ myDataExports { id } }', {}, actors.b.token)
        expect(exports.data!.myDataExports).toEqual([])
      })
    })

    it('a note made private leaves public search at once (unpublishing)', async () => {
      const db = t.app.get(PrismaService)
      await db.user.update({ where: { id: actors.a.id }, data: { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } })
      const word = `quokka${Date.now()}`
      const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }`, { input: { title: `Public ${word}` } }, actors.a.token)
      const id = created.data!.createNote.note.id
      await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, actors.a.token)
      await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PUBLIC' } }, actors.a.token)
      await t.app.get(SearchIndex).indexNote(id)
      const find = async () => (await t.gql<{ search: { notes: { note: { id: string } }[] } }>('query ($q: String!) { search(query: $q) { notes { note { id } } } }', { q: word }, actors.b.token)).data!.search.notes.map((n) => n.note.id)
      expect(await find()).toEqual([id])
      await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PRIVATE' } }, actors.a.token)
      // No reindex needed: search filters by who may read, at query time.
      expect(await find()).toEqual([])
    })

    it.todo('B cannot comment on A’s private note (comments arrive with groups, Phase 3)')
    it.todo('B gets no recommendations or Ask AI answers that draw on A’s private notes (Phase 5)')
    it.todo('unpublishing removes a note from recommendations and RAG within 60 seconds (Phase 5)')
    it('subscriptions never deliver A’s events to B, and cannot ask for anyone else’s (ADR-0042)', async () => {
      // The live subscription takes no arguments: whose events a socket gets comes only from its token.
      expect(LIVE_SDL).toMatch(/type Subscription \{\s*live: LiveEvent!\s*\}/)
      const url = await liveUrl(t)
      const bSocket = await openLive(url, actors.b.token)
      const aSocket = await openLive(url, actors.a.token)
      const id = (await t.app.get(NotificationService).notify({ userId: actors.a.id, category: 'SHARE', path: '/notes/x', actorId: actors.teacher.id }))!
      expect(await aSocket.next()).toMatchObject({ id })
      await new Promise((r) => setTimeout(r, 300))
      expect(bSocket.events).toEqual([])
      // Nor through the API: B neither sees nor marks A's notification.
      const bList = await t.gql<{ notifications: { edges: unknown[] } }>('{ notifications { edges { node { id } } } }', {}, actors.b.token)
      expect(bList.data!.notifications.edges).toEqual([])
      await t.gql('mutation ($ids: [UUID!]) { markNotificationsRead(input: { ids: $ids }) { unreadCount } }', { ids: [id] }, actors.b.token)
      expect((await t.app.get(PrismaService).notification.findUniqueOrThrow({ where: { id } })).readAt).toBeNull()
      await Promise.all([aSocket.close(), bSocket.close()])
    })
  })

  describe('groups and classrooms (Phase 3)', () => {
    it('B, not in Group G, cannot see G’s shared notes or posts through any channel (ADR-0045)', async () => {
      const t1 = actors.teacher
      const g = await t.gql<{ createGroup: { group: { id: string } } }>('mutation { createGroup(input: { name: "Group G", privacy: PRIVATE }) { group { id } } }', {}, t1.token)
      const groupId = g.data!.createGroup.group.id
      const word = `wombat${Date.now()}`
      const noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: `For G ${word}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: word }] }] } } }] } }, t1.token)).data!.createNote.note.id
      await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, t1.token)
      await t.app.get(InProcessEventBus).drain()
      await t.gql('mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { id } } }', { input: { noteId, groupId } }, t1.token)
      await t.gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'members only' }] }] } } }, t1.token)
      await t.app.get(SearchIndex).indexNote(noteId)

      const b = actors.b.token
      const seen = await t.gql<{ group: Record<string, unknown> | null }>('query ($id: UUID!) { group(id: $id) { name members { role } posts { edges { node { id } } } joinRequests { id } sharedNotes { edges { node { id } } } } }', { id: groupId }, b)
      expect(seen.data!.group).toEqual({ name: 'Group G', members: null, posts: null, joinRequests: null, sharedNotes: null })
      expect((await t.gql<{ note: unknown }>('query ($id: UUID!) { note(id: $id) { id } }', { id: noteId }, b)).data!.note).toBeNull()
      expect((await t.gql<{ sharedWithMe: { edges: unknown[] } }>('{ sharedWithMe { edges { node { id } } } }', {}, b)).data!.sharedWithMe.edges).toEqual([])
      expect((await t.gql<{ search: { notes: unknown[] } }>('query ($q: String!) { search(query: $q) { notes { note { id } } } }', { q: word }, b)).data!.search.notes).toEqual([])
      expect((await t.gql<{ syncPull: { notes: { note: { id: string } }[] } }>('{ syncPull(first: 100) { notes { note { id } } } }', {}, b)).data!.syncPull.notes.map((n) => n.note.id)).not.toContain(noteId)
      // Anonymous visitors see nothing at all.
      expect((await t.gql<{ group: unknown }>('query ($id: UUID!) { group(id: $id) { name } }', { id: groupId })).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    })
    it('A, not in Classroom C, cannot see C’s content through any channel (ADR-0046)', async () => {
      const t1 = actors.teacher
      const db = t.app.get(PrismaService)
      const bus = t.app.get(InProcessEventBus)
      const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
      const c = await t.gql<{ createClassroom: { classroom: { id: string; joinCode: string } } }>('mutation { createClassroom(input: { name: "Classroom C" }) { classroom { id joinCode } } }', {}, t1.token)
      const { id: classroomId, joinCode } = c.data!.createClassroom.classroom
      // B joins by accepting T's invite, which needs a verified account; B goes back to unverified afterwards.
      await db.user.update({ where: { id: actors.b.id }, data: { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } })
      try {
        const b = await db.user.findUniqueOrThrow({ where: { id: actors.b.id } })
        await t.gql('mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } } }', { input: { classroomId, person: b.handle } }, t1.token)
        const inviteId = (await db.classroomInvite.findFirstOrThrow({ where: { classroomId, invitedUserId: b.id } })).id
        await t.gql('mutation ($input: AnswerClassroomInviteInput!) { answerClassroomInvite(input: $input) { classroom { id } } }', { input: { inviteId, accept: true } }, actors.b.token)
      } finally {
        await db.user.update({ where: { id: actors.b.id }, data: { verifiedAt: null, verificationMethod: null } })
      }
      const word = `numbat${Date.now()}`
      const noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: `For C ${word}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc(word) } }] } }, t1.token)).data!.createNote.note.id
      await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, t1.token)
      await t.gql('mutation ($input: NoteClassroomInput!) { shareNoteToClassroom(input: $input) { note { id } } }', { input: { noteId, classroomId } }, t1.token)
      await t.gql('mutation ($input: CreateClassroomPostInput!) { createClassroomPost(input: $input) { classroom { id } } }', { input: { classroomId, body: doc('members only') } }, t1.token)
      await bus.drain()
      await t.app.get(SearchIndex).indexNote(noteId)

      const inside = 'name members { role } joinRequests { id } posts { edges { node { id } } } sharedNotes { edges { node { id } } } joinCode'
      // B, a member, reads it all but the staff's parts; the check below is not vacuous.
      const asB = await t.gql<{ classroom: Record<string, unknown> | null }>(`query ($id: UUID!) { classroom(id: $id) { ${inside} } }`, { id: classroomId }, actors.b.token)
      expect(asB.data!.classroom).toMatchObject({ name: 'Classroom C', members: null, joinCode: null, sharedNotes: { edges: [{ node: { id: noteId } }] } })
      expect((await t.gql<{ note: { id: string } | null }>('query ($id: UUID!) { note(id: $id) { id } }', { id: noteId }, actors.b.token)).data!.note).toEqual({ id: noteId })

      const a = actors.a.token
      expect((await t.gql<{ classroom: unknown }>(`query ($id: UUID!) { classroom(id: $id) { ${inside} } }`, { id: classroomId }, a)).data!.classroom).toBeNull()
      expect((await t.gql<{ myClassrooms: { id: string }[] }>('{ myClassrooms { id } }', {}, a)).data!.myClassrooms).toEqual([])
      // The code shows the name and the teacher, by design (ADR-0046), and nothing else: the type has nothing else.
      expect((await t.gql<{ classroomByCode: unknown }>('query ($code: String!) { classroomByCode(code: $code) { id name teacher { id } } }', { code: joinCode }, a)).data!.classroomByCode).toEqual({ id: classroomId, name: 'Classroom C', teacher: { id: t1.id } })
      expect((await t.gql<{ note: unknown }>('query ($id: UUID!) { note(id: $id) { id } }', { id: noteId }, a)).data!.note).toBeNull()
      expect((await t.gql<{ sharedWithMe: { edges: unknown[] } }>('{ sharedWithMe { edges { node { id } } } }', {}, a)).data!.sharedWithMe.edges).toEqual([])
      expect((await t.gql<{ search: { notes: unknown[] } }>('query ($q: String!) { search(query: $q) { notes { note { id } } } }', { q: word }, a)).data!.search.notes).toEqual([])
      expect((await t.gql<{ syncPull: { notes: { note: { id: string } }[] } }>('{ syncPull(first: 100) { notes { note { id } } } }', {}, a)).data!.syncPull.notes.map((n) => n.note.id)).not.toContain(noteId)
      const told = await t.gql<{ notifications: { edges: { node: { category: string } }[] } }>('{ notifications { edges { node { category } } } }', {}, a)
      expect(told.data!.notifications.edges.map((e) => e.node.category)).not.toContain('CLASSROOM_POST')
      // Sharing to C, or posting in it, is refused to A as to anyone outside it.
      const own = (await t.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "A’s" }) { note { id } } }', {}, a)).data!.createNote.note.id
      const shareAsA = await t.gql<{ shareNoteToClassroom: { note: unknown; userErrors: { code: string }[] } }>('mutation ($input: NoteClassroomInput!) { shareNoteToClassroom(input: $input) { note { id } userErrors { code } } }', { input: { noteId: own, classroomId } }, a)
      expect(shareAsA.data!.shareNoteToClassroom).toEqual({ note: null, userErrors: [{ code: 'NOT_FOUND' }] })
      const postAsA = await t.gql<{ createClassroomPost: { classroom: unknown; userErrors: { code: string }[] } }>('mutation ($input: CreateClassroomPostInput!) { createClassroomPost(input: $input) { classroom { id } userErrors { code } } }', { input: { classroomId, body: doc('hi') } }, a)
      expect(postAsA.data!.createClassroomPost).toEqual({ classroom: null, userErrors: [{ code: 'NOT_FOUND' }] })
      expect((await t.gql<{ classroom: unknown }>('query ($id: UUID!) { classroom(id: $id) { name } }', { id: classroomId })).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    })
  })
})

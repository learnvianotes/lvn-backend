import { getNamedType, isObjectType, type GraphQLSchema } from 'graphql'
import { LIVE_SDL, NotificationService } from '@lvn-backend/communication'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { RecommendationsService } from '@lvn-backend/core'
import { PdfConversionService, SearchIndex } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, infra, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { liveUrl, openLive } from '../support/live'
import { seedActors, type Actors } from './support/actors'
import { publicSchema } from './support/fuzz'

/**
 * §17.1: B cannot read A's private data through any channel: account data (Phase 1); notes, their files, PDF
 * highlights and conversions, public pages, copies, search and exports (Phase 2); notifications and live updates
 * (Phase 3); groups and classrooms (Phase 3). Ask AI has its own suite (rag-leakage.security.test.ts, Phase 5);
 * recommendations are read through the read rule (Phase 6, ADR-0071). Search is asked of both providers on the
 * same data (Phase 4, ADR-0055): Postgres and Typesense must give the same answer.
 */
describe('security: privacy', () => {
  let t: TestApp
  let actors: Actors
  let schema: GraphQLSchema

  /** The same database, searched on Typesense (ADR-0055). */
  let ts: TestApp
  /** Note ids `query` finds for `token`, from both providers, which must agree (the outbox drained first). */
  const searched = async (query: string, token?: string) => {
    await ts.app.get(SearchIndex).drainAll()
    const run = async (app: TestApp) => (await app.gql<{ search: { notes: { note: { id: string } }[] } }>('query ($q: String!) { search(query: $q) { notes { note { id } } } }', { q: query }, token)).data!.search.notes.map((n) => n.note.id)
    const [postgres, typesense] = await Promise.all([run(t), run(ts)])
    expect(typesense).toEqual(postgres)
    return postgres
  }

  beforeAll(async () => {
    t = await createTestApp()
    const { url, apiKey } = infra().typesense
    ts = await createTestApp({ SEARCH_PROVIDER: 'typesense', TYPESENSE_URL: url, TYPESENSE_API_KEY: apiKey, TYPESENSE_COLLECTION_PREFIX: `p${Date.now().toString(36)}_` }, { resetDatabase: false })
    await ts.app.get(SearchIndex).ensureCollections()
    actors = await seedActors(t)
    schema = await publicSchema(t)
  })
  afterAll(async () => {
    await ts?.close()
    await t.close()
  })

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
    it('a reader sees the published title, never one A has not published yet (found in P4b)', async () => {
      const db = t.app.get(PrismaService)
      await db.user.update({ where: { id: actors.a.id }, data: { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } })
      const word = `title${Date.now()}`
      const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }`, { input: { title: `Published ${word}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: word }] }] } } }] } }, actors.a.token)
      const id = created.data!.createNote.note.id
      await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, actors.a.token)
      await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PUBLIC' } }, actors.a.token)
      await t.gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { note { id } } }', { input: { noteId: id, title: 'Not ready: rename before Friday' } }, actors.a.token)
      await ts.app.get(SearchIndex).drainAll()
      const title = async (token?: string) => (await t.gql<{ note: { title: string } }>('query ($id: UUID!) { note(id: $id) { title } }', { id }, token)).data!.note.title
      expect(await title(actors.a.token)).toBe('Not ready: rename before Friday')
      expect(await title(actors.b.token)).toBe(`Published ${word}`)
      expect(await title()).toBe(`Published ${word}`)
      const found = await t.gql<{ search: { notes: { note: { title: string } }[] } }>('query ($q: String!) { search(query: $q, scopes: [NOTES]) { notes { note { title } } } }', { q: word }, actors.b.token)
      expect(found.data!.search.notes.map((h) => h.note.title)).toEqual([`Published ${word}`])
      expect(await searched(word, actors.b.token)).toEqual([id])
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
        await ts.app.get(SearchIndex).indexNote(noteId)
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
        expect(await searched(WORD, actors.a.token)).toContain(noteId)
        expect(await searched(WORD, actors.b.token)).toEqual([])
        expect(await searched(WORD)).toEqual([])
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
      expect(await searched(word, actors.b.token)).toEqual([id])
      await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PRIVATE' } }, actors.a.token)
      // Before the index has heard of it: Postgres filters at query time, and every Typesense hit is opened as B.
      const stale = await ts.gql<{ search: { notes: unknown[] } }>('query ($q: String!) { search(query: $q) { notes { note { id } } } }', { q: word }, actors.b.token)
      expect(stale.data!.search.notes).toEqual([])
      expect(await searched(word, actors.b.token)).toEqual([])
    })

    it('B cannot read, comment on or react to A’s private note’s discussion, even after it was public (ADR-0047)', async () => {
      const db = t.app.get(PrismaService)
      const verify = (id: string, on: boolean) => db.user.update({ where: { id }, data: on ? { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } : { verifiedAt: null, verificationMethod: null } })
      await verify(actors.a.id, true)
      // B verified, so every refusal below is the note's read rule, not B's account.
      await verify(actors.b.id, true)
      try {
        const a = actors.a.token
        const b = actors.b.token
        const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
        const id = (await t.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "Diary" }) { note { id } } }', {}, a)).data!.createNote.note.id
        await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, a)
        await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PUBLIC' } }, a)
        const target = { type: 'NOTE', id }
        const add = (token: string, text: string, parentId?: string) => t.gql<{ addComment: { comment: { id: string } | null; userErrors: { code: string }[] } }>('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } userErrors { code } } }', { input: { target, body: doc(text), parentId } }, token)
        const bs = (await add(b, 'Said while it was public')).data!.addComment.comment!.id
        const as = (await add(a, 'Mine')).data!.addComment.comment!.id
        await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PRIVATE' } }, a)

        const code = (res: { data?: unknown; errors?: { extensions: { code: string } }[] }) => res.errors?.[0]?.extensions.code ?? Object.values((res.data ?? {}) as Record<string, { userErrors?: { code: string }[] }>)[0]?.userErrors?.[0]?.code
        expect((await t.gql<{ discussion: unknown }>('query ($target: CommentTargetInput!) { discussion(target: $target) { commentCount } }', { target }, b)).data!.discussion).toBeNull()
        expect((await t.gql<{ note: unknown }>('query ($id: UUID!) { note(id: $id) { discussion { commentCount } } }', { id }, b)).data!.note).toBeNull()
        expect(code(await add(b, 'Still here?'))).toBe('NOT_FOUND')
        expect(code(await add(b, 'Reply', as))).toBe('NOT_FOUND')
        for (const [mutation, input] of [
          ['editComment(input: { commentId: $id, body: { type: "doc", content: [] } })', bs],
          ['deleteComment(input: { commentId: $id })', as],
          ['approveComment(input: { commentId: $id })', as],
        ] as const) {
          expect(code(await t.gql(`mutation ($id: UUID!) { r: ${mutation} { comment { id } userErrors { code } } }`, { id: input }, b))).toBe('NOT_FOUND')
        }
        for (const reaction of [target, { type: 'COMMENT', id: as }, { type: 'COMMENT', id: bs }]) {
          expect(code(await t.gql('mutation ($input: ReactInput!) { react(input: $input) { reactions { viewerReaction } userErrors { code } } }', { input: { target: reaction, kind: 'LIKE' } }, b))).toBe('NOT_FOUND')
        }
        // A still sees the whole discussion of their note.
        expect((await t.gql<{ discussion: { commentCount: number } }>('query ($target: CommentTargetInput!) { discussion(target: $target) { commentCount } }', { target }, a)).data!.discussion.commentCount).toBe(2)
      } finally {
        await verify(actors.b.id, false)
      }
    })
    // Ask AI (ADR-0060): rag-leakage.security.test.ts asks 1,000 questions without a leak, and ask-ai.e2e.test.ts shows a
    // note leaving PUBLIC drops out of the next answer at once. Recommendations (ADR-0071) are read through the same rule.
    describe('recommendations (ADR-0071)', () => {
      const RECS = '{ recommendations(limit: 20) { kind note { id } noteTitle } }'
      type Recs = { recommendations: { kind: string; note: { id: string } | null; noteTitle: string | null }[] }
      const recs = async (token: string) => (await t.gql<Recs>(RECS, {}, token)).data!.recommendations
      const quizNote = async (title: string, topicId: string) => {
        const quiz = { question: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Which?' }] }] }, choices: [{ id: 'a', content: [{ type: 'text', text: 'This' }] }, { id: 'b', content: [{ type: 'text', text: 'That' }] }], correct: ['a'], multiple: false }
        const created = await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, topicIds: [topicId], cards: [{ id: newId(), type: 'quiz', position: 'a0', content: quiz }] } }, actors.a.token)
        return created.data!.createNote.note.id
      }
      /** B spends a minute on the topic, and says it opened the note: the client is not believed. */
      const bReads = (topicId: string, noteId: string) =>
        t.gql('mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted } }', {
          input: {
            timeZone: 'UTC',
            events: [
              { id: newId(), type: 'TIME_SPENT', durationMs: 60_000, topicKeys: [`topic:${topicId}`], metadata: { activity: 'READING' }, clientTs: new Date().toISOString(), platform: 'WEB' },
              { id: newId(), type: 'NOTE_OPENED', entityType: 'NOTE', entityId: noteId, clientTs: new Date(Date.now() - 3 * 86_400_000).toISOString(), platform: 'WEB' },
            ],
          },
        }, actors.b.token)

      it('B gets no recommendations that draw on A’s private notes', async () => {
        const db = t.app.get(PrismaService)
        const topic = await db.topic.findFirstOrThrow({ where: { origin: 'CURATED' }, orderBy: { id: 'desc' } })
        const id = await quizNote(`Private quiz ${Date.now()}`, topic.id)
        await bReads(topic.id, id)
        await t.app.get(RecommendationsService).compute(actors.b.id)
        expect(await db.recommendation.count({ where: { userId: actors.b.id, entityId: id } })).toBe(0)
        expect((await recs(actors.b.token)).map((r) => r.note?.id)).not.toContain(id)
      })

      it('unpublishing removes a note from recommendations at once, before they are computed again', async () => {
        const db = t.app.get(PrismaService)
        await db.user.update({ where: { id: actors.a.id }, data: { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } })
        const topic = await db.topic.findFirstOrThrow({ where: { origin: 'CURATED' }, orderBy: { id: 'asc' } })
        const id = await quizNote(`Public quiz ${Date.now()}`, topic.id)
        await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, actors.a.token)
        await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PUBLIC' } }, actors.a.token)
        await t.gql('mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted } }', { input: { timeZone: 'UTC', events: [{ id: newId(), type: 'TIME_SPENT', durationMs: 60_000, topicKeys: [`topic:${topic.id}`], metadata: { activity: 'READING' }, clientTs: new Date().toISOString(), platform: 'WEB' }] } }, actors.b.token)
        await t.app.get(RecommendationsService).compute(actors.b.id)
        expect(await recs(actors.b.token)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'QUIZ_ON_TOPIC', note: { id } })]))
        await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PRIVATE' } }, actors.a.token)
        // The stored rows still name it; the read drops it.
        expect(await db.recommendation.count({ where: { userId: actors.b.id, entityId: id } })).toBe(1)
        expect((await recs(actors.b.token)).map((r) => r.note?.id)).not.toContain(id)
      })
    })
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
      await ts.app.get(SearchIndex).indexNote(noteId)

      const b = actors.b.token
      const seen = await t.gql<{ group: Record<string, unknown> | null }>('query ($id: UUID!) { group(id: $id) { name members { role } posts { edges { node { id } } } joinRequests { id } sharedNotes { edges { node { id } } } } }', { id: groupId }, b)
      expect(seen.data!.group).toEqual({ name: 'Group G', members: null, posts: null, joinRequests: null, sharedNotes: null })
      expect((await t.gql<{ note: unknown }>('query ($id: UUID!) { note(id: $id) { id } }', { id: noteId }, b)).data!.note).toBeNull()
      expect((await t.gql<{ sharedWithMe: { edges: unknown[] } }>('{ sharedWithMe { edges { node { id } } } }', {}, b)).data!.sharedWithMe.edges).toEqual([])
      expect(await searched(word, b)).toEqual([])
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
      await ts.app.get(SearchIndex).indexNote(noteId)

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
      expect(await searched(word, a)).toEqual([])
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

    it('a post moderators hid reaches no other member through any channel, and its author never learns who reported it (ADR-0051)', async () => {
      const db = t.app.get(PrismaService)
      const bus = t.app.get(InProcessEventBus)
      const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
      const t1 = actors.teacher
      const groupId = (await t.gql<{ createGroup: { group: { id: string } } }>('mutation { createGroup(input: { name: "Group H", privacy: PRIVATE }) { group { id } } }', {}, t1.token)).data!.createGroup.group.id
      // A writes in H; B reports it. Both are verified for this, and go back to unverified afterwards.
      await db.user.updateMany({ where: { id: { in: [actors.a.id, actors.b.id] } }, data: { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } })
      let postId = ''
      try {
        for (const who of [actors.a, actors.b]) await db.groupMember.create({ data: { groupId, userId: who.id, role: 'MEMBER' } })
        postId = (await t.gql<{ createGroupPost: { post: { id: string } } }>('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: doc('A’s rant') } }, actors.a.token)).data!.createGroupPost.post.id
        await t.gql('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } } }', { input: { target: { type: 'GROUP_POST', id: postId }, body: doc('A replies to themself') } }, actors.a.token)
        await t.gql('mutation ($input: ReportContentInput!) { reportContent(input: $input) { ok } }', { input: { entityType: 'GROUP_POST', entityId: postId, reason: 'HARASSMENT', details: 'B wrote this' } }, actors.b.token)
      } finally {
        await db.user.updateMany({ where: { id: { in: [actors.a.id, actors.b.id] } }, data: { verifiedAt: null, verificationMethod: null } })
      }
      await t.gql('mutation ($input: ModerateContentInput!) { moderateContent(input: $input) { ok } }', { input: { entityType: 'GROUP_POST', entityId: postId, action: 'HIDE', reason: 'Be kind.' } }, t1.token)
      await bus.drain()

      // B: not in the posts, the activity feed, the post's discussion or a report on it.
      const b = actors.b.token
      const posts = await t.gql<{ group: { posts: { edges: { node: { id: string } }[] } } }>('query ($id: UUID!) { group(id: $id) { posts { edges { node { id } } } } }', { id: groupId }, b)
      expect(posts.data!.group.posts.edges).toEqual([])
      const feed = await t.gql<{ activityFeed: { edges: { node: { post: { id: string } | null } }[] } }>('{ activityFeed { edges { node { post { id } } } } }', {}, b)
      expect(feed.data!.activityFeed.edges.map((e) => e.node.post?.id)).not.toContain(postId)
      expect((await t.gql<{ discussion: unknown }>('query ($target: CommentTargetInput!) { discussion(target: $target) { commentCount } }', { target: { type: 'GROUP_POST', id: postId } }, b)).data!.discussion).toBeNull()
      const again = await t.gql<{ reportContent: { userErrors: { code: string }[] } }>('mutation ($input: ReportContentInput!) { reportContent(input: $input) { userErrors { code } } }', { input: { entityType: 'GROUP_POST', entityId: postId, reason: 'SPAM' } }, b)
      expect(again.data!.reportContent.userErrors).toEqual([{ code: 'NOT_FOUND' }])

      // A, the author, sees the post, the decision and the reason; never the report, its words or who sent it.
      const a = actors.a.token
      const mine = await t.gql<{ group: { posts: { edges: { node: { id: string; moderation: string; moderationReason: string } }[] } } }>('query ($id: UUID!) { group(id: $id) { posts { edges { node { id moderation moderationReason } } } } }', { id: groupId }, a)
      expect(mine.data!.group.posts.edges.map((e) => e.node)).toEqual([{ id: postId, moderation: 'HIDDEN', moderationReason: 'Be kind.' }])
      expect((await t.gql('query ($scope: ModerationScopeInput) { moderationQueue(scope: $scope) { edges { cursor } } }', { scope: { scope: 'GROUP', id: groupId } }, a)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
      const told = await t.gql<{ notifications: { edges: { node: { category: string; actor: { id: string } | null; data: unknown } }[] } }>('{ notifications { edges { node { category actor { id } data } } } }', {}, a)
      const moderation = told.data!.notifications.edges.map((e) => e.node).filter((n) => n.category === 'MODERATION')
      expect(moderation).toEqual([{ category: 'MODERATION', actor: null, data: { kind: 'HIDDEN', entityType: 'GROUP_POST' } }])
      expect(JSON.stringify(told.data)).not.toMatch(/B wrote this|Be kind/)
      // No type a member can reach carries a reporter, except the moderators' ModerationReport.
      const reporters = Object.values(schema.getTypeMap()).filter((type) => isObjectType(type) && !type.name.startsWith('__') && Object.keys(type.getFields()).some((f) => /reporter/i.test(f))).map((type) => type.name)
      expect(reporters).toEqual(['ModerationReport'])
    })
  })
})

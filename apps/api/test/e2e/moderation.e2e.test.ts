import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/** Moderation (§15.1, ADR-0037): the gate on the way to the public, reports, the platform queue and appeals. */
describe('moderation', () => {
  let t: TestApp
  let db: PrismaService
  let author: string
  let authorId: string
  let admin: string
  let readers: { id: string; token: string }[]

  const ERRORS = 'userErrors { field message code }'
  type Errors = { field: string[] | null; message: string; code: string }[]
  const doc = (s: string) => ({ doc: { type: 'doc', content: s.split('\n').map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })) } })

  const published = async (token: string, title: string, body: string) => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: doc(body) }] } }, token)
    const id = created.data!.createNote.note.id
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } ${ERRORS} } }`, { input: { noteId: id } }, token)
    return id
  }
  const visibility = (token: string, noteId: string, to: string) =>
    t.gql<{ changeNoteVisibility: { note: { visibility: string } | null; userErrors: Errors } }>(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { visibility } ${ERRORS} } }`, { input: { noteId, visibility: to } }, token)
  const read = async (id: string, token?: string) =>
    (await t.gql<{ note: { id: string; moderation: { state: string; reason: string | null; canAppeal: boolean } | null } | null }>('query ($id: UUID!) { note(id: $id) { id moderation { state reason canAppeal } } }', { id }, token)).data!.note
  const ok = async (name: string, input: object, token: string) => {
    const res = await t.gql<Record<string, { ok: boolean; userErrors: Errors }>>(`mutation ($input: ${name[0]!.toUpperCase()}${name.slice(1)}Input!) { ${name}(input: $input) { ok ${ERRORS} } }`, { input }, token)
    return { payload: res.data?.[name] ?? { ok: false, userErrors: [] }, errors: res.errors }
  }
  const queue = async (token: string) => {
    const res = await t.gql<{ moderationQueue: { edges: { node: { entityType: string; entityId: string; note: { title: string; excerpt: string; moderation: string; owner: { id: string } } | null; reports: { reason: string; details: string | null; reporter: { id: string } | null }[]; appeal: { message: string } | null } }[] } }>(
      '{ moderationQueue(first: 100) { edges { node { entityType entityId note { title excerpt moderation owner { id } } reports { reason details reporter { id } } appeal { message } } } } }',
      {},
      token,
    )
    return { cases: res.data?.moderationQueue.edges.map((e) => e.node) ?? [], errors: res.errors }
  }
  const caseOf = async (entityId: string) => (await queue(admin)).cases.find((c) => c.entityId === entityId)

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const a = await seedUser(t.app, { verified: true, displayName: 'Asha Rao' })
    authorId = a.id
    author = tokenFor(t.config, a.id)
    admin = tokenFor(t.config, (await seedUser(t.app, { verified: true, globalRole: 'PLATFORM_ADMIN' })).id)
    readers = await Promise.all([1, 2, 3].map(async () => {
      const u = await seedUser(t.app, { verified: true })
      return { id: u.id, token: tokenFor(t.config, u.id) }
    }))
  })

  afterAll(() => t.close())

  it('lets an ordinary note go public at once', async () => {
    const id = await published(author, 'Binary search', 'Halve the range each step.')
    expect((await visibility(author, id, 'PUBLIC')).data!.changeNoteVisibility.note!.visibility).toBe('PUBLIC')
    expect(await read(id)).toMatchObject({ id, moderation: null })
    expect((await read(id, author))!.moderation).toEqual({ state: 'OK', reason: null, canAppeal: false })
  })

  it('holds spam on its way to the public, tells the author why, and a moderator lets it through', async () => {
    const id = await published(author, 'Free stuff', 'Buy followers here, cheap.')
    await visibility(author, id, 'PUBLIC')
    expect(await read(id)).toBeNull()
    expect((await read(id, author))!.moderation).toEqual({ state: 'PENDING_REVIEW', reason: expect.stringMatching(/^A moderator will look at this note before it is public: it contains words linked to spam\.$/), canAppeal: false })

    const held = await caseOf(id)
    expect(held).toMatchObject({ entityType: 'NOTE', note: { title: 'Free stuff', excerpt: 'Buy followers here, cheap.', moderation: 'PENDING_REVIEW', owner: { id: authorId } }, reports: [{ reason: 'SPAM', reporter: null }] })

    expect((await ok('moderateContent', { entityType: 'NOTE', entityId: id, action: 'APPROVE' }, admin)).payload.ok).toBe(true)
    expect(await read(id)).toMatchObject({ id })
    expect(await caseOf(id)).toBeUndefined()
    const audit = await db.auditLog.findMany({ where: { targetId: id, action: { startsWith: 'moderation.' } }, orderBy: { createdAt: 'asc' } })
    expect(audit.map((a) => a.action)).toEqual(['moderation.held', 'moderation.approve'])
    // A new version is screened again.
    await t.gql(`mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { ${ERRORS} } }`, { input: { noteId: id, ops: [{ kind: 'UPSERT', id: newId(), type: 'text', position: 'a1', content: doc('Also: casino bonus inside.') }] } }, author)
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId: id } }, author)
    expect(await read(id)).toBeNull()
  })

  it('takes reports only on what the reporter can see, once each, and holds a public note after three people', async () => {
    const id = await published(author, 'Graphs', 'Vertices and edges.')
    await visibility(author, id, 'PUBLIC')
    const priv = await published(author, 'Private', 'Mine.')
    expect((await ok('reportContent', { entityType: 'NOTE', entityId: priv, reason: 'SPAM' }, readers[0]!.token)).payload.userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect((await ok('reportContent', { entityType: 'NOTE', entityId: id, reason: 'SPAM' }, author)).payload.userErrors[0]!.message).toBe('This is your own note.')

    await ok('reportContent', { entityType: 'NOTE', entityId: id, reason: 'HARASSMENT', details: 'Mean words' }, readers[0]!.token)
    await ok('reportContent', { entityType: 'NOTE', entityId: id, reason: 'HATE', details: 'Changed my mind' }, readers[0]!.token)
    await ok('reportContent', { entityType: 'NOTE', entityId: id, reason: 'SPAM' }, readers[1]!.token)
    expect(await read(id)).not.toBeNull()
    expect((await caseOf(id))!.reports).toHaveLength(2)
    expect((await caseOf(id))!.reports[0]).toMatchObject({ reason: 'HATE', details: 'Changed my mind', reporter: { id: readers[0]!.id } })

    await ok('reportContent', { entityType: 'NOTE', entityId: id, reason: 'SPAM' }, readers[2]!.token)
    expect(await read(id)).toBeNull()
    expect((await read(id, author))!.moderation!.state).toBe('PENDING_REVIEW')
    // The reports were wrong: dismissing them frees the note.
    await ok('moderateContent', { entityType: 'NOTE', entityId: id, action: 'DISMISS' }, admin)
    expect(await read(id)).not.toBeNull()
    expect(await db.report.count({ where: { entityId: id, status: 'OPEN' } })).toBe(0)
  })

  it('hides a note from everyone but its author, who may appeal once', async () => {
    const id = await published(author, 'Shared notes', 'Ordinary words.')
    await db.noteShare.create({ data: { noteId: id, userId: readers[0]!.id, role: 'VIEWER', createdById: authorId } })
    await visibility(author, id, 'PUBLIC')
    await ok('reportContent', { entityType: 'NOTE', entityId: id, reason: 'COPYRIGHT', details: 'Copied from my book' }, readers[1]!.token)

    expect((await ok('moderateContent', { entityType: 'NOTE', entityId: id, action: 'HIDE' }, admin)).payload.userErrors[0]).toMatchObject({ field: ['input', 'reason'] })
    await ok('moderateContent', { entityType: 'NOTE', entityId: id, action: 'HIDE', reason: 'Copied from a book without permission.' }, admin)
    expect(await read(id)).toBeNull()
    expect(await read(id, readers[0]!.token)).toBeNull()
    expect((await read(id, author))!.moderation).toEqual({ state: 'HIDDEN', reason: 'Copied from a book without permission.', canAppeal: true })
    // It cannot simply be made public again.
    await visibility(author, id, 'SHARED')
    expect((await visibility(author, id, 'PUBLIC')).errors?.[0]).toMatchObject({ extensions: { code: 'FORBIDDEN' } })

    expect((await ok('appealModeration', { entityType: 'NOTE', entityId: id, message: 'I wrote this myself.' }, readers[0]!.token)).payload.userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect((await ok('appealModeration', { entityType: 'NOTE', entityId: id, message: 'I wrote this myself.' }, author)).payload.ok).toBe(true)
    expect((await ok('appealModeration', { entityType: 'NOTE', entityId: id, message: 'Again' }, author)).payload.userErrors[0]!.message).toBe('You have already appealed for this note.')
    expect((await caseOf(id))!.appeal).toEqual({ message: 'I wrote this myself.' })

    await ok('moderateContent', { entityType: 'NOTE', entityId: id, action: 'APPROVE' }, admin)
    expect((await read(id, author))!.moderation!.state).toBe('OK')
    expect(await read(id, readers[0]!.token)).not.toBeNull()
  })

  it('keeps the queue and decisions to platform admins, and people can be reported but not hidden', async () => {
    expect((await queue(readers[0]!.token)).errors?.[0]).toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    const id = await published(author, 'x', 'y')
    expect((await ok('moderateContent', { entityType: 'NOTE', entityId: id, action: 'APPROVE' }, author)).errors?.[0]).toMatchObject({ extensions: { code: 'FORBIDDEN' } })

    expect((await ok('reportContent', { entityType: 'USER', entityId: authorId, reason: 'HARASSMENT' }, readers[1]!.token)).payload.ok).toBe(true)
    expect((await ok('reportContent', { entityType: 'USER', entityId: newId(), reason: 'HARASSMENT' }, readers[1]!.token)).payload.userErrors[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect(await caseOf(authorId)).toMatchObject({ entityType: 'USER', note: null })
    expect((await ok('moderateContent', { entityType: 'USER', entityId: authorId, action: 'HIDE', reason: 'x' }, admin)).payload.userErrors[0]).toMatchObject({ field: ['input', 'action'] })
    expect((await ok('moderateContent', { entityType: 'USER', entityId: authorId, action: 'WARN', reason: 'Please be kind.' }, admin)).payload.ok).toBe(true)
    expect(await caseOf(authorId)).toBeUndefined()
    expect(await db.moderationAction.findFirst({ where: { entityId: authorId } })).toMatchObject({ action: 'WARN', reason: 'Please be kind.' })
  })
})

import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/** Offline sync for devices (§13.2): idempotent pushes with per-operation verdicts, and pulls of what changed. */
describe('sync', () => {
  let t: TestApp
  let db: PrismaService
  let me: { id: string; token: string }
  let friend: { id: string; token: string }

  type Result = { clientOpId: string; status: string; code: string | null; message: string | null; noteId: string; cardResults: { id: string; status: string; revision: number | null }[]; conflictVersionId: string | null }
  type Pulled = { notes: { note: { id: string; title: string; viewerAccess: string; deletedAt: string | null }; cards: { id: string; type: string; position: string; revision: number; content: unknown }[] }[]; liveNoteIds: string[]; cursor: string | null; hasMore: boolean }
  const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
  const push = async (token: string, ops: object[]) => {
    const res = await t.gql<{ syncPush: { results: Result[] } }>(
      'mutation ($ops: [SyncOpInput!]!) { syncPush(ops: $ops) { results { clientOpId status code message noteId cardResults { id status revision } conflictVersionId } } }',
      { ops },
      token,
    )
    if (res.errors) throw new Error(res.errors[0]!.message)
    return res.data!.syncPush.results
  }
  const pull = async (token: string, args: { since?: string | null; after?: string | null; first?: number } = {}) =>
    (await t.gql<{ syncPull: Pulled }>(
      'query ($since: String, $after: String, $first: Int) { syncPull(since: $since, after: $after, first: $first) { notes { note { id title viewerAccess deletedAt } cards { id type position revision content } } liveNoteIds cursor hasMore } }',
      args,
      token,
    )).data!.syncPull

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const a = await seedUser(t.app, { verified: true })
    const b = await seedUser(t.app, { verified: true })
    me = { id: a.id, token: tokenFor(t.config, a.id) }
    friend = { id: b.id, token: tokenFor(t.config, b.id) }
  })

  afterAll(() => t.close())

  it('applies a note written offline, in order, and answers a retry with the first answer', async () => {
    const noteId = newId()
    const card = newId()
    const ops = [
      { clientOpId: newId(), kind: 'CREATE_NOTE', noteId, title: 'Written on the bus', cards: [{ id: card, type: 'text', position: 'a0', content: text('First thought') }] },
      { clientOpId: newId(), kind: 'UPDATE_NOTE', noteId, title: 'Written on the bus, edited', ops: [{ kind: 'UPSERT', id: card, type: 'text', position: 'a0', content: text('Second thought'), baseRevision: 1 }] },
    ]
    const first = await push(me.token, ops)
    expect(first.map((r) => r.status)).toEqual(['APPLIED', 'APPLIED'])
    expect(first[1]!.cardResults).toEqual([{ id: card, status: 'APPLIED', revision: 2 }])
    // The connection dropped before the answer arrived: the device sends the same operations again.
    expect(await push(me.token, ops)).toEqual(first)
    const stored = await db.card.findUniqueOrThrow({ where: { id: card } })
    expect(stored.revision).toBe(2)
    expect((await db.note.findUniqueOrThrow({ where: { id: noteId } })).title).toBe('Written on the bus, edited')
  })

  it('rejects what can never apply, keeps going, and stops at a server-side retry', async () => {
    const other = newId()
    await db.note.create({ data: { id: other, ownerId: friend.id, title: 'Not yours' } })
    const mine = newId()
    const results = await push(me.token, [
      { clientOpId: newId(), kind: 'UPDATE_NOTE', noteId: other, title: 'Taking over' },
      { clientOpId: newId(), kind: 'CREATE_NOTE', noteId: mine, title: 'Still fine' },
      { clientOpId: newId(), kind: 'CREATE_NOTE', noteId: other, title: 'Same id as someone else’s' },
    ])
    expect(results.map((r) => [r.status, r.code])).toEqual([
      ['REJECTED', 'NOT_FOUND'],
      ['APPLIED', null],
      ['REJECTED', 'CONFLICT'],
    ])
  })

  it('keeps the other side of a card changed on two devices, as a conflict version', async () => {
    const noteId = newId()
    const card = newId()
    await push(me.token, [{ clientOpId: newId(), kind: 'CREATE_NOTE', noteId, title: 'Two phones', cards: [{ id: card, type: 'text', position: 'a0', content: text('v1') }] }])
    await push(me.token, [{ clientOpId: newId(), kind: 'UPDATE_NOTE', noteId, ops: [{ kind: 'UPSERT', id: card, type: 'text', position: 'a0', content: text('phone A'), baseRevision: 1 }] }])
    const [b] = await push(me.token, [{ clientOpId: newId(), kind: 'UPDATE_NOTE', noteId, ops: [{ kind: 'UPSERT', id: card, type: 'text', position: 'a0', content: text('phone B'), baseRevision: 1 }] }])
    expect(b!.cardResults[0]!.status).toBe('APPLIED_WITH_CONFLICT')
    expect(b!.conflictVersionId).toBeTruthy()
  })

  it('pulls what changed, page by page, with what the device may keep', async () => {
    const all = await pull(me.token, { first: 2 })
    expect(all.notes.length).toBe(2)
    expect(all.hasMore).toBe(true)
    const next = await pull(me.token, { after: all.cursor, first: 50 })
    const titles = [...all.notes, ...next.notes].map((n) => n.note.title)
    expect(titles).toEqual(expect.arrayContaining(['Written on the bus, edited', 'Still fine', 'Two phones']))
    expect(titles).not.toContain('Not yours')
    const busNote = [...all.notes, ...next.notes].find((n) => n.note.title === 'Written on the bus, edited')!
    expect(busNote.cards).toEqual([expect.objectContaining({ type: 'text', revision: 2, content: text('Second thought') })])

    // Nothing changed: only the ids, and the overlap window may send recent notes again.
    const quiet = await pull(me.token, { since: next.cursor })
    expect(quiet.liveNoteIds).toHaveLength(3)
    // A change shows up in the next sync.
    const [still] = (await db.note.findMany({ where: { ownerId: me.id, title: 'Still fine' } }))
    await new Promise((r) => setTimeout(r, 2_100))
    const since = (await pull(me.token, { since: next.cursor })).cursor
    await push(me.token, [{ clientOpId: newId(), kind: 'TRASH_NOTE', noteId: still!.id }])
    const after = await pull(me.token, { since })
    expect(after.notes.map((n) => [n.note.title, !!n.note.deletedAt])).toContainEqual(['Still fine', true])
  })

  it('brings notes shared with me, and tells me to drop them when they are not any more', async () => {
    const shared = newId()
    await push(friend.token, [{ clientOpId: newId(), kind: 'CREATE_NOTE', noteId: shared, title: 'Group notes', cards: [{ id: newId(), type: 'text', position: 'a0', content: text('Draft') }] }])
    const before = (await pull(me.token)).cursor
    await new Promise((r) => setTimeout(r, 2_100))
    const share = await t.gql<{ shareNote: { userErrors: unknown[] } }>('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { userErrors { message } } }', { input: { noteId: shared, person: (await db.user.findUniqueOrThrow({ where: { id: me.id } })).handle, role: 'EDITOR' } }, friend.token)
    expect(share.data!.shareNote.userErrors).toEqual([])
    const got = await pull(me.token, { since: before })
    expect(got.notes.map((n) => [n.note.title, n.note.viewerAccess])).toContainEqual(['Group notes', 'EDITOR'])
    expect(got.liveNoteIds).toContain(shared)
    await t.gql('mutation ($input: UnshareNoteInput!) { unshareNote(input: $input) { userErrors { message } } }', { input: { noteId: shared, userId: me.id } }, friend.token)
    expect((await pull(me.token, { since: got.cursor })).liveNoteIds).not.toContain(shared)
  })
})

import type { Actor } from '@lvn/contracts/domain'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startPostgres } from '@lvn-backend/testing'
import { noteAccess, visibleNotesWhere, type NoteAccessRow } from '../../src/domain/note-access'

/**
 * §5: "implement the predicate once as a reusable where builder … unit-test that both produce identical result sets on
 * seeded data." Every combination of visibility, published or not, trashed or not, share role and moderation state
 * (ADR-0037), for seven viewers:
 * the per-note decision (`noteAccess`, used when opening one note) and the query (`visibleNotesWhere`, used for every
 * list) must agree on every pair.
 */
describe('note visibility: the single-note rule and the list query agree', () => {
  let db: PrismaService
  let stop: () => Promise<unknown>
  const owner = newId()
  const editor = newId()
  const viewer = newId()
  const stranger = newId()
  /** In a group the shared notes are shared to (ADR-0045) */
  const member = newId()
  const group = newId()
  /** In a class the shared notes are shared to (ADR-0046) */
  const pupil = newId()
  const classroom = newId()
  const notes: (NoteAccessRow & { shares: Record<string, 'EDITOR' | 'VIEWER'> })[] = []

  beforeAll(async () => {
    const pg = await startPostgres()
    stop = () => pg.container.stop()
    db = new PrismaService(pg.url)
    await db.groupRead.create({ data: { id: group, members: { create: [{ userId: member }] } } })
    await db.classroomRead.create({ data: { id: classroom, members: { create: [{ userId: pupil, role: 'STUDENT' }] } } })
    for (const visibility of ['PRIVATE', 'SHARED', 'PUBLIC'] as const) {
      for (const published of [false, true]) {
        for (const trashed of [false, true]) {
          for (const shared of [false, true]) {
            for (const moderation of ['OK', 'PENDING_REVIEW', 'HIDDEN', 'REMOVED'] as const) {
              const id = newId()
              await db.note.create({ data: { id, ownerId: owner, visibility, moderation, deletedAt: trashed ? new Date() : null } })
              let publishedVersionId: string | null = null
              if (published) {
                publishedVersionId = newId()
                await db.noteVersion.create({ data: { id: publishedVersionId, noteId: id, number: 1, kind: 'PUBLISHED', title: '', cards: [], createdById: owner } })
                await db.note.update({ where: { id }, data: { publishedVersionId } })
              }
              const shares: Record<string, 'EDITOR' | 'VIEWER'> = shared ? { [editor]: 'EDITOR', [viewer]: 'VIEWER' } : {}
              for (const [userId, role] of Object.entries(shares)) await db.noteShare.create({ data: { noteId: id, userId, role, createdById: owner } })
              if (shared) await db.groupShare.create({ data: { noteId: id, groupId: group, sharedById: owner } })
              if (shared) await db.classroomShare.create({ data: { noteId: id, classroomId: classroom, sharedById: owner } })
              notes.push({ id, ownerId: owner, visibility, moderation, forkingEnabled: true, publishedVersionId, deletedAt: trashed ? new Date() : null, shares })
            }
          }
        }
      }
    }
  }, 120_000)

  afterAll(async () => {
    await db.$disconnect()
    await stop()
  })

  const actor = (id: string, verified: boolean): Actor => ({ id, globalRole: 'STUDENT', institutionVerified: verified })

  it.each([
    ['the owner', owner],
    ['a share editor', editor],
    ['a share viewer', viewer],
    ['a member of a group it is shared to', member],
    ['a member of a class it is shared to', pupil],
    ['someone else', stranger],
    ['an anonymous visitor', null],
  ])('%s sees the same notes either way', async (_, id) => {
    for (const verified of [true, false]) {
      const a = id ? actor(id, verified) : null
      const listed = new Set((await db.note.findMany({ where: visibleNotesWhere(id), select: { id: true } })).map((n) => n.id))
      // Lists leave the trash out; the owner reaches trashed notes through the trash view.
      const isShared = (n: (typeof notes)[number]) => Object.keys(n.shares).length > 0
      const reach = (n: (typeof notes)[number]) => ({ inSharedGroup: id === member && isShared(n), inSharedClassroom: id === pupil && isShared(n) })
      const opened = new Set(notes.filter((n) => !n.deletedAt && noteAccess(a, n, id ? (n.shares[id] ?? null) : null, reach(n)) !== null).map((n) => n.id))
      expect([...listed].sort()).toEqual([...opened].sort())
    }
  })

  it('gives what the matrix says, on the cases that matter most', () => {
    const find = (v: string, published: boolean, trashed: boolean, shared: boolean, moderation = 'OK') =>
      notes.find((n) => n.visibility === v && !!n.publishedVersionId === published && !!n.deletedAt === trashed && Object.keys(n.shares).length > 0 === shared && n.moderation === moderation)!
    const access = (id: string | null, n: (typeof notes)[number]) => noteAccess(id ? actor(id, true) : null, n, id ? (n.shares[id] ?? null) : null)
    // PRIVATE: the owner only, whatever share rows exist.
    expect(access(owner, find('PRIVATE', false, false, true))).toBe('OWNER')
    expect(access(editor, find('PRIVATE', true, false, true))).toBeNull()
    // SHARED: editors work on the draft before anything is published; viewers wait for a published version.
    expect(access(editor, find('SHARED', false, false, true))).toBe('EDITOR')
    expect(access(viewer, find('SHARED', false, false, true))).toBeNull()
    expect(access(viewer, find('SHARED', true, false, true))).toBe('READER')
    expect(access(stranger, find('SHARED', true, false, true))).toBeNull()
    // PUBLIC: anyone, once published; never from the trash, except for the owner.
    expect(access(null, find('PUBLIC', true, false, false))).toBe('READER')
    expect(access(null, find('PUBLIC', false, false, false))).toBeNull()
    expect(access(stranger, find('PUBLIC', true, true, false))).toBeNull()
    expect(access(owner, find('PUBLIC', true, true, false))).toBe('OWNER')
    // ADR-0037: a held note leaves the public path but stays with the people it is shared with; hidden or removed, it
    // is its owner's alone.
    expect(access(null, find('PUBLIC', true, false, true, 'PENDING_REVIEW'))).toBeNull()
    expect(access(stranger, find('PUBLIC', true, false, true, 'PENDING_REVIEW'))).toBeNull()
    expect(access(viewer, find('PUBLIC', true, false, true, 'PENDING_REVIEW'))).toBe('READER')
    expect(access(editor, find('SHARED', true, false, true, 'HIDDEN'))).toBeNull()
    expect(access(viewer, find('PUBLIC', true, false, true, 'REMOVED'))).toBeNull()
    expect(access(owner, find('PUBLIC', true, false, true, 'REMOVED'))).toBe('OWNER')
    // ADR-0045: a group's members read what is shared to it once published, like viewers; never a PRIVATE note.
    const inGroup = (n: (typeof notes)[number]) => noteAccess(actor(member, true), n, null, { inSharedGroup: true })
    expect(inGroup(find('SHARED', true, false, true))).toBe('READER')
    expect(inGroup(find('SHARED', false, false, true))).toBeNull()
    expect(inGroup(find('PRIVATE', true, false, true))).toBeNull()
    expect(inGroup(find('SHARED', true, false, true, 'PENDING_REVIEW'))).toBe('READER')
    // ADR-0046: a class's members likewise.
    const inClass = (n: (typeof notes)[number]) => noteAccess(actor(pupil, false), n, null, { inSharedClassroom: true })
    expect(inClass(find('SHARED', true, false, true))).toBe('READER')
    expect(inClass(find('SHARED', false, false, true))).toBeNull()
    expect(inClass(find('PRIVATE', true, false, true))).toBeNull()
    expect(inClass(find('PUBLIC', true, false, true, 'HIDDEN'))).toBeNull()
  })
})

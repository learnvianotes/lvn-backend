import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startPostgres, startTypesense } from '@lvn-backend/testing'
import { visibleNotesWhere } from '../../src/domain/note-access'
import { COLLECTIONS, schemaOf, versionName } from '../../src/application/search-collections'
import { forTypesense, noteDocuments } from '../../src/application/search-documents'
import { visibleNotesFilter } from '../../src/application/search-filters'
import { placesOf } from '../../src/application/search-providers'
import { Typesense } from '../../src/infrastructure/typesense'

/**
 * §5: search is filtered "by the same predicate as Read … a matching Typesense filter string; unit-test that both
 * produce identical result sets on seeded data" (ADR-0055). Every combination of visibility, trash, sharing (to people,
 * a group and a class) and moderation, for every kind of viewer: the notes Typesense's filter lets through are exactly
 * the published notes `visibleNotesWhere` lists, with blocks and a deleted group on top.
 */
describe('search: the Typesense filter and the read predicate agree', () => {
  let db: PrismaService
  let ts: Typesense
  let stop: () => Promise<unknown>
  const collection = versionName('parity_', COLLECTIONS.NOTE)
  const owner = newId()
  const editor = newId()
  const viewer = newId()
  const stranger = newId()
  const member = newId()
  const group = newId()
  const pupil = newId()
  const classroom = newId()
  /** In a group that was deleted: its shares give nothing (ADR-0045) */
  const leftBehind = newId()
  const deletedGroup = newId()
  /** Blocked the owner: sees none of the owner's notes (ADR-0043), even ones shared with them */
  const blocker = newId()
  const ids: string[] = []

  beforeAll(async () => {
    const [pg, typesense] = await Promise.all([startPostgres(), startTypesense()])
    stop = () => Promise.all([pg.container.stop(), typesense.container.stop()])
    db = new PrismaService(pg.url)
    ts = new Typesense(typesense.url, typesense.apiKey)
    await db.groupRead.create({ data: { id: group, members: { create: [{ userId: member }] } } })
    await db.groupRead.create({ data: { id: deletedGroup, deletedAt: new Date(), members: { create: [{ userId: leftBehind }] } } })
    await db.classroomRead.create({ data: { id: classroom, members: { create: [{ userId: pupil, role: 'STUDENT' }] } } })
    for (const visibility of ['PRIVATE', 'SHARED', 'PUBLIC'] as const) {
      for (const published of [false, true]) {
        for (const trashed of [false, true]) {
          for (const shared of [false, true]) {
            for (const moderation of ['OK', 'PENDING_REVIEW', 'HIDDEN', 'REMOVED'] as const) {
              const id = newId()
              ids.push(id)
              await db.note.create({ data: { id, ownerId: owner, visibility, moderation, deletedAt: trashed ? new Date() : null } })
              if (published) {
                const versionId = newId()
                await db.noteVersion.create({ data: { id: versionId, noteId: id, number: 1, kind: 'PUBLISHED', title: `Note ${ids.length}`, cards: [], createdById: owner } })
                await db.note.update({ where: { id }, data: { publishedVersionId: versionId, publishedAt: new Date() } })
              }
              if (!shared) continue
              await db.noteShare.createMany({ data: [editor, blocker].map((userId) => ({ noteId: id, userId, role: 'EDITOR' as const, createdById: owner })) })
              await db.noteShare.create({ data: { noteId: id, userId: viewer, role: 'VIEWER', createdById: owner } })
              await db.groupShare.createMany({ data: [group, deletedGroup].map((groupId) => ({ noteId: id, groupId, sharedById: owner })) })
              await db.classroomShare.create({ data: { noteId: id, classroomId: classroom, sharedById: owner } })
            }
          }
        }
      }
    }
    await ts.createCollection(schemaOf('parity_', COLLECTIONS.NOTE))
    const docs = await noteDocuments(db, ids)
    await ts.upsert(collection, [...docs.values()].filter((d) => d !== null).map(forTypesense))
  }, 180_000)

  afterAll(async () => {
    await db.$disconnect()
    await stop()
  })

  const published = { publishedVersionId: { not: null }, deletedAt: null }

  it.each([
    ['the owner', owner, []],
    ['a share editor', editor, []],
    ['a share viewer', viewer, []],
    ['a member of a group it is shared to', member, []],
    ['a member of a class it is shared to', pupil, []],
    ['a member of a deleted group it was shared to', leftBehind, []],
    ['someone with no link to it', stranger, []],
    ['someone who blocked the owner', blocker, [owner]],
    ['an anonymous visitor', null, []],
  ] as const)('%s finds the same notes either way', async (_, viewerId, blockedIds) => {
    // The study-note migrations also publish notes, which this file never sends to Typesense.
    const listed = await db.note.findMany({ where: { AND: [visibleNotesWhere(viewerId), published, { id: { in: ids } }, ...(blockedIds.length ? [{ ownerId: { notIn: [...blockedIds] } }] : [])] }, select: { id: true } })
    const filter = visibleNotesFilter({ viewerId, blockedIds: [...blockedIds], ...(await placesOf(db, viewerId)) })
    const [found] = await ts.multiSearch<{ id: string }>([{ collection, q: '*', filter_by: filter, per_page: 250, include_fields: 'id' }], 5_000)
    expect(found!.hits.map((h) => h.document.id).sort()).toEqual(listed.map((n) => n.id).sort())
  })

  it('holds only published notes outside the trash, with what the filter needs', async () => {
    const [all] = await ts.multiSearch<Record<string, unknown>>([{ collection, q: '*', per_page: 250 }], 5_000)
    expect(all!.found).toBe(await db.note.count({ where: { AND: [published, { id: { in: ids } }] } }))
    const shared = all!.hits.find((h) => (h.document.sharedUserIds as string[]).length)!.document
    expect(shared).toMatchObject({ ownerId: owner, groupIds: expect.arrayContaining([group, deletedGroup]), classroomIds: [classroom] })
    expect((shared.sharedUserIds as string[]).sort()).toEqual([editor, viewer, blocker].sort())
  })
})

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { resetDatabase, startPostgres } from '@lvn-backend/testing'
import { syncStudyContent } from '../../src/application/study-content-sync'
import { visibleNotesWhere } from '../../src/domain/note-access'
import { parseStudyPage } from '../../src/domain/study-page'

const PUBLISHER = '019a118c-f480-7000-8000-000000000001'
const PUBLISHER_EMAIL = 'publisher@learnvianotes.invalid'
/** topic:dsa-basics/analysis, the first seeded note. */
const ANALYSIS = 'e5ba2811-3113-7344-b6f5-0ec9a0e57cda'
const CONTENT = path.resolve(__dirname, '../../../../content/study')
const FREE_PLAN = '01920000-0000-7000-8000-000000000001'

/**
 * `prisma migrate deploy` loads the curated subjects and topics. The notes come from content/study, by slug and by
 * LegacyContentItem key. A second run adds nothing, and a person's note is left alone.
 */
describe('seeded study notes are visible', () => {
  let db: PrismaService
  let url: string
  let stop: () => Promise<unknown>

  beforeAll(async () => {
    const pg = await startPostgres()
    url = pg.url
    stop = () => pg.container.stop()
    db = new PrismaService(url)
  }, 180_000)

  afterAll(async () => {
    await db?.$disconnect()
    await stop?.()
  }, 60_000)

  it('updates a note content:import-legacy already stored, and reuses that owner', async () => {
    await resetDatabase(url)
    const ownerId = newId()
    const noteId = newId()
    const versionId = newId()
    const drafted = new Date(Date.now() - 60_000)
    await db.user.create({ data: { id: ownerId, email: 'notes@learnvianotes.in', handle: 'learnvianotes', displayName: 'Already here' } })
    await db.note.create({
      data: { id: noteId, ownerId, title: 'Old import', slug: 'old-analysis', visibility: 'PUBLIC', moderation: 'OK', draftUpdatedAt: drafted },
    })
    await db.noteVersion.create({ data: { id: versionId, noteId, number: 1, kind: 'PUBLISHED', title: 'Old import', cards: [], createdById: ownerId } })
    await db.note.update({ where: { id: noteId }, data: { publishedVersionId: versionId, publishedAt: drafted, draftUpdatedAt: drafted } })
    await db.legacyContentItem.create({ data: { key: 'topic:dsa-basics/analysis', noteId, sourceHash: 'old', versionId } })

    const first = await syncStudyContent(url, CONTENT)
    expect(first.publisher).toEqual({ id: ownerId, created: false })
    expect(first.created).toBe(906)
    expect(first.updated).toBe(1)
    expect(await db.user.findUnique({ where: { email: PUBLISHER_EMAIL } })).toBeNull()
    expect(await db.note.findUnique({ where: { id: ANALYSIS } })).toBeNull()
    expect(await db.note.findUniqueOrThrow({ where: { id: noteId } })).toMatchObject({ title: 'Analysis of Algorithms', ownerId })
    expect(await db.user.findUniqueOrThrow({ where: { id: ownerId } })).toMatchObject({
      displayName: 'Already here',
      handle: 'learnvianotes',
      email: 'notes@learnvianotes.in',
      passwordHash: null,
    })
    expect(await db.note.count()).toBe(907)
    expect(await db.legacyContentItem.count()).toBe(907)
    expect(await db.note.count({ where: { ownerId } })).toBe(907)

    const again = await syncStudyContent(url, CONTENT)
    expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 907, edited: 0, foreign: 0, trashed: 0 })
    expect(await db.note.count()).toBe(907)
    expect(await db.legacyContentItem.count()).toBe(907)
  }, 900_000)

  it('publishes every note from the pages, and leaves an edit and a note a person wrote', async () => {
    await resetDatabase(url)
    const bad = mkdtempSync(path.join(tmpdir(), 'study-bad-'))
    writeFileSync(path.join(bad, 'bad.md'), readFileSync(path.join(CONTENT, 'dsa-basics/analysis/01-analysis-of-algorithms.md'), 'utf8').replace('topic: analysis', 'topic: not-a-real-topic'))
    await expect(syncStudyContent(url, bad)).rejects.toThrow(/not-a-real-topic/)
    expect(await db.note.count()).toBe(0)
    expect(await db.user.findUnique({ where: { email: PUBLISHER_EMAIL } })).toBeNull()
    rmSync(bad, { recursive: true })

    const topic = await db.topic.findFirstOrThrow({ where: { slug: 'analysis', subject: { slug: 'dsa-basics' } }, select: { id: true } })
    const first = await syncStudyContent(url, CONTENT)
    expect(first).toMatchObject({ files: 907, created: 907, updated: 0, publisher: { id: PUBLISHER, created: true } })

    const subjects = await db.subject.findMany({ select: { id: true, slug: true }, orderBy: { position: 'asc' } })
    expect(subjects).toHaveLength(22)
    expect(subjects[0]).toMatchObject({ slug: 'dsa-basics' })

    const stranger = newId()
    const notes = await db.note.findMany({
      where: visibleNotesWhere(stranger),
      select: { id: true, title: true, ownerId: true, topics: { select: { topicId: true, topic: { select: { subjectId: true, slug: true } } } } },
    })
    expect(notes).toHaveLength(907)
    expect(await db.note.count({ where: visibleNotesWhere(null) })).toBe(907)
    expect(notes.every((n) => n.ownerId === PUBLISHER)).toBe(true)
    expect(new Set(notes.flatMap((n) => n.topics.map((t) => t.topic.subjectId)))).toEqual(new Set(subjects.map((s) => s.id)))

    const analysis = notes.find((n) => n.id === ANALYSIS)
    expect(analysis).toMatchObject({ title: 'Analysis of Algorithms' })
    expect(analysis!.topics).toEqual([expect.objectContaining({ topicId: topic.id, topic: expect.objectContaining({ slug: 'analysis' }) })])
    expect(await db.card.count({ where: { noteId: ANALYSIS, deletedAt: null } })).toBeGreaterThan(0)
    expect(await db.card.count({ where: { deletedAt: null } })).toBe(21_042)
    expect(await db.legacyContentItem.count()).toBe(907)
    expect(await db.noteSearchDocument.count()).toBe(907)
    expect(await db.user.findUniqueOrThrow({ where: { id: PUBLISHER } })).toMatchObject({
      displayName: 'LearnViaNotes',
      handle: 'learnvianotes',
      email: PUBLISHER_EMAIL,
      passwordHash: null,
      emailVerifiedAt: null,
      dateOfBirth: null,
      verifiedAt: null,
      verificationMethod: null,
      registrationCompletedAt: null,
    })
    expect(await db.userPlan.findUniqueOrThrow({ where: { userId: PUBLISHER } })).toMatchObject({ planId: FREE_PLAN })

    const live = await db.card.count({ where: { deletedAt: null } })
    const second = await syncStudyContent(url, CONTENT)
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 907, edited: 0, foreign: 0, trashed: 0 })
    expect(await db.note.count()).toBe(907)
    expect(await db.card.count({ where: { deletedAt: null } })).toBe(live)
    expect(await db.noteVersion.count()).toBe(907)

    const userId = newId()
    const noteId = newId()
    const versionId = newId()
    await db.user.create({ data: { id: userId, email: `reader-${userId.slice(0, 8)}@example.com`, handle: `reader${userId.slice(0, 8)}`, displayName: 'A student' } })
    await db.note.create({ data: { id: noteId, ownerId: userId, title: 'My own note', visibility: 'PUBLIC', slug: 'my-own-note' } })
    await db.noteVersion.create({ data: { id: versionId, noteId, number: 1, kind: 'PUBLISHED', title: 'My own note', cards: [], createdById: userId } })
    await db.note.update({ where: { id: noteId }, data: { publishedVersionId: versionId, publishedAt: new Date(), visibility: 'PUBLIC' } })
    await db.note.update({ where: { id: ANALYSIS }, data: { title: 'Edited in the app', draftUpdatedAt: new Date(Date.now() + 60_000) } })
    await db.user.update({ where: { id: PUBLISHER }, data: { displayName: 'Renamed by hand' } })
    await db.user.update({ where: { id: userId }, data: { displayName: 'Still a student' } })

    const third = await syncStudyContent(url, CONTENT)
    expect(third.edited).toBe(1)
    expect(third.created).toBe(0)
    expect(await db.note.count({ where: visibleNotesWhere(null) })).toBe(908)
    expect(await db.note.findUniqueOrThrow({ where: { id: ANALYSIS } })).toMatchObject({ title: 'Edited in the app' })
    expect(await db.note.findUniqueOrThrow({ where: { id: noteId } })).toMatchObject({ title: 'My own note', ownerId: userId, visibility: 'PUBLIC' })
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ displayName: 'Still a student' })
    expect(await db.user.findUniqueOrThrow({ where: { id: PUBLISHER } })).toMatchObject({ displayName: 'Renamed by hand', email: PUBLISHER_EMAIL, passwordHash: null })

    const otherDir = readdirSync(path.join(CONTENT, 'dsa-basics')).find((name) => name !== 'analysis')!
    const otherFile = readdirSync(path.join(CONTENT, 'dsa-basics', otherDir)).find((name) => name.endsWith('.md'))!
    const source = readFileSync(path.join(CONTENT, 'dsa-basics', otherDir, otherFile), 'utf8')
    const original = parseStudyPage(source, otherFile)
    const dir = mkdtempSync(path.join(tmpdir(), 'study-one-'))
    writeFileSync(path.join(dir, otherFile), source.replace(/^title:.*$/m, 'title: Revised seeded title'))
    const revised = await syncStudyContent(url, dir)
    expect(revised.updated).toBe(1)
    expect(await db.note.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ title: 'Revised seeded title' })
    expect(await db.note.findUniqueOrThrow({ where: { id: ANALYSIS } })).toMatchObject({ title: 'Edited in the app' })
    rmSync(dir, { recursive: true })

    await syncStudyContent(url, CONTENT)
    expect(await db.note.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ title: original.title })
    expect(await db.note.findUniqueOrThrow({ where: { id: ANALYSIS } })).toMatchObject({ title: 'Edited in the app' })
    expect(await db.note.findUniqueOrThrow({ where: { id: noteId } })).toMatchObject({ title: 'My own note', ownerId: userId })
    expect(await db.note.count()).toBe(908)
  }, 900_000)
})

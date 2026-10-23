import { spawn } from 'node:child_process'
import { createReadStream, readdirSync } from 'node:fs'
import path from 'node:path'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startPostgres } from '@lvn-backend/testing'
import { visibleNotesWhere } from '../../src/domain/note-access'

const PUBLISHER = '019a118c-f480-7000-8000-000000000001'
/** topic:dsa-basics/analysis, the first seeded note. */
const ANALYSIS = 'e5ba2811-3113-7344-b6f5-0ec9a0e57cda'
const MIGRATIONS = path.resolve(__dirname, '../../../../prisma/migrations')

function studyFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.includes('study_notes'))
    .sort()
    .map((name) => path.join(MIGRATIONS, name, 'migration.sql'))
}

/** Applies a migration file again. Prisma will not re-run an applied migration; psql will, which is the point. */
function applyAgain(containerId: string, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', containerId, 'psql', '-U', 'lvn', '-d', 'lvn', '-v', 'ON_ERROR_STOP=1', '-q'], { stdio: ['pipe', 'pipe', 'pipe'] })
    const err: Buffer[] = []
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk))
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`psql exited ${code} on ${path.basename(path.dirname(file))}: ${Buffer.concat(err).toString()}`))
    })
    createReadStream(file).pipe(child.stdin)
  })
}

/**
 * A fresh database, after `prisma migrate deploy`, has the curated subjects and the old site's study notes where
 * `publicNotes` and a topic page look: public, published, and filed under the subject. Applying the same SQL again
 * changes nothing a person created.
 */
describe('seeded study notes are visible', () => {
  let db: PrismaService
  let containerId: string
  let stop: () => Promise<unknown>

  beforeAll(async () => {
    const pg = await startPostgres()
    containerId = pg.container.getId()
    stop = () => pg.container.stop()
    db = new PrismaService(pg.url)
  }, 600_000)

  afterAll(async () => {
    await db?.$disconnect()
    await stop?.()
  }, 60_000)

  it('gives every subject a public note a signed-in reader can list', async () => {
    const subjects = await db.subject.findMany({ select: { id: true, slug: true }, orderBy: { position: 'asc' } })
    expect(subjects).toHaveLength(22)
    expect(subjects[0]).toMatchObject({ slug: 'dsa-basics' })
    expect(subjects.map((s) => s.slug)).toContain('sql')

    const stranger = newId()
    const notes = await db.note.findMany({
      where: visibleNotesWhere(stranger),
      select: { id: true, title: true, ownerId: true, topics: { select: { topic: { select: { subjectId: true, slug: true } } } } },
    })
    expect(notes).toHaveLength(907)
    expect(await db.note.count({ where: visibleNotesWhere(null) })).toBe(907)
    expect(notes.every((n) => n.ownerId === PUBLISHER)).toBe(true)
    expect(new Set(notes.flatMap((n) => n.topics.map((t) => t.topic.subjectId)))).toEqual(new Set(subjects.map((s) => s.id)))

    const analysis = notes.find((n) => n.id === ANALYSIS)
    expect(analysis).toMatchObject({ title: 'Analysis of Algorithms' })
    expect(analysis!.topics.some((t) => t.topic.slug === 'analysis')).toBe(true)
    expect(await db.legacyContentItem.count()).toBe(907)
    expect(await db.noteSearchDocument.count({ where: { noteId: ANALYSIS } })).toBe(1)
    expect(await db.user.findUniqueOrThrow({ where: { id: PUBLISHER } })).toMatchObject({ displayName: 'LearnViaNotes', handle: 'learnvianotes', email: 'notes@learnvianotes.in', passwordHash: null })
  })

  it('can run again without duplicating rows or changing a person or their note', async () => {
    const userId = newId()
    const noteId = newId()
    const versionId = newId()
    await db.user.create({ data: { id: userId, email: `reader-${userId.slice(0, 8)}@example.com`, handle: `reader${userId.slice(0, 8)}`, displayName: 'A student' } })
    await db.note.create({ data: { id: noteId, ownerId: userId, title: 'My own note', visibility: 'PUBLIC', slug: 'my-own-note' } })
    await db.noteVersion.create({ data: { id: versionId, noteId, number: 1, kind: 'PUBLISHED', title: 'My own note', cards: [], createdById: userId } })
    await db.note.update({ where: { id: noteId }, data: { publishedVersionId: versionId, publishedAt: new Date(), visibility: 'PUBLIC' } })
    await db.note.update({ where: { id: ANALYSIS }, data: { title: 'Edited in the app', draftUpdatedAt: new Date('2026-10-08T00:00:00.000Z') } })
    await db.user.update({ where: { id: PUBLISHER }, data: { displayName: 'Renamed by hand' } })
    await db.user.update({ where: { id: userId }, data: { displayName: 'Still a student' } })

    for (const file of studyFiles()) await applyAgain(containerId, file)

    expect(await db.subject.count()).toBe(22)
    expect(await db.note.count()).toBe(908)
    expect(await db.note.count({ where: visibleNotesWhere(null) })).toBe(908)
    expect(await db.note.count({ where: visibleNotesWhere(userId) })).toBe(908)
    expect(await db.legacyContentItem.count()).toBe(907)
    expect(await db.note.findUniqueOrThrow({ where: { id: ANALYSIS } })).toMatchObject({ title: 'Edited in the app' })
    expect(await db.note.findUniqueOrThrow({ where: { id: noteId } })).toMatchObject({ title: 'My own note', ownerId: userId, visibility: 'PUBLIC' })
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ displayName: 'Still a student' })
    expect(await db.user.findUniqueOrThrow({ where: { id: PUBLISHER } })).toMatchObject({ displayName: 'Renamed by hand' })
  }, 600_000)
})

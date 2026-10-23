import { LegacyContentImport, type LegacyContentSource } from '@lvn-backend/notes'
import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser } from '../support/seed'

/**
 * The old site's study content into the catalogue and public notes (ADR-0098), from a stand-in for its Firestore: the
 * documents as the old seeder wrote them (flat content trees). Idempotent, and it never overwrites what someone changed
 * in the app.
 */
describe('importing the old site’s content', () => {
  let t: TestApp
  let db: PrismaService
  let importer: LegacyContentImport
  let owner: { id: string; handle: string }

  const para = (text: string, parent = -1) => [{ type: 'paragraph', parent }, { type: 'text', value: text, parent: parent + 1 }]
  const topicDoc = (text: string) => ({
    subjectId: 'lc-notes',
    id: 'big-o',
    title: 'Big-O',
    group: 'Foundations',
    order: 1,
    content: [{ type: 'section', parent: -1 }, { type: 'heading', level: 3, parent: 0 }, { type: 'text', value: 'Upper bounds', parent: 1 }, { type: 'paragraph', parent: 0 }, { type: 'text', value: text, parent: 3 }],
  })
  const problemDoc = (takeaway: string) => ({
    id: 'lc-1',
    lc: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    category: 'hashing',
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    order: 1,
    statement: para('Return the indices of two numbers that add up to target.'),
    optimal: { title: 'Hash map', content: [], code: { py: 'def two_sum(nums, target): ...' }, complexity: ['Time: O(n)'] },
    takeaway: para(takeaway),
  })
  let docs = { topic: topicDoc('Big-O bounds growth from above.'), problem: problemDoc('Look up complements.') }
  const source: LegacyContentSource = {
    name: 'stand-in Firestore',
    meta: async () => ({ version: 'c57b186f594f9106' }),
    catalog: async () => ({
      subjects: [
        { id: 'lc-notes', title: 'Legacy notes', kind: 'notes', order: 1, topics: [{ id: 'big-o', title: 'Big-O', group: 'Foundations' }] },
        { id: 'lc-sheet', title: 'Legacy sheet', kind: 'problems', order: 2, topics: [{ id: 'hashing', title: 'Hashing', group: '' }] },
      ],
    }),
    topics: async (s) => (s === 'lc-notes' ? [docs.topic] : []),
    problems: async (s) => (s === 'lc-sheet' ? [docs.problem] : []),
  }
  const imported = () => db.legacyContentItem.findMany({ include: { note: { include: { topics: { include: { topic: true } } } } }, orderBy: { key: 'asc' } })

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    importer = t.app.get(LegacyContentImport)
    owner = await seedUser(t.app, { handle: 'learnvianotes', displayName: 'LearnViaNotes', verified: true })
  })

  afterAll(() => t.close())

  it('a dry run reads and converts everything and writes nothing, and needs no owner', async () => {
    const report = await importer.run(source, { dryRun: true })
    expect(report).toMatchObject({ dryRun: true, owner: null, contentVersion: 'c57b186f594f9106', notes: { created: 2, updated: 0, unchanged: 0 } })
    expect(report.catalog.subjectsAdded).toEqual(['lc-notes', 'lc-sheet'])
    expect(report.catalog.topicsAdded).toEqual(['lc-notes/foundations', 'lc-notes/big-o', 'lc-sheet/hashing'])
    expect(report.cards).toBeGreaterThan(5)
    expect(await db.subject.count({ where: { slug: { in: ['lc-notes', 'lc-sheet'] } } })).toBe(0)
    expect(await db.legacyContentItem.count()).toBe(0)
    await expect(importer.run(source, { dryRun: false })).rejects.toThrow(/--owner/)
  })

  it('refuses an owner who cannot publish public notes', async () => {
    const unverified = await seedUser(t.app, { handle: 'notyetverified' })
    await expect(importer.run(source, { owner: unverified.handle, dryRun: false })).rejects.toThrow(/verified adult account/)
    await expect(importer.run(source, { owner: 'nobody-here', dryRun: false })).rejects.toThrow(/No account nobody-here/)
  })

  it('adds the catalogue and publishes each topic and problem as a public note under its topic', async () => {
    const report = await importer.run(source, { owner: '@learnvianotes', dryRun: false })
    expect(report).toMatchObject({ owner: '@learnvianotes', notes: { created: 2, updated: 0, unchanged: 0, held: [], editedInApp: [], invalid: [] } })
    const rows = await imported()
    expect(rows.map((r) => r.key)).toEqual(['problem:lc-sheet/lc-1', 'topic:lc-notes/big-o'])
    for (const r of rows) {
      expect(r.note).toMatchObject({ ownerId: owner.id, visibility: 'PUBLIC', moderation: 'OK', publishedVersionId: r.versionId, deletedAt: null })
      expect(await db.auditLog.count({ where: { action: 'note.visibility', targetId: r.noteId } })).toBe(1)
    }
    expect(rows.map((r) => `${r.note.title} → ${r.note.topics.map((x) => x.topic.slug).join()}`)).toEqual(['Two Sum → hashing', 'Big-O → big-o'])
    const bigO = rows[1]!.note.topics[0]!.topic
    expect(bigO).toMatchObject({ origin: 'CURATED', title: 'Big-O' })
    expect(await db.topic.findUniqueOrThrow({ where: { id: bigO.parentId! } })).toMatchObject({ slug: 'foundations', title: 'Foundations' })
    // Visitors find them as they find any public note.
    const listed = await t.gql<{ publicNotes: { edges: { node: { title: string } }[] } }>('{ publicNotes(first: 50) { edges { node { title } } } }')
    expect(listed.data!.publicNotes.edges.map((e) => e.node.title)).toEqual(expect.arrayContaining(['Two Sum', 'Big-O']))
    const version = await db.noteVersion.findUniqueOrThrow({ where: { id: rows[0]!.versionId! } })
    expect((version.cards as { type: string }[]).map((c) => c.type)).toEqual(['text', 'heading', 'text', 'heading', 'code', 'text', 'heading', 'text'])
  })

  it('a second run changes nothing; a changed document becomes a new published version', async () => {
    const before = await imported()
    expect((await importer.run(source, { owner: 'learnvianotes', dryRun: false })).notes).toMatchObject({ created: 0, updated: 0, unchanged: 2 })
    expect((await imported()).map((r) => r.versionId)).toEqual(before.map((r) => r.versionId))

    docs = { ...docs, topic: topicDoc('Big-O bounds growth from above, for large n.') }
    expect((await importer.run(source, { owner: 'learnvianotes', dryRun: true })).notes).toMatchObject({ created: 0, updated: 1, unchanged: 1 })
    expect((await importer.run(source, { owner: 'learnvianotes', dryRun: false })).notes).toMatchObject({ created: 0, updated: 1, unchanged: 1 })
    const after = await imported()
    expect(after[0]!.versionId).toBe(before[0]!.versionId)
    expect(after[1]!.versionId).not.toBe(before[1]!.versionId)
    const version = await db.noteVersion.findUniqueOrThrow({ where: { id: after[1]!.versionId! } })
    expect(JSON.stringify(version.cards)).toContain('for large n')
    expect(await db.card.count({ where: { noteId: after[1]!.noteId, deletedAt: null } })).toBe((version.cards as unknown[]).length)
  })

  it('leaves alone a note edited, unpublished or trashed in the app since', async () => {
    const [problem, topic] = await imported()
    await db.note.update({ where: { id: problem!.noteId }, data: { draftUpdatedAt: new Date(Date.now() + 1000) } })
    await db.note.update({ where: { id: topic!.noteId }, data: { deletedAt: new Date() } })
    docs = { topic: topicDoc('Changed again.'), problem: problemDoc('Changed in the old site too.') }
    const report = await importer.run(source, { owner: 'learnvianotes', dryRun: false })
    expect(report.notes).toMatchObject({ created: 0, updated: 0, unchanged: 0, editedInApp: ['problem:lc-sheet/lc-1'], trashed: ['topic:lc-notes/big-o'] })
    expect((await imported()).map((r) => r.versionId)).toEqual([problem!.versionId, topic!.versionId])
  })

  it('brings renamed catalogue entries up to date, and reports curated topics the old site no longer has', async () => {
    const renamed: LegacyContentSource = {
      ...source,
      catalog: async () => ({ subjects: [{ id: 'lc-notes', title: 'Legacy notes, renamed', kind: 'notes', order: 1, topics: [] }, { id: 'lc-sheet', title: 'Legacy sheet', kind: 'problems', order: 2, topics: [{ id: 'hashing', title: 'Hash maps', group: '' }] }] }),
      topics: async () => [],
      problems: async () => [],
    }
    const report = await importer.run(renamed, { owner: 'learnvianotes', dryRun: false })
    expect(report.catalog).toMatchObject({ subjectsAdded: [], subjectsChanged: ['lc-notes'], topicsAdded: [], topicsChanged: ['lc-sheet/hashing'] })
    expect(report.catalog.notInSource).toEqual(expect.arrayContaining(['lc-notes/foundations', 'lc-notes/big-o']))
    expect(await db.subject.findUniqueOrThrow({ where: { slug: 'lc-notes' } })).toMatchObject({ title: 'Legacy notes, renamed' })
    expect(await db.topic.count({ where: { subject: { slug: 'lc-notes' } } })).toBe(2)
  })
})

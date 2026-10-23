#!/usr/bin/env node
/**
 * Writes the idempotent study-note migrations from the old site's public content.
 *
 * The catalogue (22 subjects, topic groups, topics) is already inserted by
 * prisma/migrations/20261008050000_curated_topics. This script does not invent new ids for those rows: it reads that
 * migration and files each note under the same topic id. Notes, versions, cards and the publisher account use ids
 * derived from the old document key, so a second run of this script emits the same SQL.
 *
 * Content comes from the old app's documents (Firestore project learnvianotes-2e2d7, which is world-readable, or the
 * JSON the old seeder writes). Layout of <content-dir>:
 *
 *   catalog.json                         { subjects: [...] } as catalog/current
 *   <subjectId>.topics.json              topic documents, for kind "notes"
 *   <subjectId>.problems.json            problem documents, for kind "problems"
 *
 *   node scripts/generate-study-seed.mjs <content-dir>
 */
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = process.argv[2]
if (!contentDir) {
  console.error('usage: node scripts/generate-study-seed.mjs <content-dir>')
  process.exit(1)
}

const esbuildDir = readdirSync(path.join(repo, 'node_modules/.pnpm')).find((name) => name.startsWith('esbuild@'))
if (!esbuildDir) throw new Error('esbuild is not installed (pnpm install, then run its postinstall)')
const esbuild = require(path.join(repo, 'node_modules/.pnpm', esbuildDir, 'node_modules/esbuild'))
const outfile = path.join(repo, 'node_modules/.cache/legacy-content.cjs')
mkdirSync(path.dirname(outfile), { recursive: true })
await esbuild.build({
  absWorkingDir: repo,
  stdin: {
    contents: `
      export { topicNote, problemNote, contentHash } from './contexts/notes/src/domain/legacy-content.ts'
      export { positionsBetween, slugify, cardPlainText } from '@lvn/contracts/validation'
    `,
    resolveDir: repo,
    sourcefile: 'study-seed-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  ignoreAnnotations: true,
  alias: { '@lvn/contracts/validation': path.join(repo, 'contracts/dist/validation/index.js') },
  logLevel: 'warning',
})
const { topicNote, problemNote, contentHash, positionsBetween, slugify, cardPlainText } = require(outfile)

const PUBLISHER_ID = '019a118c-f480-7000-8000-000000000001'
const FREE_PLAN_ID = '01920000-0000-7000-8000-000000000001'
const AT = "TIMESTAMPTZ '2026-10-07 03:23:53+00'"
const MAX_FILE = 4_000_000

const q = (value) => `'${String(value).replaceAll("'", "''").replaceAll('\u0000', '')}'`
const uuid = (name) => {
  const bytes = createHash('sha256').update(`lvn-study-seed\0${name}`).digest().subarray(0, 16)
  bytes[6] = 0x70 | (bytes[6] & 0x0f)
  bytes[8] = 0x80 | (bytes[8] & 0x3f)
  const hex = Buffer.from(bytes).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Subject and topic ids exactly as 20261008050000_curated_topics inserted them. */
function catalogueIds(sql) {
  const subjects = new Map()
  const topics = new Map()
  for (const line of sql.split('\n')) {
    const subject = line.match(/^\('([0-9a-f-]{36})', '([a-z0-9-]+)', '((?:[^']|'')*)', (\d+)\)[,;]?$/)
    if (subject) subjects.set(subject[2], subject[1])
    const topic = line.match(/^\('([0-9a-f-]{36})', '([0-9a-f-]{36})', (?:NULL|'[0-9a-f-]{36}'), '((?:[^']|'')*)', /)
    if (topic) topics.set(`${topic[2]}:${topic[3].replaceAll("''", "'")}`, topic[1])
  }
  if (subjects.size !== 22) throw new Error(`expected 22 subjects in the curated migration, found ${subjects.size}`)
  return { subjects, topics }
}

const curatedSql = readFileSync(path.join(repo, 'prisma/migrations/20261008050000_curated_topics/migration.sql'), 'utf8')
const { subjects: subjectIds, topics: topicIds } = catalogueIds(curatedSql)
if (subjectIds.get('dsa-basics') !== '01a118cf-4800-7b97-9833-d0e9ce2510c3') {
  throw new Error('curated subject ids no longer match 20261008050000_curated_topics; refuse to file notes under the wrong topics')
}
const analysis = topicIds.get(`${subjectIds.get('dsa-basics')}:analysis`)
if (analysis !== '01a118cf-4802-7dcd-94da-1b32ee2f97fe') {
  throw new Error(`analysis topic id is ${analysis}, not the id the curated migration inserted`)
}

const catalog = JSON.parse(readFileSync(path.join(contentDir, 'catalog.json'), 'utf8'))
const notes = []
const skipped = []
for (const subject of [...catalog.subjects].sort((a, b) => a.order - b.order)) {
  const subjectId = subjectIds.get(subject.id)
  if (!subjectId) throw new Error(`catalogue subject ${subject.id} is not in the curated migration`)
  const kind = subject.kind === 'problems' ? 'problems' : 'topics'
  const docs = JSON.parse(readFileSync(path.join(contentDir, `${subject.id}.${kind}.json`), 'utf8'))
  for (const doc of docs) {
    const key = kind === 'problems' ? `problem:${subject.id}/${doc.id}` : `topic:${subject.id}/${doc.id}`
    const topicSlug = kind === 'problems' ? doc.category : doc.id
    const topicId = topicIds.get(`${subjectId}:${topicSlug}`)
    if (!topicId) {
      skipped.push(`${key}: no curated topic ${topicSlug}`)
      continue
    }
    let converted
    try {
      converted = kind === 'problems' ? problemNote(doc) : topicNote(doc)
    } catch (error) {
      skipped.push(`${key}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (!converted.title) {
      skipped.push(`${key}: empty title`)
      continue
    }
    const positions = positionsBetween(null, null, converted.cards.length)
    const cards = converted.cards.map((card, index) => ({
      id: uuid(`card:${key}:${index}`),
      type: card.type,
      position: positions[index],
      content: card.content,
    }))
    const versionId = uuid(`version:${key}`)
    const noteId = uuid(`note:${key}`)
    const body = cards
      .map((card) => cardPlainText(card.type, card.content))
      .filter(Boolean)
      .join('\n')
      .slice(0, 8_000)
    notes.push({
      key,
      subjectSlug: subject.id,
      subjectOrder: subject.order,
      noteId,
      versionId,
      topicId,
      topicTitle: doc.title,
      title: converted.title,
      slug: slugify(converted.title),
      hash: contentHash(converted, [topicId]),
      cards,
      body,
    })
  }
}
if (skipped.length) {
  console.error(skipped.slice(0, 20).join('\n'))
  throw new Error(`${skipped.length} documents were not converted`)
}
if (notes.length !== 907) throw new Error(`expected 907 notes, converted ${notes.length}`)

const migrations = path.join(repo, 'prisma/migrations')
for (const name of readdirSync(migrations)) {
  if (name.includes('study_notes')) rmSync(path.join(migrations, name), { recursive: true, force: true })
}

function idempotentCatalogue(sql) {
  const body = sql.replace(/^--[\s\S]*?(?=INSERT INTO "notes"\."Subject")/, '')
  const splitAt = body.indexOf('INSERT INTO "notes"."Topic"')
  if (splitAt < 0) throw new Error('curated migration has no topic insert')
  const subjects = body
    .slice(0, splitAt)
    .replace(
      'INSERT INTO "notes"."Subject" ("id", "slug", "title", "position") VALUES',
      'INSERT INTO "notes"."Subject" ("id", "slug", "title", "position")\nSELECT v.id::uuid, v.slug, v.title, v.position::int FROM (VALUES',
    )
    .replace(
      /;\s*$/,
      '\n) AS v(id, slug, title, position)\nWHERE NOT EXISTS (SELECT 1 FROM "notes"."Subject" s WHERE s.id = v.id::uuid OR s.slug = v.slug);\n\n',
    )
  const topics = body.slice(splitAt).replace(
    ') AS v(id, subject, parent, slug, title, position);',
    `) AS v(id, subject, parent, slug, title, position)
WHERE NOT EXISTS (
  SELECT 1 FROM "notes"."Topic" t
  WHERE t.id = v.id::uuid OR (t."subjectId" = v.subject::uuid AND t.slug = v.slug)
);`,
  )
  return subjects + topics
}

const ownerSql = `-- The publisher of the seeded study notes. A fixed id, so notes always belong to this row and never to a
-- person's account. Inserted only when that id is absent. Handle and email fall through when already taken.
-- Nothing here updates a user, and there is no password, so the account cannot sign in.
INSERT INTO "users"."User" (
  "id", "email", "handle", "displayName", "emailVerifiedAt", "dateOfBirth", "registrationCompletedAt",
  "verifiedAt", "verificationMethod", "globalRole", "createdAt", "updatedAt"
)
SELECT
  '${PUBLISHER_ID}',
  email.address,
  handle.name,
  'LearnViaNotes',
  ${AT},
  DATE '1990-01-01',
  ${AT},
  ${AT},
  'DOCUMENTS',
  'STUDENT',
  ${AT},
  ${AT}
FROM (
  SELECT address FROM (VALUES (1, 'notes@learnvianotes.in'), (2, 'study-notes@learnvianotes.in'), (3, 'study-notes+019a118c@learnvianotes.in')) AS c(preference, address)
  WHERE NOT EXISTS (SELECT 1 FROM "users"."User" u WHERE u.email = c.address)
  ORDER BY preference
  LIMIT 1
) AS email
CROSS JOIN (
  SELECT name FROM (VALUES (1, 'learnvianotes'), (2, 'learnvianotesnotes'), (3, 'learnvianotesstudy')) AS c(preference, name)
  WHERE NOT EXISTS (SELECT 1 FROM "users"."User" u WHERE u.handle = c.name)
  ORDER BY preference
  LIMIT 1
) AS handle
WHERE NOT EXISTS (SELECT 1 FROM "users"."User" WHERE "id" = '${PUBLISHER_ID}');

INSERT INTO "users"."UserPlan" ("userId", "planId", "startedAt")
SELECT '${PUBLISHER_ID}', '${FREE_PLAN_ID}', ${AT}
WHERE EXISTS (SELECT 1 FROM "users"."User" WHERE "id" = '${PUBLISHER_ID}')
ON CONFLICT ("userId") DO NOTHING;
`

const header = `-- Seeded study notes (the old site's 757 topics and 150 Sheet 150 problems) as PUBLIC notes.
-- Generated by scripts/generate-study-seed.mjs. Idempotent: every insert is keyed on a stable id and skipped when
-- that id is already there, and a note is published only while it is still the untouched private stub this seed
-- inserted. Re-running does not duplicate rows and does not update a user or a note someone has since changed.
-- Search triggers stay off for the load; the Postgres search rows are written here, so the notes are findable
-- without waiting for the worker.

`

function writeMigration(name, body) {
  const dir = path.join(migrations, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'migration.sql'), body)
}

writeMigration(
  '20261109090000_study_notes_catalogue',
  `-- Subjects and topics the curated migration already inserts, again, for a database that has lost those rows.
-- Same ids as 20261008050000_curated_topics. Existing rows are left as they are (no update, no delete).

${idempotentCatalogue(curatedSql)}
${ownerSql}`,
)

const stub = `n."ownerId" = '${PUBLISHER_ID}' AND n."publishedVersionId" IS NULL AND n.visibility = 'PRIVATE' AND n."deletedAt" IS NULL AND n."draftUpdatedAt" = ${AT}`

let part = 0
let chunk = []
let chunkBytes = 0
const flush = () => {
  if (!chunk.length) return
  part += 1
  const name = `2026110910${String(part).padStart(4, '0')}_study_notes`
  const body = [
    header,
    'ALTER TABLE "notes"."Note" DISABLE TRIGGER "Note_search_change";',
    'ALTER TABLE "notes"."NoteTopic" DISABLE TRIGGER "NoteTopic_search_change";',
    '',
    ...chunk,
    'ALTER TABLE "notes"."NoteTopic" ENABLE TRIGGER "NoteTopic_search_change";',
    'ALTER TABLE "notes"."Note" ENABLE TRIGGER "Note_search_change";',
    '',
  ].join('\n')
  writeMigration(name, body)
  chunk = []
  chunkBytes = 0
}

for (const note of notes) {
  const cardsSql = note.cards.length
    ? `INSERT INTO "notes"."Card" ("id", "noteId", "position", "type", "content", "revision", "createdAt", "updatedAt")
SELECT c.id::uuid, '${note.noteId}', c.position, c.type::"notes"."CardType", c.content::jsonb, 1, ${AT}, ${AT}
FROM (VALUES
${note.cards.map((card) => `  (${q(card.id)}, ${q(card.position)}, ${q(card.type)}, ${q(JSON.stringify(card.content))})`).join(',\n')}
) AS c(id, position, type, content)
WHERE EXISTS (SELECT 1 FROM "notes"."Note" n WHERE n.id = '${note.noteId}' AND ${stub})
ON CONFLICT DO NOTHING;`
    : ''
  const snapshot = JSON.stringify(note.cards.map((card) => ({ id: card.id, type: card.type, position: card.position, content: card.content, revision: 1 })))
  const sql = `-- ${note.key}
INSERT INTO "notes"."Note" (
  "id", "ownerId", "kind", "title", "slug", "visibility", "draftRevision", "draftUpdatedAt", "forkingEnabled", "moderation", "createdAt", "updatedAt"
)
SELECT '${note.noteId}', '${PUBLISHER_ID}', 'NOTE', ${q(note.title)}, ${q(note.slug)}, 'PRIVATE', 0, ${AT}, true, 'OK', ${AT}, ${AT}
WHERE EXISTS (SELECT 1 FROM "users"."User" WHERE "id" = '${PUBLISHER_ID}')
ON CONFLICT DO NOTHING;

INSERT INTO "notes"."NoteVersion" ("id", "noteId", "number", "kind", "title", "cards", "createdById", "createdAt")
SELECT '${note.versionId}', '${note.noteId}', 1, 'PUBLISHED', ${q(note.title)}, ${q(snapshot)}::jsonb, '${PUBLISHER_ID}', ${AT}
WHERE EXISTS (SELECT 1 FROM "notes"."Note" n WHERE n.id = '${note.noteId}' AND ${stub})
ON CONFLICT DO NOTHING;

${cardsSql}

INSERT INTO "notes"."NoteTopic" ("noteId", "topicId")
SELECT '${note.noteId}', '${note.topicId}'
WHERE EXISTS (SELECT 1 FROM "notes"."Note" n WHERE n.id = '${note.noteId}' AND ${stub})
  AND EXISTS (SELECT 1 FROM "notes"."Topic" t WHERE t.id = '${note.topicId}')
ON CONFLICT DO NOTHING;

UPDATE "notes"."Note" n
SET "publishedVersionId" = '${note.versionId}', "publishedAt" = ${AT}, visibility = 'PUBLIC', "draftRevision" = 1, "updatedAt" = ${AT}
WHERE n.id = '${note.noteId}' AND ${stub}
  AND EXISTS (SELECT 1 FROM "notes"."NoteVersion" v WHERE v.id = '${note.versionId}' AND v."noteId" = n.id);

INSERT INTO "notes"."LegacyContentItem" ("key", "noteId", "sourceHash", "versionId", "importedAt", "updatedAt")
SELECT ${q(note.key)}, '${note.noteId}', ${q(note.hash)}, '${note.versionId}', ${AT}, ${AT}
WHERE EXISTS (
  SELECT 1 FROM "notes"."Note" n
  WHERE n.id = '${note.noteId}' AND n."ownerId" = '${PUBLISHER_ID}' AND n."publishedVersionId" = '${note.versionId}'
)
ON CONFLICT DO NOTHING;

INSERT INTO "notes"."NoteSearchDocument" ("noteId", "versionId", "title", "topics", "body", "document", "updatedAt")
SELECT '${note.noteId}', '${note.versionId}', ${q(note.title)}, ${q(note.topicTitle)}, ${q(note.body)},
  setweight(to_tsvector('english', ${q(note.title)}), 'A')
    || setweight(to_tsvector('english', ${q(note.topicTitle)}), 'B')
    || setweight(to_tsvector('english', ${q(note.body)}), 'C'),
  ${AT}
WHERE EXISTS (
  SELECT 1 FROM "notes"."Note" n
  WHERE n.id = '${note.noteId}' AND n.visibility = 'PUBLIC' AND n."publishedVersionId" = '${note.versionId}' AND n."deletedAt" IS NULL
)
ON CONFLICT DO NOTHING;
`
  if (chunkBytes + sql.length > MAX_FILE) flush()
  chunk.push(sql)
  chunkBytes += sql.length
}
flush()

const bySubject = new Map()
for (const note of notes) bySubject.set(note.subjectSlug, (bySubject.get(note.subjectSlug) ?? 0) + 1)
console.log(`${notes.length} notes in ${part} migration files`)
for (const [slug, count] of bySubject) console.log(`  ${slug}: ${count}`)

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { CardType } from '@lvn/contracts/domain'
import { cardPlainText, positionsBetween } from '@lvn/contracts/validation'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { contentHash } from '../domain/legacy-content'
import { parseStudyPage, type StudyPage } from '../domain/study-page'

/**
 * Reads `content/study` and upserts the seeded notes (ADR-0098). Deploy runs this after `prisma migrate deploy`
 * (`scripts/migrate-and-sync.mjs`). It needs `DATABASE_URL` and nothing else.
 *
 * Subjects and topics are the curated rows already in the database, found by slug. A note is matched on its
 * `LegacyContentItem` key, so a note `content:import-legacy` already wrote is not inserted again. The page's id is
 * used only when that key is new. An untouched seeded note is updated from the page; a note someone has edited,
 * unpublished, hidden or trashed is left alone. Users are never updated. Nothing is truncated.
 *
 * The publisher id and email match `contexts/users/src/domain/study-publisher.ts`. Auth refuses that id and that
 * address. The publisher is always that system account: the owner of seeded notes when that owner is this account,
 * otherwise the account itself, created when it is missing. No other account is adopted. If another account holds
 * the handle `learnvianotes` and the system publisher does not exist yet, the sync
 * throws and the deploy stops. Nothing here sets a birth date, a password, or a verification flag. Those columns
 * are nullable. Users are never updated.
 */

/** Keep identical to contexts/users/src/domain/study-publisher.ts. */
export const STUDY_PUBLISHER_ID = '019a118c-f480-7000-8000-000000000001'
const STUDY_PUBLISHER_EMAIL = 'publisher@learnvianotes.invalid'
const STUDY_PUBLISHER_HANDLE = 'learnvianotes'
const FREE_PLAN_ID = '01920000-0000-7000-8000-000000000001'

export interface StudySyncReport {
  publisher: { id: string; created: boolean }
  files: number
  created: number
  updated: number
  unchanged: number
  /** Left alone: edited, unpublished, hidden or a different published version. */
  edited: number
  trashed: number
  /** A page id already belongs to someone else. The row is not touched. */
  foreign: number
}

interface TopicRef {
  id: string
  title: string
}

interface NoteState {
  id: string
  ownerId: string
  title: string
  slug: string
  visibility: string
  moderation: string
  publishedVersionId: string | null
  draftUpdatedAt: Date
  deletedAt: Date | null
}

/**
 * Syncs every note page under `contentDir`. Throws before writing when a page is invalid, repeated, or names a
 * subject and topic slug the database does not have, so a deploy does not publish a partial catalogue.
 */
export async function syncStudyContent(databaseUrl: string, contentDir: string): Promise<StudySyncReport> {
  const db = new PrismaService(databaseUrl)
  try {
    const files = walk(contentDir)
    if (!files.length) throw new Error(`No study notes under ${contentDir}.`)
    const topics = await topicIndex(db)
    // Checked in full before any write, then applied one page at a time. The pages are not kept: the migrate
    // container has 256 MB, and a bad page must not publish part of the catalogue.
    const seenId = new Set<string>()
    const seenKey = new Set<string>()
    for (const file of files) {
      const { page } = check(file, contentDir, topics)
      if (seenId.has(page.id)) throw new Error(`Two study pages use the note id ${page.id}.`)
      if (seenKey.has(page.key)) throw new Error(`Two study pages use the key ${page.key}.`)
      seenId.add(page.id)
      seenKey.add(page.key)
    }

    const publisher = await resolvePublisher(db)
    const report: StudySyncReport = { publisher, files: files.length, created: 0, updated: 0, unchanged: 0, edited: 0, trashed: 0, foreign: 0 }
    let done = 0
    for (const file of files) {
      const { page, topic } = check(file, contentDir, topics)
      await apply(db, page, topic, publisher.id, report)
      done += 1
      if (done % 100 === 0) console.log(`study content ${done}/${files.length}`)
    }
    return report
  } finally {
    await db.$disconnect()
  }
}

function check(file: string, contentDir: string, topics: Map<string, TopicRef>): { page: StudyPage; topic: TopicRef } {
  const page = parseStudyPage(readFileSync(file, 'utf8'), path.relative(contentDir, file))
  const topic = topics.get(`${page.subject}/${page.topic}`)
  if (!topic) throw new Error(`${path.relative(contentDir, file)} names ${page.subject}/${page.topic}, and no topic has those slugs.`)
  return { page, topic }
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    if (name === 'README.md') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (name.endsWith('.md')) out.push(full)
  }
  return out
}

async function topicIndex(db: PrismaService): Promise<Map<string, TopicRef>> {
  const rows = await db.topic.findMany({ select: { id: true, slug: true, title: true, subject: { select: { slug: true } } } })
  return new Map(rows.map((row) => [`${row.subject.slug}/${row.slug}`, { id: row.id, title: row.title }]))
}

/**
 * Who owns notes this sync creates. Only the system publisher. An owner of notes already seeded is kept only when
 * that owner is `publisher@learnvianotes.invalid`. Otherwise that account is created, if its id, email and handle
 * are free. Another account is never adopted. If the handle belongs to anyone else, this throws before any note
 * is written, so the deploy stops instead of giving the catalogue away. No user row is updated.
 */
async function resolvePublisher(db: PrismaService): Promise<{ id: string; created: boolean }> {
  const seeded = await seededSystemPublisher(db)
  if (seeded) return seeded

  const existing = await existingSystemPublisher(db)
  if (existing) return existing

  await assertHandleFree(db)
  try {
    await db.user.create({
      data: {
        id: STUDY_PUBLISHER_ID,
        email: STUDY_PUBLISHER_EMAIL,
        handle: STUDY_PUBLISHER_HANDLE,
        displayName: 'LearnViaNotes',
        // Nullable on purpose. This account never registers, so it has no birth date and no verification.
        // passwordHash and emailVerifiedAt stay null. Auth refuses the id and the address anyway.
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // A concurrent sync may have inserted this same system publisher. Anyone else holding the id, the email
      // or the handle is not adopted: the deploy stops and no note is written under their account.
      const raced = await systemPublisherRow(db)
      if (raced) {
        await db.userPlan.createMany({ data: [{ userId: STUDY_PUBLISHER_ID, planId: FREE_PLAN_ID }], skipDuplicates: true })
        return { id: STUDY_PUBLISHER_ID, created: false }
      }
      throw await publisherConflict(db)
    }
    throw error
  }
  await db.userPlan.createMany({ data: [{ userId: STUDY_PUBLISHER_ID, planId: FREE_PLAN_ID }], skipDuplicates: true })
  return { id: STUDY_PUBLISHER_ID, created: true }
}

/** The system publisher when it already owns seeded notes. Any other owner is ignored. */
async function seededSystemPublisher(db: PrismaService): Promise<{ id: string; created: false } | null> {
  const rows = await db.$queryRaw<{ ownerId: string }[]>`
    SELECT n."ownerId" AS "ownerId"
    FROM "notes"."LegacyContentItem" l
    JOIN "notes"."Note" n ON n.id = l."noteId"
    JOIN "users"."User" u ON u.id = n."ownerId"
    WHERE u.id = ${STUDY_PUBLISHER_ID}::uuid
      AND u.email = ${STUDY_PUBLISHER_EMAIL}
    GROUP BY n."ownerId"
    LIMIT 1`
  const ownerId = rows[0]?.ownerId
  if (!ownerId) return null
  return { id: ownerId, created: false }
}

/**
 * The system publisher row, when it is exactly that id and email. A different account on either field is an
 * operator error: this does not adopt it.
 */
async function existingSystemPublisher(db: PrismaService): Promise<{ id: string; created: false } | null> {
  const byId = await db.user.findUnique({ where: { id: STUDY_PUBLISHER_ID }, select: { id: true, email: true, handle: true } })
  const byEmail = await db.user.findUnique({ where: { email: STUDY_PUBLISHER_EMAIL }, select: { id: true, email: true, handle: true } })
  if (byId && byId.email.toLowerCase() !== STUDY_PUBLISHER_EMAIL) {
    throw stopped(`The id ${STUDY_PUBLISHER_ID} belongs to ${label(byId)}. That account is not the system publisher and was not adopted.`)
  }
  if (byEmail && byEmail.id !== STUDY_PUBLISHER_ID) {
    throw stopped(`${STUDY_PUBLISHER_EMAIL} belongs to ${label(byEmail)}. That account was not adopted and was not given the notes.`)
  }
  if (byId) return { id: byId.id, created: false }
  return null
}

/** The system publisher only when id, email and handle all match. A partial match is not this account. */
async function systemPublisherRow(db: PrismaService): Promise<{ id: string } | null> {
  const row = await db.user.findUnique({ where: { id: STUDY_PUBLISHER_ID }, select: { id: true, email: true, handle: true } })
  if (!row) return null
  if (row.email.toLowerCase() !== STUDY_PUBLISHER_EMAIL || row.handle.toLowerCase() !== STUDY_PUBLISHER_HANDLE) return null
  return { id: row.id }
}

async function assertHandleFree(db: PrismaService): Promise<void> {
  const holder = await db.user.findFirst({
    where: { handle: { equals: STUDY_PUBLISHER_HANDLE, mode: 'insensitive' } },
    select: { id: true, email: true, handle: true },
  })
  if (!holder) return
  if (holder.id === STUDY_PUBLISHER_ID && holder.email.toLowerCase() === STUDY_PUBLISHER_EMAIL) return
  throw stopped(
    `The handle "${STUDY_PUBLISHER_HANDLE}" belongs to ${label(holder)}. Free that handle and deploy again. That account was not adopted and was not given the notes.`,
  )
}

async function publisherConflict(db: PrismaService): Promise<Error> {
  const holder = await db.user.findFirst({
    where: {
      OR: [{ id: STUDY_PUBLISHER_ID }, { email: STUDY_PUBLISHER_EMAIL }, { handle: { equals: STUDY_PUBLISHER_HANDLE, mode: 'insensitive' } }],
    },
    select: { id: true, email: true, handle: true },
  })
  if (!holder) return stopped('Creating the system publisher hit a unique conflict. No other account was adopted or given the notes.')
  return stopped(`Creating the system publisher conflicted with ${label(holder)}. That account was not adopted and was not given the notes.`)
}

function label(user: { id: string; email: string; handle: string }): string {
  return `${user.email} (id ${user.id}, handle ${user.handle})`
}

function stopped(detail: string): Error {
  return new Error(
    `Study content sync stopped. ${detail} The only publisher is ${STUDY_PUBLISHER_EMAIL} (id ${STUDY_PUBLISHER_ID}, handle ${STUDY_PUBLISHER_HANDLE}).`,
  )
}

async function apply(db: PrismaService, page: StudyPage, topic: TopicRef, publisherId: string, report: StudySyncReport): Promise<void> {
  const hash = contentHash({ title: page.title, cards: page.cards }, [topic.id])
  const legacy = await db.legacyContentItem.findUnique({ where: { key: page.key }, include: { note: true } })
  if (legacy) {
    const note = legacy.note
    if (note.deletedAt) return void report.trashed++
    if (!seedUntouched(note, legacy.versionId, legacy.updatedAt)) return void report.edited++
    if (legacy.sourceHash === hash && note.slug === page.slug) return void report.unchanged++
    await write(db, { id: note.id, ownerId: note.ownerId, creating: false, page, topic, hash, contentChanged: legacy.sourceHash !== hash })
    report.updated++
    return
  }

  const current = await db.note.findUnique({ where: { id: page.id } })
  if (current) {
    if (current.ownerId !== publisherId) return void report.foreign++
    if (current.deletedAt) return void report.trashed++
    if (current.visibility !== 'PUBLIC' || current.moderation !== 'OK' || !current.publishedVersionId) return void report.edited++
    await write(db, { id: current.id, ownerId: current.ownerId, creating: false, page, topic, hash, contentChanged: true })
    report.updated++
    return
  }

  await write(db, { id: page.id, ownerId: publisherId, creating: true, page, topic, hash, contentChanged: true })
  report.created++
}

/** Public, still the version this sync published, and not drafted again afterwards. */
function seedUntouched(note: NoteState, versionId: string | null, legacyUpdatedAt: Date): boolean {
  return note.visibility === 'PUBLIC' && note.moderation === 'OK' && note.publishedVersionId === versionId && note.publishedVersionId !== null && note.draftUpdatedAt <= legacyUpdatedAt
}

async function write(
  db: PrismaService,
  input: { id: string; ownerId: string; creating: boolean; page: StudyPage; topic: TopicRef; hash: string; contentChanged: boolean },
): Promise<void> {
  const at = new Date()
  const positions = positionsBetween(null, null, input.page.cards.length)
  const cards = input.page.cards.map((card, index) => ({
    id: newId(),
    noteId: input.id,
    position: positions[index]!,
    type: card.type as CardType,
    content: card.content as Prisma.InputJsonValue,
    revision: 1,
  }))
  const snapshot = cards.map((card) => ({ id: card.id, type: card.type, position: card.position, content: card.content, revision: 1 }))
  const body = input.page.cards
    .map((card) => cardPlainText(card.type, card.content))
    .filter(Boolean)
    .join('\n')
    .slice(0, 8_000)

  await db.$transaction(async (tx) => {
    if (input.creating) {
      await tx.note.create({
        data: {
          id: input.id,
          ownerId: input.ownerId,
          kind: 'NOTE',
          title: input.page.title,
          slug: input.page.slug,
          visibility: 'PUBLIC',
          moderation: 'OK',
          draftRevision: 0,
          draftUpdatedAt: at,
          publishedAt: at,
          forkingEnabled: true,
        },
      })
    }

    let versionId: string | null = null
    if (input.contentChanged) {
      if (!input.creating) {
        // Cards are the draft. Replacing them is a new version; the previous cards stay, marked deleted.
        await tx.card.updateMany({ where: { noteId: input.id, deletedAt: null }, data: { deletedAt: at } })
      }
      if (cards.length) await tx.card.createMany({ data: cards })
      const last = await tx.noteVersion.aggregate({ where: { noteId: input.id }, _max: { number: true } })
      versionId = newId()
      await tx.noteVersion.create({
        data: {
          id: versionId,
          noteId: input.id,
          number: (last._max.number ?? 0) + 1,
          kind: 'PUBLISHED',
          title: input.page.title,
          cards: snapshot,
          createdById: input.ownerId,
        },
      })
      await tx.note.update({
        where: { id: input.id },
        data: {
          title: input.page.title,
          slug: input.page.slug,
          visibility: 'PUBLIC',
          publishedVersionId: versionId,
          publishedAt: at,
          draftRevision: input.creating ? (input.page.cards.length ? 1 : 0) : { increment: 1 },
          draftUpdatedAt: at,
        },
      })
      // Only this note's topic links. A link that is already right is left in place. An extra link (the page now
      // names a different topic) is removed so the note is not listed under both. This is not a delete of notes,
      // cards or users.
      await tx.noteTopic.deleteMany({ where: { noteId: input.id, topicId: { not: input.topic.id } } })
      await tx.noteTopic.createMany({ data: [{ noteId: input.id, topicId: input.topic.id }], skipDuplicates: true })
      await tx.$executeRaw`
        INSERT INTO "notes"."NoteSearchDocument" ("noteId", "versionId", "title", "topics", "body", "document", "updatedAt")
        VALUES (
          ${input.id}::uuid,
          ${versionId}::uuid,
          ${input.page.title},
          ${input.topic.title},
          ${body},
          setweight(to_tsvector('english', ${input.page.title}), 'A')
            || setweight(to_tsvector('english', ${input.topic.title}), 'B')
            || setweight(to_tsvector('english', ${body}), 'C'),
          ${at}
        )
        ON CONFLICT ("noteId") DO UPDATE SET
          "versionId" = EXCLUDED."versionId",
          "title" = EXCLUDED."title",
          "topics" = EXCLUDED."topics",
          "body" = EXCLUDED."body",
          "document" = EXCLUDED."document",
          "updatedAt" = EXCLUDED."updatedAt"`
    } else {
      await tx.note.update({ where: { id: input.id }, data: { slug: input.page.slug } })
    }

    // Written last. Its updatedAt is the clock after draftUpdatedAt, so the note still counts as untouched.
    const published = versionId ?? (await tx.note.findUniqueOrThrow({ where: { id: input.id }, select: { publishedVersionId: true } })).publishedVersionId
    await tx.legacyContentItem.upsert({
      where: { key: input.page.key },
      create: { key: input.page.key, noteId: input.id, sourceHash: input.hash, versionId: published },
      update: { sourceHash: input.hash, versionId: published },
    })
  })
}

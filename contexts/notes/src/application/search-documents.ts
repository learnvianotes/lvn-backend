import { cardPlainText } from '@lvn/contracts/validation'
import type { CardType } from '@lvn/contracts/domain'
import type { SearchProfile } from '@lvn-backend/facades'
import type { PrismaService } from '@lvn-backend/prisma-base'
import type { SnapshotCard } from '../domain/snapshot'

/** As much of a published version's words as search reads (both providers). */
export const BODY_CHARS = 100_000
const LEAD_WORDS = 24
const DAY_MS = 86_400_000

/** A note's search document (ADR-0055): the published version's words and the fields of the read predicate (§5). */
export interface NoteDocument {
  id: string
  title: string
  topics: string[]
  body: string
  lead: string
  kind: string
  visibility: string
  moderation: string
  ownerId: string
  sharedUserIds: string[]
  groupIds: string[]
  classroomIds: string[]
  topicIds: string[]
  subjectIds: string[]
  publishedAt: number
  /** For the Postgres index; not sent to Typesense */
  versionId: string
}

export interface PersonDocument {
  id: string
  handle: string
  displayName: string
  headline?: string
  bio?: string
  /** The day (since 1970) the account passes the digital-consent age */
  adultFromDays: number
  globalRole: string
}

export interface TopicDocument {
  id: string
  title: string
  subject: string
  subjectId: string
  origin: string
  proposedById?: string
}

/**
 * The documents of these notes as they stand now; null for a note search must not hold (gone, in the trash, or never
 * published). Reads everything in a few queries, whatever the number of notes.
 */
export async function noteDocuments(db: PrismaService, ids: string[]): Promise<Map<string, NoteDocument | null>> {
  const notes = await db.note.findMany({
    where: { id: { in: ids } },
    include: {
      publishedVersion: true,
      topics: { include: { topic: true } },
      shares: { select: { userId: true } },
      groupShares: { select: { groupId: true } },
      classroomShares: { select: { classroomId: true } },
    },
  })
  const out = new Map<string, NoteDocument | null>(ids.map((id) => [id, null]))
  for (const note of notes) {
    const version = note.publishedVersion
    if (!version || note.deletedAt) continue
    const body = (version.cards as unknown as SnapshotCard[])
      .map((c) => cardPlainText(c.type as CardType, c.content))
      .filter(Boolean)
      .join('\n')
      .slice(0, BODY_CHARS)
    const topics = [...note.topics].sort((a, b) => a.topic.title.localeCompare(b.topic.title))
    out.set(note.id, {
      id: note.id,
      versionId: version.id,
      title: version.title,
      topics: topics.map((t) => t.topic.title),
      body,
      lead: body.split(/\s+/).filter(Boolean).slice(0, LEAD_WORDS).join(' '),
      kind: note.kind,
      visibility: note.visibility,
      moderation: note.moderation,
      ownerId: note.ownerId,
      sharedUserIds: note.shares.map((s) => s.userId),
      groupIds: note.groupShares.map((s) => s.groupId),
      classroomIds: note.classroomShares.map((s) => s.classroomId),
      topicIds: topics.map((t) => t.topicId),
      subjectIds: [...new Set(topics.map((t) => t.topic.subjectId))],
      publishedAt: (note.publishedAt ?? version.createdAt).getTime(),
    })
  }
  return out
}

/** The document as Typesense stores it (the version id is Postgres's business). */
export const forTypesense = ({ versionId: _, ...doc }: NoteDocument) => doc

export function personDocument(p: SearchProfile): PersonDocument {
  return {
    id: p.id,
    handle: p.handle,
    displayName: p.displayName,
    ...(p.headline ? { headline: p.headline } : {}),
    ...(p.bio ? { bio: p.bio } : {}),
    adultFromDays: Math.floor(p.adultFrom.getTime() / DAY_MS),
    globalRole: p.globalRole,
  }
}

export async function topicDocuments(db: PrismaService, ids: string[]): Promise<Map<string, TopicDocument | null>> {
  const topics = await db.topic.findMany({ where: { id: { in: ids } }, include: { subject: true } })
  const out = new Map<string, TopicDocument | null>(ids.map((id) => [id, null]))
  for (const t of topics) {
    out.set(t.id, { id: t.id, title: t.title, subject: t.subject.title, subjectId: t.subjectId, origin: t.origin, ...(t.proposedById ? { proposedById: t.proposedById } : {}) })
  }
  return out
}

/** Today as days since 1970 (UTC), for "past the consent age" filters. */
export const todayDays = (now = new Date()) => Math.floor(now.getTime() / DAY_MS)

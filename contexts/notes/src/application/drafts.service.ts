import { Inject, Injectable } from '@nestjs/common'
import { Action, can, type CardType } from '@lvn/contracts/domain'
import { cardPlainText, inlineText, isValidPosition, NOTE_LIMITS, noteTitleSchema, slugify } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { decodeCursor, pageSize } from '@lvn-backend/graphql'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { noteFacts } from '../domain/note-access'
import { AttachmentsService } from './attachments.service'
import { NoteModerationService } from './moderation.service'
import { checkCard, NotesService, type OpenedNote } from './notes.service'
import { OrganiseService } from './organise.service'

import type { SnapshotCard } from '../domain/snapshot'

type Tx = Prisma.TransactionClient

export type { SnapshotCard } from '../domain/snapshot'

export interface CardOp {
  kind: 'UPSERT' | 'MOVE' | 'DELETE'
  id: string
  type?: CardType | null
  position?: string | null
  content?: unknown
  baseRevision?: number | null
}

export interface CardOpResult {
  id: string
  status: 'APPLIED' | 'APPLIED_WITH_CONFLICT' | 'REJECTED'
  revision: number | null
  message: string | null
}

export interface DraftUpdate {
  noteId: string
  title?: string | null
  folderId?: string | null
  tagNames?: string[] | null
  topicIds?: string[] | null
  ops?: CardOp[] | null
}

/** At most 180 characters of a card's words, on one line. */
function excerptOf(type: CardType, content: unknown): string {
  const text = cardPlainText(type, content).replace(/\s+/g, ' ').trim()
  return text.length > 180 ? `${text.slice(0, 179).trimEnd()}…` : text
}

const byPosition = (a: { position: string; id: string }, b: { position: string; id: string }) => (a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * The draft and its versions (§4.3, §13.2). A save is one transaction under the note's row lock: title, folder, tags
 * and topics are last-writer-wins; each card operation follows the per-card rules — a change to a card edited
 * elsewhere since `baseRevision` wins and keeps the other side as a CONFLICT version, a delete of such a card is
 * rejected, a card deleted elsewhere is recreated (create wins), moves are last-writer-wins.
 */
@Injectable()
export class DraftsService {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    private readonly organise: OrganiseService,
    private readonly limiter: RateLimiter,
    private readonly attachments: AttachmentsService,
    private readonly moderation: NoteModerationService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async update(viewerId: string, input: DraftUpdate): Promise<{ opened: OpenedNote; results: CardOpResult[]; conflictVersionId: string | null }> {
    const opened = await this.notes.require(viewerId, input.noteId, 'edit')
    const isOwner = opened.access === 'OWNER'
    const limit = await this.limiter.hit(`notes:save:${viewerId}`, { max: 3_000, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many saves in the last hour. Your changes are kept on this device; try again later.')

    const ops = input.ops ?? []
    if (ops.length > NOTE_LIMITS.opsPerSave) throw Errors.validation(`Save at most ${NOTE_LIMITS.opsPerSave} card changes at once.`, ['input', 'ops'])
    if (new Set(ops.map((o) => o.id)).size !== ops.length) throw Errors.validation('A card appears twice in one save.', ['input', 'ops'])
    // Everything is checked before anything is written: an invalid card fails the whole save.
    const contents = new Map<string, unknown>()
    const upserts: { type: CardType; content: unknown; at: string[] }[] = []
    ops.forEach((op, i) => {
      const at = ['input', 'ops', String(i)]
      if (op.kind === 'UPSERT') {
        if (!op.type || op.position == null || op.content === undefined) throw Errors.validation('A card needs a type, a position and content.', at)
        contents.set(op.id, checkCard({ id: op.id, type: op.type, position: op.position, content: op.content }, at, { media: true }))
        upserts.push({ type: op.type, content: contents.get(op.id), at })
      }
      if (op.kind === 'MOVE' && !isValidPosition(op.position)) throw Errors.validation('This card position is not valid.', [...at, 'position'])
    })
    await this.attachments.assertUsable(input.noteId, upserts)
    const title = input.title === undefined || input.title === null ? undefined : noteTitleSchema.safeParse(input.title)
    if (title && !title.success) throw Errors.validation(title.error.issues[0]!.message, ['input', 'title'])
    if ((input.folderId !== undefined || input.tagNames) && !isOwner) throw Errors.forbidden('Folders and tags belong to the note’s owner.')
    if (input.folderId) await this.organise.assertOwnFolder(viewerId, input.folderId, ['input', 'folderId'])
    const topicIds = input.topicIds ? await this.organise.usableTopics(viewerId, input.topicIds, ['input', 'topicIds']) : null

    const outcome = await this.db.$transaction(async (tx) => {
      await this.lock(tx, input.noteId)
      const ids = ops.map((o) => o.id)
      const existing = ids.length ? await tx.card.findMany({ where: { id: { in: ids } } }) : []
      const byId = new Map(existing.map((c) => [c.id, c]))
      if (existing.some((c) => c.noteId !== input.noteId)) throw Errors.conflict('A card with this id belongs to another note.', ['input', 'ops'])

      const results: CardOpResult[] = []
      const conflicted: SnapshotCard[] = []
      let created = 0
      for (const op of ops) {
        const card = byId.get(op.id)
        if (op.kind === 'UPSERT') {
          const data = { type: op.type!, position: op.position!, content: contents.get(op.id) as Prisma.InputJsonValue }
          if (!card) {
            await tx.card.create({ data: { id: op.id, noteId: input.noteId, ...data } })
            created++
            results.push({ id: op.id, status: 'APPLIED', revision: 1, message: null })
          } else if (card.deletedAt) {
            await tx.card.update({ where: { id: op.id }, data: { ...data, deletedAt: null, revision: card.revision + 1 } })
            created++
            results.push({ id: op.id, status: 'APPLIED', revision: card.revision + 1, message: 'This card had been deleted on another device; it is back.' })
          } else {
            const stale = op.baseRevision !== undefined && op.baseRevision !== null && card.revision > op.baseRevision
            if (stale) conflicted.push({ id: card.id, type: card.type, position: card.position, content: card.content, revision: card.revision })
            await tx.card.update({ where: { id: op.id }, data: { ...data, revision: card.revision + 1 } })
            results.push({ id: op.id, status: stale ? 'APPLIED_WITH_CONFLICT' : 'APPLIED', revision: card.revision + 1, message: stale ? 'This card was also changed on another device; that version is in the history.' : null })
          }
        } else if (op.kind === 'MOVE') {
          if (!card || card.deletedAt) {
            results.push({ id: op.id, status: 'REJECTED', revision: card?.revision ?? null, message: 'This card was deleted.' })
          } else {
            await tx.card.update({ where: { id: op.id }, data: { position: op.position! } })
            results.push({ id: op.id, status: 'APPLIED', revision: card.revision, message: null })
          }
        } else if (!card || card.deletedAt) {
          results.push({ id: op.id, status: 'APPLIED', revision: card?.revision ?? null, message: null })
        } else if (op.baseRevision !== undefined && op.baseRevision !== null && card.revision > op.baseRevision) {
          results.push({ id: op.id, status: 'REJECTED', revision: card.revision, message: 'This card was changed on another device, so it was not deleted.' })
        } else {
          await tx.card.update({ where: { id: op.id }, data: { deletedAt: new Date() } })
          results.push({ id: op.id, status: 'APPLIED', revision: card.revision, message: null })
        }
      }
      if (created && (await tx.card.count({ where: { noteId: input.noteId, deletedAt: null } })) > NOTE_LIMITS.cardsPerNote) {
        throw Errors.validation(`A note can have at most ${NOTE_LIMITS.cardsPerNote} cards.`, ['input', 'ops'])
      }

      let conflictVersionId: string | null = null
      if (conflicted.length) {
        conflictVersionId = await this.snapshot(tx, input.noteId, 'CONFLICT', opened.note.title, conflicted.sort(byPosition), viewerId)
      }
      if (input.tagNames) await this.organise.setTags(tx, viewerId, input.noteId, input.tagNames, ['input', 'tagNames'])
      if (topicIds) {
        await tx.noteTopic.deleteMany({ where: { noteId: input.noteId } })
        if (topicIds.length) await tx.noteTopic.createMany({ data: topicIds.map((topicId) => ({ noteId: input.noteId, topicId })) })
      }
      const changed = ops.length > 0 || title !== undefined || input.folderId !== undefined || !!input.tagNames || !!topicIds
      if (changed) {
        await tx.note.update({
          where: { id: input.noteId },
          data: {
            draftRevision: { increment: 1 },
            draftUpdatedAt: new Date(),
            ...(title ? { title: title.data } : {}),
            ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
          },
        })
      }
      return { results, conflictVersionId }
    })
    return { opened: (await this.notes.open(viewerId, input.noteId, opened.actor))!, ...outcome }
  }

  /** Snapshots the draft as the version readers see (§4.3). Owner only, with a verified account (§5). */
  async publish(ownerId: string, noteId: string): Promise<OpenedNote> {
    const opened = await this.notes.require(ownerId, noteId, 'owner')
    if (opened.note.deletedAt) throw Errors.validation('Restore the note from the trash first.')
    if (!can(opened.actor, Action.NOTE_PUBLISH, { kind: 'note', note: noteFacts(opened.note, null) })) {
      throw Errors.forbidden(opened.actor.institutionVerified ? 'You cannot publish this note.' : 'Verify your account to publish notes.')
    }
    const versionId = await this.db.$transaction(async (tx) => {
      await this.lock(tx, noteId)
      const note = await tx.note.findUniqueOrThrow({ where: { id: noteId } })
      const cards = await this.liveCards(tx, noteId)
      if (!cards.length && !note.title) throw Errors.validation('Add a title or some cards before publishing.')
      const id = await this.snapshot(tx, noteId, 'PUBLISHED', note.title, cards, ownerId)
      await tx.note.update({ where: { id: noteId }, data: { publishedVersionId: id, publishedAt: new Date(), slug: slugify(note.title) } })
      return id
    })
    // Search re-indexes from the outbox row the new published version left (ADR-0055).
    const note = opened.note
    if (note.visibility !== 'PUBLIC') {
      await this.events.publish('NotePublished', { noteId, versionId, ownerId, visibility: note.visibility, kind: note.kind })
    } else if (await this.moderation.screen(noteId)) {
      // ADR-0037: every version that reaches the public is screened.
      await this.events.publish('NotePublished', { noteId, versionId, ownerId, visibility: note.visibility, kind: note.kind })
    } else if (note.moderation === 'OK' && note.publishedVersionId) {
      // Held now, though the previous version was public: it leaves search and recommendations until reviewed.
      await this.events.publish('NoteUnpublished', { noteId, ownerId })
    }
    return (await this.notes.open(ownerId, noteId, opened.actor))!
  }

  /** Makes a version the draft again; the current draft is kept as a DRAFT version first, so nothing is lost. */
  async restoreVersion(viewerId: string, noteId: string, versionId: string): Promise<OpenedNote> {
    const opened = await this.notes.require(viewerId, noteId, 'edit')
    await this.db.$transaction(async (tx) => {
      await this.lock(tx, noteId)
      const version = await tx.noteVersion.findUnique({ where: { id: versionId } })
      if (!version || version.noteId !== noteId) throw Errors.notFound('Version not found.')
      const note = await tx.note.findUniqueOrThrow({ where: { id: noteId } })
      const current = await this.liveCards(tx, noteId)
      if (current.length || note.title) await this.snapshot(tx, noteId, 'DRAFT', note.title, current, viewerId)

      const target = version.cards as unknown as SnapshotCard[]
      const keep = new Set(target.map((c) => c.id))
      await tx.card.updateMany({ where: { noteId, deletedAt: null, id: { notIn: [...keep] } }, data: { deletedAt: new Date() } })
      const stored = await tx.card.findMany({ where: { id: { in: [...keep] } }, select: { id: true, revision: true } })
      const revisions = new Map(stored.map((c) => [c.id, c.revision]))
      for (const c of target) {
        const data = { type: c.type, position: c.position, content: c.content as Prisma.InputJsonValue, deletedAt: null }
        if (revisions.has(c.id)) await tx.card.update({ where: { id: c.id }, data: { ...data, revision: revisions.get(c.id)! + 1 } })
        else await tx.card.create({ data: { id: c.id, noteId, ...data } })
      }
      await tx.note.update({ where: { id: noteId }, data: { title: version.title, draftRevision: { increment: 1 }, draftUpdatedAt: new Date() } })
    })
    return (await this.notes.open(viewerId, noteId, opened.actor))!
  }

  // ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────

  /** The cards a viewer sees, in order: the draft for editors, the published version for readers. */
  async cards(opened: OpenedNote, first: number | null | undefined, after: string | null | undefined) {
    if (opened.access === 'READER') return this.versionCards(opened.note.publishedVersionId!, first, after)
    const size = pageSize(first, 50)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const rows = await this.db.card.findMany({
      where: { noteId: opened.note.id, deletedAt: null, ...(cursor ? { OR: [{ position: { gt: cursor[0] } }, { position: cursor[0], id: { gt: cursor[1] } }] } : {}) },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      take: size + 1,
    })
    return { rows: rows.map((c) => ({ id: c.id, type: c.type, position: c.position, content: c.content, revision: c.revision })), size, cursorOf: (c: SnapshotCard) => [c.position, c.id] as const }
  }

  async versionCards(versionId: string, first: number | null | undefined, after: string | null | undefined) {
    const size = pageSize(first, 50)
    const [start] = (decodeCursor(after, 1) as [number] | null) ?? [-1]
    const version = await this.db.noteVersion.findUniqueOrThrow({ where: { id: versionId }, select: { cards: true } })
    const all = (version.cards as unknown as SnapshotCard[]).map((c, i) => ({ ...c, index: i }))
    return { rows: all.slice(start + 1, start + 2 + size), size, cursorOf: (c: SnapshotCard & { index?: number }) => [c.index ?? 0] as const }
  }

  async cardCount(opened: OpenedNote): Promise<number> {
    if (opened.access === 'READER') return (await this.versionSnapshot(opened.note.publishedVersionId!)).length
    return this.db.card.count({ where: { noteId: opened.note.id, deletedAt: null } })
  }

  /**
   * The first words of several notes at once, for lists: the first card with text in each draft (owner and editors)
   * or published version (readers). One query for the drafts, whatever the number of notes.
   */
  async excerpts(notes: OpenedNote[]): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    const drafts = notes.filter((o) => o.access !== 'READER').map((o) => o.note.id)
    if (drafts.length) {
      const rows = await this.db.$queryRaw<{ noteId: string; type: CardType; content: unknown }[]>`
        SELECT DISTINCT ON ("noteId") "noteId", "type", "content" FROM "notes"."Card"
        WHERE "noteId" = ANY(${drafts}::uuid[]) AND "deletedAt" IS NULL AND "type" <> 'heading' AND "type" NOT IN ('image', 'video', 'audio', 'file')
        ORDER BY "noteId", "position", "id"`
      for (const r of rows) result.set(r.noteId, excerptOf(r.type, r.content))
    }
    for (const o of notes.filter((n) => n.access === 'READER')) {
      const first = (await this.versionSnapshot(o.note.publishedVersionId!)).find((c) => c.type !== 'heading' && cardPlainText(c.type, c.content).trim())
      result.set(o.note.id, first ? excerptOf(first.type, first.content) : '')
    }
    return result
  }

  /** The headings, for navigation (§6.3: metadata and outline first, cards after). */
  async outline(opened: OpenedNote) {
    const headings =
      opened.access === 'READER'
        ? (await this.versionSnapshot(opened.note.publishedVersionId!)).filter((c) => c.type === 'heading')
        : await this.db.card.findMany({ where: { noteId: opened.note.id, deletedAt: null, type: 'heading' }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })
    return headings.map((c) => {
      const content = c.content as { level?: number; content?: Parameters<typeof inlineText>[0] }
      return { cardId: c.id, level: content.level ?? 1, text: inlineText(content.content) }
    })
  }

  /** Version history, newest first: editors only. */
  async versions(opened: OpenedNote, first: number | null | undefined, after: string | null | undefined) {
    const size = pageSize(first)
    const cursor = decodeCursor(after, 1) as [number] | null
    const rows = await this.db.noteVersion.findMany({
      where: { noteId: opened.note.id, ...(cursor ? { number: { lt: cursor[0] } } : {}) },
      orderBy: { number: 'desc' },
      take: size + 1,
      select: { id: true, noteId: true, number: true, kind: true, title: true, createdById: true, createdAt: true },
    })
    return { rows, size }
  }

  async version(versionId: string) {
    return this.db.noteVersion.findUnique({ where: { id: versionId }, select: { id: true, noteId: true, number: true, kind: true, title: true, createdById: true, createdAt: true } })
  }

  private async versionSnapshot(versionId: string): Promise<SnapshotCard[]> {
    const version = await this.db.noteVersion.findUniqueOrThrow({ where: { id: versionId }, select: { cards: true } })
    return version.cards as unknown as SnapshotCard[]
  }

  // ── Internals ────────────────────────────────────────────────────────────────────────────────────────────

  /** Serialises saves, publishes and restores of one note. */
  private async lock(tx: Tx, noteId: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM "notes"."Note" WHERE "id" = ${noteId}::uuid FOR UPDATE`
  }

  private async liveCards(tx: Tx, noteId: string): Promise<SnapshotCard[]> {
    const rows = await tx.card.findMany({ where: { noteId, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })
    return rows.map((c) => ({ id: c.id, type: c.type, position: c.position, content: c.content, revision: c.revision }))
  }

  private async snapshot(tx: Tx, noteId: string, kind: 'PUBLISHED' | 'CONFLICT' | 'DRAFT', title: string, cards: SnapshotCard[], createdById: string): Promise<string> {
    const last = await tx.noteVersion.aggregate({ where: { noteId }, _max: { number: true } })
    const id = newId()
    await tx.noteVersion.create({ data: { id, noteId, number: (last._max.number ?? 0) + 1, kind, title, cards: cards as unknown as Prisma.InputJsonValue, createdById } })
    return id
  }
}

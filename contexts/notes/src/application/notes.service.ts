import { Inject, Injectable } from '@nestjs/common'
import { Action, can, type Actor, type CardType, type NoteKind } from '@lvn/contracts/domain'
import { cardAnchor, isValidPosition, MEDIA_CARD_TYPES, NOTE_LIMITS, noteTitleSchema, parseCardContent } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { POLICY, type Policy } from '@lvn-backend/facades'
import { decodeCursor, pageSize } from '@lvn-backend/graphql'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { noteAccess, type NoteAccess, type NoteAccessRow, visibleNotesWhere } from '../domain/note-access'
import { OrganiseService } from './organise.service'

export type NoteRow = Prisma.NoteGetPayload<object>

/** A note as one viewer sees it: the row, their access, their share role and who they are. */
export interface OpenedNote {
  note: NoteRow
  access: NoteAccess
  shareRole: 'EDITOR' | 'VIEWER' | null
  actor: Actor | null
}

export interface CardInput {
  id: string
  type: CardType
  position: string
  content: unknown
}

export interface NoteListFilter {
  folderId?: string | null
  unfiled?: boolean | null
  tagId?: string | null
  topicId?: string | null
  kind?: NoteRow['kind'] | null
  trashed?: boolean | null
}

/**
 * Checks one card from a client and returns its content as stored; `path` names it in the error. Media cards and
 * anchors need the note's attachments (AttachmentsService.assertUsable), so only saves to an existing note accept them.
 */
export function checkCard(card: CardInput, path: (string | number)[], opts: { media?: boolean } = {}): unknown {
  if (MEDIA_CARD_TYPES.has(card.type) && !opts.media) throw Errors.validation('Add pictures, video, audio and files once the note exists.', [...path.map(String), 'type'])
  if (!isValidPosition(card.position)) throw Errors.validation('This card position is not valid.', [...path.map(String), 'position'])
  const parsed = parseCardContent(card.type, card.content)
  if (!parsed.ok) throw Errors.validation(`This ${card.type} card is not valid: ${parsed.message}.`, [...path.map(String), 'content'])
  if (!opts.media && cardAnchor(parsed.content)) throw Errors.validation('Add cards from a PDF once the note exists.', [...path.map(String), 'content', 'anchor'])
  return parsed.content
}

/**
 * Notes as documents (§4.1, §4.5): opening one for a viewer, creating, listing the viewer's own, and the trash. The
 * draft and its versions are DraftsService; folders, tags and topics are OrganiseService.
 */
@Injectable()
export class NotesService {
  constructor(
    private readonly db: PrismaService,
    private readonly organise: OrganiseService,
    private readonly limiter: RateLimiter,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /** The actor for a viewer id; null for anonymous visitors. Throws for a signed-in id whose account is gone. */
  async actor(viewerId: string | null): Promise<Actor | null> {
    if (!viewerId) return null
    const actor = await this.policy.actor(viewerId)
    if (!actor) throw Errors.unauthenticated()
    return actor
  }

  /** The note as the viewer may see it, or null when they may not see it at all. */
  async open(viewerId: string | null, noteId: string, actor?: Actor | null): Promise<OpenedNote | null> {
    const note = await this.db.note.findUnique({ where: { id: noteId } })
    if (!note) return null
    const share = viewerId && viewerId !== note.ownerId ? await this.db.noteShare.findUnique({ where: { noteId_userId: { noteId, userId: viewerId } } }) : null
    const resolvedActor = actor === undefined ? await this.actor(viewerId) : actor
    const shareRole = share?.role ?? null
    const access = noteAccess(resolvedActor, note as NoteAccessRow, shareRole)
    return access ? { note, access, shareRole, actor: resolvedActor } : null
  }

  /** Like `open`, for a mutation: NOT_FOUND when invisible, FORBIDDEN when visible but not allowed. */
  async require(viewerId: string, noteId: string, need: 'edit' | 'owner'): Promise<OpenedNote & { actor: Actor }> {
    const opened = await this.open(viewerId, noteId)
    if (!opened) throw Errors.notFound('Note not found.')
    if (need === 'owner' && opened.access !== 'OWNER') throw Errors.forbidden('Only the owner can do that.')
    if (need === 'edit' && opened.access === 'READER') throw Errors.forbidden('You can read this note but not edit it.')
    if (opened.note.deletedAt && need === 'edit') throw Errors.validation('Restore the note from the trash first.')
    return opened as OpenedNote & { actor: Actor }
  }

  async create(ownerId: string, input: { id?: string | null; title?: string | null; folderId?: string | null; kind?: NoteRow['kind'] | null; cards?: CardInput[] | null; tagNames?: string[] | null; topicIds?: string[] | null }): Promise<OpenedNote> {
    const actor = await this.actor(ownerId)
    const kind = input.kind ?? 'NOTE'
    // Notes and projects for anyone, blogs and posts for teachers (ADR-0014, ADR-0015, ADR-0044).
    if (!can(actor, Action.NOTE_CREATE, { kind: 'newNote', noteKind: kind })) throw Errors.forbidden('Blogs and posts are for teachers.')
    const limit = await this.limiter.hit(`notes:create:${ownerId}`, { max: 300, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have created a lot of notes in the last hour. Try again later.')

    const title = noteTitleSchema.safeParse(input.title ?? '')
    if (!title.success) throw Errors.validation(title.error.issues[0]!.message, ['input', 'title'])
    const cards = input.cards ?? []
    if (cards.length > NOTE_LIMITS.cardsPerNote) throw Errors.validation(`A note can have at most ${NOTE_LIMITS.cardsPerNote} cards.`, ['input', 'cards'])
    const contents = cards.map((c, i) => checkCard(c, ['input', 'cards', i]))
    if (new Set(cards.map((c) => c.id)).size !== cards.length) throw Errors.validation('Two cards have the same id.', ['input', 'cards'])
    if (cards.length && (await this.db.card.count({ where: { id: { in: cards.map((c) => c.id) } } }))) throw Errors.conflict('A card with this id already exists.', ['input', 'cards'])
    if (input.folderId) await this.organise.assertOwnFolder(ownerId, input.folderId, ['input', 'folderId'])
    const topicIds = await this.organise.usableTopics(ownerId, input.topicIds ?? [], ['input', 'topicIds'])

    // Devices make the id of a note written offline (§13.2), so later changes can name it before it reaches us.
    const id = input.id ?? newId()
    if (input.id && (await this.db.note.count({ where: { id: input.id } }))) throw Errors.conflict('A note with this id already exists.', ['input', 'id'])
    await this.db.$transaction(async (tx) => {
      // Posts and projects start with copies off (ADR-0014); their owner can allow them.
      const forkingEnabled = kind !== 'POST' && kind !== 'PROJECT'
      await tx.note.create({ data: { id, ownerId, kind, title: title.data, folderId: input.folderId ?? null, draftRevision: cards.length ? 1 : 0, forkingEnabled } })
      if (cards.length) await tx.card.createMany({ data: cards.map((c, i) => ({ id: c.id, noteId: id, type: c.type, position: c.position, content: contents[i] as Prisma.InputJsonValue })) })
      if (input.tagNames?.length) await this.organise.setTags(tx, ownerId, id, input.tagNames, ['input', 'tagNames'])
      if (topicIds.length) await tx.noteTopic.createMany({ data: topicIds.map((topicId) => ({ noteId: id, topicId })) })
    })
    return (await this.open(ownerId, id, actor))!
  }

  /** The viewer's own notes, most recently edited first (or the trash). */
  async list(ownerId: string, filter: NoteListFilter | null | undefined, first: number | null | undefined, after: string | null | undefined) {
    const size = pageSize(first)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const where: Prisma.NoteWhereInput = {
      ownerId,
      deletedAt: filter?.trashed ? { not: null } : null,
      ...(filter?.folderId ? { folderId: filter.folderId } : filter?.unfiled ? { folderId: null } : {}),
      ...(filter?.tagId ? { tags: { some: { tagId: filter.tagId } } } : {}),
      ...(filter?.topicId ? { topics: { some: { topicId: filter.topicId } } } : {}),
      ...(filter?.kind ? { kind: filter.kind } : {}),
    }
    const rows = await this.db.note.findMany({
      where: cursor
        ? { AND: [where, { OR: [{ draftUpdatedAt: { lt: new Date(cursor[0]) } }, { draftUpdatedAt: new Date(cursor[0]), id: { lt: cursor[1] } }] }] }
        : where,
      orderBy: [{ draftUpdatedAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
    })
    return { rows, size }
  }

  /**
   * Notes anyone may read, newest published first: sitemaps and the public pages (P2d), and a person's profile by kind
   * (ADR-0043).
   */
  async publicList(first: number | null | undefined, after: string | null | undefined, only: { ownerId?: string; kind?: NoteKind | null } = {}) {
    const size = pageSize(first, 100)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const where = { AND: [visibleNotesWhere(null), ...(only.ownerId ? [{ ownerId: only.ownerId }] : []), ...(only.kind ? [{ kind: only.kind }] : [])] }
    const rows = await this.db.note.findMany({
      where: cursor ? { AND: [where, { OR: [{ publishedAt: { lt: new Date(cursor[0]) } }, { publishedAt: new Date(cursor[0]), id: { lt: cursor[1] } }] }] } : where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
    })
    return { rows, size }
  }

  /** Moves the note to the trash (§4.5); a public note leaves search and recommendations (NoteUnpublished). */
  async trash(ownerId: string, noteId: string): Promise<OpenedNote> {
    const { note } = await this.require(ownerId, noteId, 'owner')
    if (note.deletedAt) return (await this.open(ownerId, noteId))!
    await this.db.note.update({ where: { id: noteId }, data: { deletedAt: new Date() } })
    if (note.visibility === 'PUBLIC' && note.publishedVersionId) await this.events.publish('NoteUnpublished', { noteId, ownerId })
    return (await this.open(ownerId, noteId))!
  }

  async restore(ownerId: string, noteId: string): Promise<OpenedNote> {
    const { note } = await this.require(ownerId, noteId, 'owner')
    if (!note.deletedAt) return (await this.open(ownerId, noteId))!
    await this.db.note.update({ where: { id: noteId }, data: { deletedAt: null } })
    if (note.visibility === 'PUBLIC' && note.publishedVersionId) {
      await this.events.publish('NotePublished', { noteId, versionId: note.publishedVersionId, ownerId, visibility: note.visibility, kind: note.kind })
    }
    return (await this.open(ownerId, noteId))!
  }

  /**
   * Deletes a note in the trash for good: cards, versions, shares, tags, topics and its links to files go with it.
   * Returns the files it linked, for AttachmentsService.purgeUnlinked.
   */
  async destroy(ownerId: string, noteId: string): Promise<string[]> {
    const { note } = await this.require(ownerId, noteId, 'owner')
    if (!note.deletedAt) throw Errors.validation('Move the note to the trash first.')
    const linked = await this.db.noteAttachment.findMany({ where: { noteId }, select: { fileId: true } })
    await this.db.note.delete({ where: { id: noteId } })
    return linked.map((a) => a.fileId)
  }
}

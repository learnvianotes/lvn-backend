import { Inject, Injectable } from '@nestjs/common'
import { Action, can, type Visibility } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, PEOPLE, type Audit, type People } from '@lvn-backend/facades'
import { decodeCursor, pageSize } from '@lvn-backend/graphql'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { noteFacts, visibleNotesWhere } from '../domain/note-access'
import { AttachmentsService } from './attachments.service'
import { NoteModerationService } from './moderation.service'
import type { SnapshotCard } from '../domain/snapshot'
import { NotesService, type OpenedNote } from './notes.service'

const SHARES_PER_NOTE = 100

/**
 * Who can read a note (§4.2, §4.4, §5): its visibility, its user shares, forks with their credit (ADR-0010), and the
 * owner's switch for forking. Every change of visibility or shares goes to the audit log (§4.5).
 */
@Injectable()
export class SharingService {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    private readonly limiter: RateLimiter,
    private readonly attachments: AttachmentsService,
    private readonly moderation: NoteModerationService,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(AUDIT) private readonly audit: Audit,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /** PRIVATE ⇄ SHARED ⇄ PUBLIC (§4.2). PUBLIC needs a published version, a verified account and no minor restriction. */
  async changeVisibility(ownerId: string, noteId: string, visibility: Visibility): Promise<OpenedNote> {
    const opened = await this.notes.require(ownerId, noteId, 'owner')
    const { note, actor } = opened
    if (note.deletedAt) throw Errors.validation('Restore the note from the trash first.')
    if (note.visibility === visibility) return opened
    if (!can(actor, Action.NOTE_CHANGE_VISIBILITY, { kind: 'note', note: noteFacts(note, null), targetVisibility: visibility })) {
      if (!actor.institutionVerified) throw Errors.forbidden('Verify your account to share notes.')
      if (visibility === 'PUBLIC' && actor.restrictedMinor) throw Errors.forbidden('Your account cannot make notes public.')
      if (visibility === 'PUBLIC' && note.forkedFromVisibility) throw Errors.forbidden('This note is a copy of a note that was not public, so it cannot be made public.')
      throw Errors.forbidden()
    }
    if (visibility === 'PUBLIC' && !note.publishedVersionId) throw Errors.validation('Publish the note first: readers see the published version.', ['input', 'visibility'])
    if (visibility === 'PUBLIC' && (note.moderation === 'HIDDEN' || note.moderation === 'REMOVED')) {
      throw Errors.forbidden('Moderators took this note off the public pages. You can appeal from the note.')
    }
    await this.db.note.update({ where: { id: noteId }, data: { visibility } })
    await this.audit.record({ actorId: ownerId, action: 'note.visibility', targetType: 'NOTE', targetId: noteId, metadata: { from: note.visibility, to: visibility } })
    if (visibility === 'PUBLIC') {
      // ADR-0037: the published version is screened first; a held note waits for a moderator.
      if (await this.moderation.screen(noteId)) await this.events.publish('NotePublished', { noteId, versionId: note.publishedVersionId!, ownerId, visibility, kind: note.kind })
    } else if (note.visibility === 'PUBLIC') {
      // §4.2: leaving PUBLIC removes the note from search and recommendations (the listeners act on this).
      await this.events.publish('NoteUnpublished', { noteId, ownerId })
    }
    return (await this.notes.open(ownerId, noteId, actor))!
  }

  /** Shares with one person, or changes their role; a PRIVATE note becomes SHARED (share rows grant nothing on PRIVATE). */
  async share(ownerId: string, noteId: string, personQuery: string, role: 'EDITOR' | 'VIEWER'): Promise<OpenedNote> {
    const opened = await this.notes.require(ownerId, noteId, 'owner')
    const { note, actor } = opened
    if (note.deletedAt) throw Errors.validation('Restore the note from the trash first.')
    const person = await this.people.find(personQuery)
    if (!person) throw Errors.validation('Nobody on LearnViaNotes has that handle or email.', ['input', 'person'])
    if (person.id === ownerId) throw Errors.validation('This is your own note.', ['input', 'person'])
    const target = { kind: 'USER' as const, recipientIsTeacher: person.globalRole === 'TEACHER' }
    if (!can(actor, Action.NOTE_SHARE, { kind: 'note', note: noteFacts(note, null), shareTarget: target })) {
      if (!actor.institutionVerified) throw Errors.forbidden('Verify your account to share notes.')
      throw Errors.forbidden('Teachers share with other teachers once they are connected.')
    }
    const limit = await this.limiter.hit(`notes:share:${ownerId}`, { max: 200, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have shared a lot in the last hour. Try again later.')
    const existing = await this.db.noteShare.findUnique({ where: { noteId_userId: { noteId, userId: person.id } } })
    if (!existing && (await this.db.noteShare.count({ where: { noteId } })) >= SHARES_PER_NOTE) throw Errors.validation(`A note can be shared with at most ${SHARES_PER_NOTE} people.`)

    await this.db.$transaction(async (tx) => {
      await tx.noteShare.upsert({ where: { noteId_userId: { noteId, userId: person.id } }, create: { noteId, userId: person.id, role, createdById: ownerId }, update: { role } })
      // The note counts as changed (updatedAt), so the devices of the person it is shared with pick it up (§13.2).
      await tx.note.update({ where: { id: noteId }, data: { updatedAt: new Date(), ...(note.visibility === 'PRIVATE' ? { visibility: 'SHARED' as const } : {}) } })
    })
    await this.audit.record({ actorId: ownerId, action: existing ? 'note.share.role' : 'note.share', targetType: 'NOTE', targetId: noteId, metadata: { userId: person.id, role } })
    if (note.visibility === 'PRIVATE') await this.audit.record({ actorId: ownerId, action: 'note.visibility', targetType: 'NOTE', targetId: noteId, metadata: { from: 'PRIVATE', to: 'SHARED' } })
    if (!existing) await this.events.publish('NoteShared', { noteId, target: { kind: 'USER', userId: person.id } })
    return (await this.notes.open(ownerId, noteId, actor))!
  }

  async unshare(ownerId: string, noteId: string, userId: string): Promise<OpenedNote> {
    const { actor } = await this.notes.require(ownerId, noteId, 'owner')
    const { count } = await this.db.noteShare.deleteMany({ where: { noteId, userId } })
    if (count) await this.audit.record({ actorId: ownerId, action: 'note.unshare', targetType: 'NOTE', targetId: noteId, metadata: { userId } })
    return (await this.notes.open(ownerId, noteId, actor))!
  }

  /** The people a note is shared with (the owner sees them; nobody else). */
  shares(noteId: string) {
    return this.db.noteShare.findMany({ where: { noteId }, orderBy: { createdAt: 'asc' } })
  }

  /** Notes other people shared with the viewer that the viewer can open now, most recently changed first. */
  async sharedWithMe(viewerId: string, first: number | null | undefined, after: string | null | undefined) {
    const size = pageSize(first)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const where: Prisma.NoteWhereInput = { AND: [visibleNotesWhere(viewerId), { shares: { some: { userId: viewerId } } }, { ownerId: { not: viewerId } }] }
    const rows = await this.db.note.findMany({
      where: cursor ? { AND: [where, { OR: [{ updatedAt: { lt: new Date(cursor[0]) } }, { updatedAt: new Date(cursor[0]), id: { lt: cursor[1] } }] }] } : where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
      include: { shares: { where: { userId: viewerId } } },
    })
    return { rows, size }
  }

  /**
   * A PRIVATE copy of a note the viewer may fork (§4.4): the published version's cards (an owner or editor without a
   * published version copies the draft), with new card ids, and a credit to the origin that the copy keeps for ever.
   */
  async fork(viewerId: string, noteId: string): Promise<OpenedNote> {
    const opened = await this.notes.open(viewerId, noteId)
    if (!opened) throw Errors.notFound('Note not found.')
    const { note, actor, access, shareRole } = opened
    if (!actor || !can(actor, Action.NOTE_FORK, { kind: 'note', note: noteFacts(note, shareRole) })) throw Errors.forbidden('The owner does not allow copies of this note.')
    if (note.deletedAt) throw Errors.validation('Restore the note from the trash first.')
    const limit = await this.limiter.hit(`notes:fork:${viewerId}`, { max: 100, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have copied a lot of notes in the last hour. Try again later.')

    // The published version when there is one; an owner or editor of a never-published note copies the draft.
    const usedVersion = note.publishedVersionId
    let cards: SnapshotCard[]
    let title = note.title
    if (usedVersion) {
      const version = await this.db.noteVersion.findUniqueOrThrow({ where: { id: usedVersion } })
      cards = version.cards as unknown as SnapshotCard[]
      title = version.title
    } else {
      const live = await this.db.card.findMany({ where: { noteId, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })
      cards = live.map((c) => ({ id: c.id, type: c.type, position: c.position, content: c.content, revision: c.revision }))
    }
    const topics = await this.db.noteTopic.findMany({ where: { noteId, topic: { origin: 'CURATED' } }, select: { topicId: true } })

    const id = newId()
    await this.db.$transaction(async (tx) => {
      await tx.note.create({
        data: {
          id,
          ownerId: viewerId,
          title,
          draftRevision: cards.length ? 1 : 0,
          forkedFromNoteId: noteId,
          forkedFromVersionId: usedVersion,
          forkedFromOwnerId: note.ownerId,
          forkedFromVisibility: note.visibility,
          forkedAsRole: access,
        },
      })
      if (cards.length) await tx.card.createMany({ data: cards.map((c) => ({ id: newId(), noteId: id, type: c.type, position: c.position, content: c.content as Prisma.InputJsonValue })) })
      if (topics.length) await tx.noteTopic.createMany({ data: topics.map((t) => ({ noteId: id, topicId: t.topicId })) })
      await this.attachments.carryOver(tx, noteId, id, cards)
    })
    if (usedVersion) await this.events.publish('NoteForked', { noteId: id, forkedFromNoteId: noteId, forkedFromVersionId: usedVersion, ownerId: viewerId })
    return (await this.notes.open(viewerId, id, actor))!
  }

  async setForking(ownerId: string, noteId: string, enabled: boolean): Promise<OpenedNote> {
    const { actor } = await this.notes.require(ownerId, noteId, 'owner')
    await this.db.note.update({ where: { id: noteId }, data: { forkingEnabled: enabled } })
    return (await this.notes.open(ownerId, noteId, actor))!
  }
}

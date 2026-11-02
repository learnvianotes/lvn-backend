import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { Action, can, verificationBlocks } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, type Audit } from '@lvn-backend/facades'
import { decodeCursor, pageSize } from '@lvn-backend/graphql'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { noteFacts, visibleNotesWhere } from '../domain/note-access'
import { NotesService, type OpenedNote } from './notes.service'

/**
 * Notes shared to groups (§4.2, ADR-0045). `notes` keeps its own copy of which groups exist and who is in them, fed
 * by core's events, so the read predicate can say "shared to a group the viewer is in" without reading core.
 */
@Injectable()
export class GroupSharesService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(AUDIT) private readonly audit: Audit,
  ) {}

  onModuleInit(): void {
    // Each handler makes sure the group is there: events of one group may be handled at the same time, in any order,
    // so the row is inserted with ON CONFLICT DO NOTHING rather than upserted (Prisma's upsert reads, then inserts).
    const group = (id: string) => this.db.groupRead.createMany({ data: [{ id }], skipDuplicates: true })
    this.events.subscribe('GroupCreated', async ({ payload }) => {
      await group(payload.groupId)
    })
    this.events.subscribe('GroupDeleted', async ({ payload }) => {
      await group(payload.groupId)
      await this.db.groupRead.update({ where: { id: payload.groupId }, data: { deletedAt: new Date() } })
    })
    // Moderators put a removed group back (ADR-0053): its members read its notes again.
    this.events.subscribe('GroupRestored', async ({ payload }) => {
      await group(payload.groupId)
      await this.db.groupRead.update({ where: { id: payload.groupId }, data: { deletedAt: null } })
    })
    this.events.subscribe('GroupMembershipChanged', async ({ payload }) => {
      await group(payload.groupId)
      if (payload.change === 'LEFT') await this.db.groupMemberRead.deleteMany({ where: { groupId: payload.groupId, userId: payload.userId } })
      else await this.db.groupMemberRead.createMany({ data: [{ groupId: payload.groupId, userId: payload.userId }], skipDuplicates: true })
    })
  }

  private async isMember(userId: string, groupId: string): Promise<boolean> {
    return (await this.db.groupMemberRead.count({ where: { groupId, userId, group: { deletedAt: null } } })) > 0
  }

  /** The owner shares their note with a group they are in; a PRIVATE note becomes SHARED (§4.2). */
  async share(ownerId: string, noteId: string, groupId: string): Promise<OpenedNote> {
    const { note, actor } = await this.notes.require(ownerId, noteId, 'owner')
    if (note.deletedAt) throw Errors.validation('Restore the note from the trash first.')
    if (!(await this.isMember(ownerId, groupId))) throw Errors.forbidden('Share notes only with groups you are in.')
    const shareResource = { kind: 'note' as const, note: noteFacts(note, null), shareTarget: { kind: 'GROUP' as const } }
    if (!can(actor, Action.NOTE_SHARE, shareResource)) throw Errors.forbidden(verificationBlocks(actor, Action.NOTE_SHARE, shareResource) ? 'Verify your account to share notes.' : undefined)
    const existing = await this.db.groupShare.findUnique({ where: { noteId_groupId: { noteId, groupId } } })
    if (!existing) {
      await this.db.$transaction(async (tx) => {
        await tx.groupShare.create({ data: { noteId, groupId, sharedById: ownerId } })
        await tx.note.update({ where: { id: noteId }, data: { updatedAt: new Date(), ...(note.visibility === 'PRIVATE' ? { visibility: 'SHARED' as const } : {}) } })
      })
      await this.audit.record({ actorId: ownerId, action: 'note.share.group', targetType: 'NOTE', targetId: noteId, metadata: { groupId } })
      await this.events.publish('NoteShared', { noteId, sharedBy: ownerId, target: { kind: 'GROUP', groupId } })
    }
    return (await this.notes.open(ownerId, noteId, actor))!
  }

  async unshare(ownerId: string, noteId: string, groupId: string): Promise<OpenedNote> {
    const { actor } = await this.notes.require(ownerId, noteId, 'owner')
    const { count } = await this.db.groupShare.deleteMany({ where: { noteId, groupId } })
    if (count) await this.audit.record({ actorId: ownerId, action: 'note.unshare.group', targetType: 'NOTE', targetId: noteId, metadata: { groupId } })
    return (await this.notes.open(ownerId, noteId, actor))!
  }

  /** The groups a note is shared to (its owner sees them). */
  async groupsOf(noteId: string): Promise<string[]> {
    return (await this.db.groupShare.findMany({ where: { noteId, group: { deletedAt: null } }, orderBy: { createdAt: 'asc' }, select: { groupId: true } })).map((s) => s.groupId)
  }

  /** What members read in a group: notes shared to it that they may open, the most recently shared first. */
  async shared(viewerId: string, groupId: string, first: number | null | undefined, after: string | null | undefined) {
    if (!(await this.isMember(viewerId, groupId))) return null
    const size = pageSize(first)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const where: Prisma.GroupShareWhereInput = {
      groupId,
      note: visibleNotesWhere(viewerId),
      ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor[0]) } }, { createdAt: new Date(cursor[0]), noteId: { lt: cursor[1] } }] } : {}),
    }
    const rows = await this.db.groupShare.findMany({ where, include: { note: true }, orderBy: [{ createdAt: 'desc' }, { noteId: 'desc' }], take: size + 1 })
    return { rows, size }
  }
}

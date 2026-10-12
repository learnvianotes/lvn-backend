import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { Action, can } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, type Audit } from '@lvn-backend/facades'
import { decodeCursor, pageSize } from '@lvn-backend/graphql'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { noteFacts, visibleNotesWhere } from '../domain/note-access'
import { NotesService, type OpenedNote } from './notes.service'

const STAFF = ['TEACHER', 'TA']

/**
 * Notes shared to classes (§4.2, ADR-0046). As for groups (ADR-0045), `notes` keeps its own copy of which classes
 * exist and who is in them with which role, fed by core's events: the read predicate reads it, and so does
 * co-teaching for teacher-to-teacher sharing (ADR-0013).
 */
@Injectable()
export class ClassroomSharesService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(AUDIT) private readonly audit: Audit,
  ) {}

  onModuleInit(): void {
    // Events of one class may be handled at the same time and in any order: insert-if-missing, never upsert.
    const classroom = (id: string) => this.db.classroomRead.createMany({ data: [{ id }], skipDuplicates: true })
    this.events.subscribe('ClassroomCreated', async ({ payload }) => {
      await classroom(payload.classroomId)
    })
    this.events.subscribe('ClassroomDeleted', async ({ payload }) => {
      await classroom(payload.classroomId)
      await this.db.classroomRead.update({ where: { id: payload.classroomId }, data: { deletedAt: new Date() } })
    })
    this.events.subscribe('ClassroomMembershipChanged', async ({ payload }) => {
      const { classroomId, userId } = payload
      await classroom(classroomId)
      if (payload.change === 'LEFT') {
        await this.db.classroomMemberRead.deleteMany({ where: { classroomId, userId } })
        return
      }
      const role = payload.role ?? 'STUDENT'
      await this.db.classroomMemberRead.createMany({ data: [{ classroomId, userId, role }], skipDuplicates: true })
      if (payload.change === 'ROLE_CHANGED') await this.db.classroomMemberRead.updateMany({ where: { classroomId, userId }, data: { role } })
    })
  }

  private async role(userId: string, classroomId: string): Promise<string | null> {
    const m = await this.db.classroomMemberRead.findFirst({ where: { classroomId, userId, classroom: { deletedAt: null } }, select: { role: true } })
    return m?.role ?? null
  }

  /** Staff share their own notes to their class; a PRIVATE note becomes SHARED (§4.2). */
  async share(ownerId: string, noteId: string, classroomId: string): Promise<OpenedNote> {
    const { note, actor } = await this.notes.require(ownerId, noteId, 'owner')
    if (note.deletedAt) throw Errors.validation('Restore the note from the trash first.')
    const role = await this.role(ownerId, classroomId)
    if (!role) throw Errors.notFound('Class not found.')
    if (!STAFF.includes(role)) throw Errors.forbidden('The class’s teacher and TAs share notes with it.')
    if (!can(actor, Action.NOTE_SHARE, { kind: 'note', note: noteFacts(note, null), shareTarget: { kind: 'CLASSROOM' } })) throw Errors.forbidden('Verify your account to share notes.')
    const existing = await this.db.classroomShare.findUnique({ where: { noteId_classroomId: { noteId, classroomId } } })
    if (!existing) {
      await this.db.$transaction(async (tx) => {
        await tx.classroomShare.create({ data: { noteId, classroomId, sharedById: ownerId } })
        await tx.note.update({ where: { id: noteId }, data: { updatedAt: new Date(), ...(note.visibility === 'PRIVATE' ? { visibility: 'SHARED' as const } : {}) } })
      })
      await this.audit.record({ actorId: ownerId, action: 'note.share.classroom', targetType: 'NOTE', targetId: noteId, metadata: { classroomId } })
      await this.events.publish('NoteShared', { noteId, sharedBy: ownerId, target: { kind: 'CLASSROOM', classroomId } })
    }
    return (await this.notes.open(ownerId, noteId, actor))!
  }

  async unshare(ownerId: string, noteId: string, classroomId: string): Promise<OpenedNote> {
    const { actor } = await this.notes.require(ownerId, noteId, 'owner')
    const { count } = await this.db.classroomShare.deleteMany({ where: { noteId, classroomId } })
    if (count) await this.audit.record({ actorId: ownerId, action: 'note.unshare.classroom', targetType: 'NOTE', targetId: noteId, metadata: { classroomId } })
    return (await this.notes.open(ownerId, noteId, actor))!
  }

  /** The classes a note is shared to (its owner sees them). */
  async classroomsOf(noteId: string): Promise<string[]> {
    return (await this.db.classroomShare.findMany({ where: { noteId, classroom: { deletedAt: null } }, orderBy: { createdAt: 'asc' }, select: { classroomId: true } })).map((s) => s.classroomId)
  }

  /** What members read in a class: notes shared to it that they may open, the most recently shared first. */
  async shared(viewerId: string, classroomId: string, first: number | null | undefined, after: string | null | undefined) {
    if (!(await this.role(viewerId, classroomId))) return null
    const size = pageSize(first)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const where: Prisma.ClassroomShareWhereInput = {
      classroomId,
      note: visibleNotesWhere(viewerId),
      ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor[0]) } }, { createdAt: new Date(cursor[0]), noteId: { lt: cursor[1] } }] } : {}),
    }
    const rows = await this.db.classroomShare.findMany({ where, include: { note: true }, orderBy: [{ createdAt: 'desc' }, { noteId: 'desc' }], take: size + 1 })
    return { rows, size }
  }
}

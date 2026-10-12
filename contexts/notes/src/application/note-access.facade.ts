import { Injectable } from '@nestjs/common'
import { Action, can } from '@lvn/contracts/domain'
import type { NoteAccess, NoteReach, PlaceShare } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { noteFacts, visibleNotesWhere, type NoteAccessRow } from '../domain/note-access'
import { NotesService } from './notes.service'

/** The NOTE_ACCESS facade (libs/facades, ADR-0047): the read rule and `note.comment`, for comments kept in `core`. */
@Injectable()
export class NoteAccessFacade implements NoteAccess {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
  ) {}

  async reach(viewerId: string, noteId: string): Promise<NoteReach | null> {
    const opened = await this.notes.open(viewerId, noteId)
    if (!opened || opened.note.deletedAt) return null
    const { note, access, shareRole, actor, reach } = opened
    return {
      noteId,
      ownerId: note.ownerId,
      visibility: note.visibility,
      access,
      canComment: can(actor, Action.NOTE_COMMENT, { kind: 'note', note: noteFacts(note as NoteAccessRow, shareRole, reach) }),
    }
  }

  async showcaseProblem(noteId: string, groupId: string): Promise<string | null> {
    const note = await this.db.note.findUnique({ where: { id: noteId }, select: { kind: true, visibility: true, publishedVersionId: true, moderation: true, deletedAt: true } })
    if (!note || note.deletedAt) return 'That note is not there any more.'
    if (!(await this.db.groupShare.count({ where: { noteId, groupId } }))) return 'Share the note with the workspace first.'
    if (note.kind !== 'PROJECT') return 'The showcase is a project note.'
    if (note.visibility !== 'PUBLIC' || !note.publishedVersionId || note.moderation !== 'OK') return 'The showcase is a published public note.'
    return null
  }

  async placeShares(viewerId: string, places: { groupIds: string[]; classroomIds: string[] }, before: { at: Date; id: string } | null, take: number): Promise<PlaceShare[]> {
    const page = before ? { OR: [{ createdAt: { lt: before.at } }, { createdAt: before.at, noteId: { lt: before.id } }] } : {}
    const readable = visibleNotesWhere(viewerId)
    const order = [{ createdAt: 'desc' as const }, { noteId: 'desc' as const }]
    const [groups, classes] = await Promise.all([
      places.groupIds.length ? this.db.groupShare.findMany({ where: { groupId: { in: places.groupIds }, note: readable, ...page }, orderBy: order, take }) : [],
      places.classroomIds.length ? this.db.classroomShare.findMany({ where: { classroomId: { in: places.classroomIds }, note: readable, ...page }, orderBy: order, take }) : [],
    ])
    return [
      ...groups.map((s) => ({ noteId: s.noteId, sharedBy: s.sharedById, at: s.createdAt, groupId: s.groupId, classroomId: null })),
      ...classes.map((s) => ({ noteId: s.noteId, sharedBy: s.sharedById, at: s.createdAt, groupId: null, classroomId: s.classroomId })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime() || (a.noteId < b.noteId ? 1 : -1))
      .slice(0, take)
  }

  async hasCard(noteId: string, cardId: string): Promise<boolean> {
    if (await this.db.card.count({ where: { id: cardId, noteId, deletedAt: null } })) return true
    const note = await this.db.note.findUnique({ where: { id: noteId }, select: { publishedVersion: { select: { cards: true } } } })
    const cards = (note?.publishedVersion?.cards ?? []) as { id?: string }[]
    return cards.some((c) => c.id === cardId)
  }
}

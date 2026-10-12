import { Injectable } from '@nestjs/common'
import { Action, can } from '@lvn/contracts/domain'
import type { NoteAccess, NoteReach } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { noteFacts, type NoteAccessRow } from '../domain/note-access'
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

  async hasCard(noteId: string, cardId: string): Promise<boolean> {
    if (await this.db.card.count({ where: { id: cardId, noteId, deletedAt: null } })) return true
    const note = await this.db.note.findUnique({ where: { id: noteId }, select: { publishedVersion: { select: { cards: true } } } })
    const cards = (note?.publishedVersion?.cards ?? []) as { id?: string }[]
    return cards.some((c) => c.id === cardId)
  }
}

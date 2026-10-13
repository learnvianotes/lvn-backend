import { Injectable } from '@nestjs/common'
import { Action, can, type CardType } from '@lvn/contracts/domain'
import { cardPlainText, positionsBetween } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import type { NewCard, NoteAi, NoteAiSource } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { noteFacts, visibleNotesWhere, type NoteAccessRow } from '../domain/note-access'
import type { SnapshotCard } from '../domain/snapshot'
import { DraftsService } from './drafts.service'
import { NotesService } from './notes.service'

/**
 * The NOTE_AI facade (libs/facades, ADR-0059): what the `ai` context may read of a note for one person, and how cards
 * it made are kept. Reading follows the read rule (a reader gets the published version); appending goes through the
 * normal save (`note.editDraft`, card validation); a new note with a copy's credit follows the fork rule.
 */
@Injectable()
export class NoteAiFacade implements NoteAi {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    private readonly drafts: DraftsService,
  ) {}

  async source(viewerId: string, noteId: string): Promise<NoteAiSource | null> {
    const opened = await this.notes.open(viewerId, noteId)
    if (!opened || opened.note.deletedAt) return null
    const { note, access, shareRole, actor, reach } = opened
    const facts = noteFacts(note as NoteAccessRow, shareRole, reach)
    let title = note.title
    let versionId: string | null = null
    let cards: { id: string; type: CardType; content: unknown }[]
    if (access === 'READER') {
      const version = await this.db.noteVersion.findUniqueOrThrow({ where: { id: note.publishedVersionId! } })
      title = version.title
      versionId = version.id
      cards = (version.cards as unknown as SnapshotCard[]).map((c) => ({ id: c.id, type: c.type as CardType, content: c.content }))
    } else {
      cards = (await this.db.card.findMany({ where: { noteId, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })).map((c) => ({ id: c.id, type: c.type as CardType, content: c.content }))
    }
    return {
      noteId,
      ownerId: note.ownerId,
      title,
      kind: note.kind,
      visibility: note.visibility,
      access,
      versionId,
      mayAskAi: can(actor, Action.NOTE_ASK_AI, { kind: 'note', note: facts }),
      mayFork: can(actor, Action.NOTE_FORK, { kind: 'note', note: facts }),
      canEdit: access !== 'READER',
      cards: cards.map((c) => ({ ...c, text: cardPlainText(c.type, c.content) })),
    }
  }

  async publicSource(noteId: string): Promise<NoteAiSource | null> {
    // The read predicate's public branch (visibleNotesWhere(null)): what a visitor who is not signed in reads.
    const note = await this.db.note.findFirst({ where: { id: noteId, ...visibleNotesWhere(null) }, select: { ownerId: true, kind: true, visibility: true, publishedVersion: { select: { id: true, title: true, cards: true } } } })
    const version = note?.publishedVersion
    if (!note || !version) return null
    const cards = (version.cards as unknown as SnapshotCard[]).map((c) => ({ id: c.id, type: c.type as CardType, content: c.content }))
    return {
      noteId,
      ownerId: note.ownerId,
      title: version.title,
      kind: note.kind,
      visibility: note.visibility,
      access: 'READER',
      versionId: version.id,
      mayAskAi: true,
      mayFork: false,
      canEdit: false,
      cards: cards.map((c) => ({ ...c, text: cardPlainText(c.type, c.content) })),
    }
  }

  async appendCards(viewerId: string, noteId: string, cards: NewCard[]): Promise<void> {
    const last = await this.db.card.findFirst({ where: { noteId, deletedAt: null }, orderBy: [{ position: 'desc' }, { id: 'desc' }], select: { position: true } })
    const positions = positionsBetween(last?.position ?? null, null, cards.length)
    const { results } = await this.drafts.update(viewerId, { noteId, ops: cards.map((c, i) => ({ kind: 'UPSERT' as const, id: newId(), type: c.type, position: positions[i]!, content: c.content })) })
    const rejected = results.find((r) => r.status === 'REJECTED')
    if (rejected) throw Errors.validation(rejected.message ?? 'A card could not be added.')
  }

  async createNote(ownerId: string, input: { title: string; cards: NewCard[]; copiedFrom?: string | null }): Promise<string> {
    let credit: { forkedFromNoteId: string; forkedFromVersionId: string | null; forkedFromOwnerId: string; forkedFromVisibility: NoteAccessRow['visibility']; forkedAsRole: 'OWNER' | 'EDITOR' | 'READER' } | null = null
    if (input.copiedFrom) {
      const opened = await this.notes.open(ownerId, input.copiedFrom)
      if (!opened) throw Errors.notFound('Note not found.')
      if (!can(opened.actor, Action.NOTE_FORK, { kind: 'note', note: noteFacts(opened.note as NoteAccessRow, opened.shareRole, opened.reach) })) throw Errors.forbidden('The owner does not allow copies of this note.')
      credit = { forkedFromNoteId: opened.note.id, forkedFromVersionId: opened.note.publishedVersionId, forkedFromOwnerId: opened.note.ownerId, forkedFromVisibility: opened.note.visibility, forkedAsRole: opened.access }
    }
    const positions = positionsBetween(null, null, input.cards.length)
    const created = await this.notes.create(ownerId, { title: input.title, cards: input.cards.map((c, i) => ({ id: newId(), type: c.type, position: positions[i]!, content: c.content })) })
    if (credit) await this.db.note.update({ where: { id: created.note.id }, data: credit })
    return created.note.id
  }
}

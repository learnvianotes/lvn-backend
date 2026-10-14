import { Injectable } from '@nestjs/common'
import { Action, can } from '@lvn/contracts/domain'
import type { NoteAccess, NoteReach, PlaceShare, PublicTopicNote, PublicTopicPage, ReadableNote, StudyCard } from '@lvn-backend/facades'
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

  async studyCards(viewerId: string, chosenNoteIds: string[]): Promise<StudyCard[]> {
    // Owners and editors study the draft.
    const editing = await this.db.note.findMany({
      where: { deletedAt: null, OR: [{ ownerId: viewerId }, { shares: { some: { userId: viewerId, role: 'EDITOR' } } }] },
      select: { id: true, title: true },
    })
    const mine = new Set(editing.map((n) => n.id))
    const titles = new Map(editing.map((n) => [n.id, n.title]))
    const drafts = await this.db.card.findMany({ where: { noteId: { in: [...mine] }, type: 'flashcard' }, orderBy: [{ noteId: 'asc' }, { position: 'asc' }] })
    const out: StudyCard[] = drafts.map((c) => {
      const content = c.content as { front?: unknown; back?: unknown }
      return { noteId: c.noteId, noteTitle: titles.get(c.noteId) ?? '', cardId: c.id, front: content.front, back: content.back }
    })
    // Readers study the published version of a note they can read.
    const others = chosenNoteIds.filter((id) => !mine.has(id))
    if (others.length) {
      const readable = await this.db.note.findMany({
        where: { AND: [visibleNotesWhere(viewerId), { id: { in: others }, deletedAt: null, publishedVersionId: { not: null } }] },
        select: { id: true, publishedVersion: { select: { title: true, cards: true } } },
      })
      for (const n of readable) {
        const cards = (n.publishedVersion!.cards as { id: string; type: string; content: { front?: unknown; back?: unknown } }[]).filter((c) => c.type === 'flashcard')
        for (const c of cards) out.push({ noteId: n.id, noteTitle: n.publishedVersion!.title, cardId: c.id, front: c.content.front, back: c.content.back })
      }
    }
    return out
  }

  async readable(viewerId: string, noteIds: string[]): Promise<ReadableNote[]> {
    if (!noteIds.length) return []
    const rows = await this.db.note.findMany({
      where: { AND: [visibleNotesWhere(viewerId), { id: { in: noteIds } }] },
      select: { id: true, ownerId: true, title: true, visibility: true, shares: { where: { userId: viewerId }, select: { role: true } }, publishedVersion: { select: { title: true } } },
    })
    const byId = new Map(rows.map((n) => [n.id, n]))
    return noteIds.flatMap((id) => {
      const n = byId.get(id)
      if (!n) return []
      // Owners and editors see the draft's title; everyone else the published one.
      const drafts = n.ownerId === viewerId || n.shares.some((s) => s.role === 'EDITOR')
      return [{ noteId: n.id, ownerId: n.ownerId, visibility: n.visibility, title: drafts ? n.title : (n.publishedVersion?.title ?? n.title) }]
    })
  }

  async publicOnTopics(viewerId: string, topicIds: string[], options: { withQuiz?: boolean; take: number }): Promise<PublicTopicNote[]> {
    if (!topicIds.length) return []
    const rows = await this.db.note.findMany({
      where: { AND: [visibleNotesWhere(null), { ownerId: { not: viewerId }, topics: { some: { topicId: { in: topicIds } } } }] },
      select: { id: true, publishedAt: true, topics: { select: { topicId: true } }, publishedVersion: { select: { title: true, cards: options.withQuiz ?? false } } },
      orderBy: { publishedAt: 'desc' },
      take: options.withQuiz ? options.take * 5 : options.take,
    })
    return rows
      .filter((n) => !options.withQuiz || ((n.publishedVersion?.cards ?? []) as { type: string }[]).some((c) => c.type === 'quiz'))
      .slice(0, options.take)
      .map((n) => ({ noteId: n.id, title: n.publishedVersion?.title ?? '', topicIds: n.topics.map((t) => t.topicId) }))
  }

  async publicOnTopicsPage(viewerId: string, topicIds: string[], excludeOwners: string[], before: { at: Date; id: string } | null, take: number): Promise<PublicTopicPage[]> {
    if (!topicIds.length) return []
    const rows = await this.db.note.findMany({
      where: {
        AND: [
          visibleNotesWhere(null),
          { ownerId: { notIn: [viewerId, ...excludeOwners] }, topics: { some: { topicId: { in: topicIds } } } },
          ...(before ? [{ OR: [{ publishedAt: { lt: before.at } }, { publishedAt: before.at, id: { lt: before.id } }] }] : []),
        ],
      },
      select: { id: true, publishedAt: true, topics: { select: { topicId: true } } },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take,
    })
    return rows.map((n) => ({ noteId: n.id, at: n.publishedAt!, topicIds: n.topics.map((t) => t.topicId) }))
  }

  async publicAmong(noteIds: string[]): Promise<{ noteId: string; ownerId: string }[]> {
    if (!noteIds.length) return []
    const rows = await this.db.note.findMany({ where: { AND: [visibleNotesWhere(null), { id: { in: noteIds } }] }, select: { id: true, ownerId: true } })
    const byId = new Map(rows.map((n) => [n.id, n.ownerId]))
    return noteIds.flatMap((id) => (byId.has(id) ? [{ noteId: id, ownerId: byId.get(id)! }] : []))
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

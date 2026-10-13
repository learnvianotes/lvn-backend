import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, type People } from '@lvn-backend/facades'
import { decodeCursor, encodeCursor, pageSize } from '@lvn-backend/graphql'
import { PrismaService } from '@lvn-backend/prisma-base'
import { NotesService, type OpenedNote } from './notes.service'

/**
 * Saved notes (ADR-0076): a person keeps notes they can read to come back to. Saving is private — no one else sees who
 * saved what, and there is no count. The list shows a saved note only while the person can still read it (it was made
 * private, trashed, hidden by moderators or its owner blocked them: it is left out, and back if that changes).
 */
@Injectable()
export class NoteSavesService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  /** The note as the viewer may read it now, or NOT_FOUND (the same answer as for a note that does not exist). */
  private async readable(viewerId: string, noteId: string): Promise<OpenedNote> {
    const opened = await this.notes.open(viewerId, noteId)
    if (!opened || opened.note.deletedAt) throw Errors.notFound('Note not found.')
    if (opened.note.ownerId !== viewerId && (await this.people.blockedBetween(viewerId, opened.note.ownerId))) throw Errors.notFound('Note not found.')
    return opened
  }

  /** Saves a note the viewer can read; saving it again changes nothing. */
  async save(viewerId: string, noteId: string): Promise<OpenedNote> {
    const opened = await this.readable(viewerId, noteId)
    await this.db.noteSave.upsert({ where: { noteId_userId: { noteId, userId: viewerId } }, create: { noteId, userId: viewerId }, update: {} })
    return opened
  }

  /** Takes a note off the viewer's saved notes, readable or not any more. */
  async unsave(viewerId: string, noteId: string): Promise<OpenedNote | null> {
    await this.db.noteSave.deleteMany({ where: { noteId, userId: viewerId } })
    return this.notes.open(viewerId, noteId)
  }

  /** Which of `noteIds` the viewer saved. */
  async savedBy(viewerId: string, noteIds: string[]): Promise<Set<string>> {
    if (!noteIds.length) return new Set()
    const rows = await this.db.noteSave.findMany({ where: { userId: viewerId, noteId: { in: noteIds } }, select: { noteId: true } })
    return new Set(rows.map((r) => r.noteId))
  }

  /**
   * The viewer's saved notes they can still read, newest saved first. Pages go by the saves themselves, so a page keeps
   * its place when some of its notes are left out; a page can then be shorter than asked.
   */
  async saved(viewerId: string, first: number | null | undefined, after: string | null | undefined) {
    const size = pageSize(first, 20)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const [rows, blocked, actor] = await Promise.all([
      this.db.noteSave.findMany({
        where: { userId: viewerId, ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor[0]) } }, { createdAt: new Date(cursor[0]), noteId: { lt: cursor[1] } }] } : {}) },
        orderBy: [{ createdAt: 'desc' }, { noteId: 'desc' }],
        take: size + 1,
      }),
      this.people.blockedIds(viewerId),
      this.notes.actor(viewerId),
    ])
    const page = rows.slice(0, size)
    const opened = await Promise.all(page.map((r) => this.notes.open(viewerId, r.noteId, actor)))
    const cursorOf = (r: (typeof rows)[number]) => encodeCursor([r.createdAt.toISOString(), r.noteId])
    const items = page.flatMap((save, i) => {
      const o = opened[i]
      const shown = o && !o.note.deletedAt && (o.note.ownerId === viewerId || !blocked.includes(o.note.ownerId))
      return shown ? [{ cursor: cursorOf(save), opened: o }] : []
    })
    return { items, hasNextPage: rows.length > size, endCursor: page.length ? cursorOf(page.at(-1)!) : null }
  }

  /** For the person's data export (ADR-0018). */
  async exportOf(userId: string) {
    return (await this.db.noteSave.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map((s) => ({ noteId: s.noteId, savedAt: s.createdAt }))
  }

  async erase(userId: string): Promise<void> {
    await this.db.noteSave.deleteMany({ where: { userId } })
  }
}

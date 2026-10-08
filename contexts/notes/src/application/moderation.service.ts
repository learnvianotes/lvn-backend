import { Inject, Injectable } from '@nestjs/common'
import { cardPlainText } from '@lvn/contracts/validation'
import type { CardType } from '@lvn/contracts/domain'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { MODERATION, type ModeratedNote, type Moderation, type ModerationStateKind, type NoteModeration } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import type { SnapshotCard } from './drafts.service'
import { NotesService } from './notes.service'

const EXCERPT_CHARS = 600

/** Whether anyone may read the note on the public path (ADR-0037). */
const isOpenToPublic = (n: { visibility: string; moderation: string; publishedVersionId: string | null; deletedAt: Date | null }) =>
  n.visibility === 'PUBLIC' && n.moderation === 'OK' && !!n.publishedVersionId && !n.deletedAt

/**
 * The notes side of moderation (§15.1, ADR-0037): screening a note on its way to the public through the MODERATION
 * facade, and the NOTE_MODERATION facade the moderation queue in `core` uses.
 */
@Injectable()
export class NoteModerationService implements NoteModeration {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    @Inject(MODERATION) private readonly moderation: Moderation,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /**
   * Screens the published version of a note that is (going) PUBLIC. A held note waits in PENDING_REVIEW, with the
   * reason its owner sees; returns whether the public can read it now.
   */
  async screen(noteId: string): Promise<boolean> {
    const note = await this.db.note.findUniqueOrThrow({ where: { id: noteId } })
    if (!note.publishedVersionId) return false
    // A moderator's decision stands: hidden or removed notes do not come back by publishing again.
    if (note.moderation === 'HIDDEN' || note.moderation === 'REMOVED') return false
    const version = await this.db.noteVersion.findUniqueOrThrow({ where: { id: note.publishedVersionId } })
    const text = this.words(version.cards as unknown as SnapshotCard[])
    const { held, reason } = await this.moderation.screen({ type: 'NOTE', id: noteId, ownerId: note.ownerId, title: version.title, text })
    if (held) {
      await this.db.note.update({ where: { id: noteId }, data: { moderation: 'PENDING_REVIEW', moderationReason: reason } })
      return false
    }
    return note.moderation === 'OK'
  }

  // ── NOTE_MODERATION facade (libs/facades) ─────────────────────────────────────────────────────────────────

  async describe(noteIds: string[]): Promise<ModeratedNote[]> {
    const notes = noteIds.length ? await this.db.note.findMany({ where: { id: { in: noteIds } }, include: { publishedVersion: true } }) : []
    return notes.map((n) => ({
      id: n.id,
      ownerId: n.ownerId,
      title: n.publishedVersion?.title ?? n.title,
      excerpt: this.words((n.publishedVersion?.cards ?? []) as unknown as SnapshotCard[]).slice(0, EXCERPT_CHARS),
      visibility: n.visibility,
      moderation: n.moderation,
      moderationReason: n.moderationReason,
      deleted: !!n.deletedAt,
    }))
  }

  async canRead(viewerId: string, noteId: string): Promise<boolean> {
    return (await this.notes.open(viewerId, noteId)) !== null
  }

  async setState(noteId: string, state: ModerationStateKind, reason: string | null): Promise<void> {
    const before = await this.db.note.findUnique({ where: { id: noteId } })
    if (!before) return
    const after = await this.db.note.update({ where: { id: noteId }, data: { moderation: state, moderationReason: state === 'OK' ? null : reason } })
    if (isOpenToPublic(after) && !isOpenToPublic(before)) {
      await this.events.publish('NotePublished', { noteId, versionId: after.publishedVersionId!, ownerId: after.ownerId, visibility: after.visibility, kind: after.kind })
    } else if (isOpenToPublic(before) && !isOpenToPublic(after)) {
      await this.events.publish('NoteUnpublished', { noteId, ownerId: after.ownerId })
    }
  }

  private words(cards: SnapshotCard[]): string {
    return cards
      .map((c) => cardPlainText(c.type as CardType, c.content))
      .filter(Boolean)
      .join('\n')
  }
}

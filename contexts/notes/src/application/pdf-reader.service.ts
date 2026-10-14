import { Injectable } from '@nestjs/common'
import { Action, can, HighlightColor, HighlightKind } from '@lvn/contracts/domain'
import { CARD_LIMITS, HIGHLIGHT_LIMITS, NOTE_LIMITS, noteTitleSchema, pageRectSchema, positionBetween } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { noteFacts } from '../domain/note-access'
import { cardFileIds, mediaFileOf, type MediaFile } from './attachments.service'
import type { SnapshotCard } from '../domain/snapshot'
import { FilesService } from './files.service'
import { NotesService, type OpenedNote } from './notes.service'

const PDF = 'application/pdf'

export type HighlightRow = Prisma.NoteHighlightGetPayload<object>

export interface AddHighlightInput {
  noteId: string
  fileId: string
  page: number
  kind: HighlightKind
  color?: HighlightColor | null
  rects: unknown
  quote?: string | null
  comment?: string | null
  cardId?: string | null
}

export interface UpdateHighlightInput {
  highlightId: string
  color?: HighlightColor | null
  /** An empty comment removes it */
  comment?: string | null
  /** null unlinks the card */
  cardId?: string | null
}

const field = (name: string) => ['input', name]

/** The rectangles of a highlight: one to CARD_LIMITS.anchorRects, each inside the page. */
function parseRects(raw: unknown): [number, number, number, number][] {
  if (!Array.isArray(raw) || !raw.length) throw Errors.validation('Mark at least one rectangle.', field('rects'))
  if (raw.length > CARD_LIMITS.anchorRects) throw Errors.validation(`Highlight at most ${CARD_LIMITS.anchorRects} lines at a time.`, field('rects'))
  return raw.map((r) => {
    const parsed = pageRectSchema.safeParse(r)
    if (!parsed.success) throw Errors.validation(parsed.error.issues[0]!.message, field('rects'))
    return parsed.data
  })
}

/**
 * The PDF reader (ADR-0040): the link a reader loads a PDF from, the highlights the note's owner and editors make on
 * it, and studying a PDF of someone else's note in a note of one's own (the fork rule of ADR-0025). Cards made in the
 * reader are ordinary cards with an anchor; DraftsService saves them.
 */
@Injectable()
export class PdfReaderService {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    private readonly files: FilesService,
    private readonly limiter: RateLimiter,
  ) {}

  /**
   * Whether the viewer may open this file of the note: the owner and editors any file attached to it; readers a file
   * the published cards show or point into.
   */
  private async visibleFile(opened: OpenedNote, fileId: string): Promise<boolean> {
    const attached = await this.db.noteAttachment.findUnique({ where: { noteId_fileId: { noteId: opened.note.id, fileId } } })
    if (!attached) return false
    if (opened.access !== 'READER') return true
    if (!opened.note.publishedVersionId) return false
    const version = await this.db.noteVersion.findUnique({ where: { id: opened.note.publishedVersionId }, select: { cards: true } })
    return ((version?.cards ?? []) as unknown as SnapshotCard[]).some((c) => cardFileIds(c.type, c.content).includes(fileId))
  }

  /** A read URL for an hour, or null when the viewer may not open the file. */
  async noteFile(viewerId: string | null, noteId: string, fileId: string): Promise<MediaFile | null> {
    const opened = await this.notes.open(viewerId, noteId)
    if (!opened || !(await this.visibleFile(opened, fileId))) return null
    // 15 minutes, as every read URL (§17.1): the readers ask again when it expires mid-session (ADR-0090).
    const signed = (await this.files.readUrls([fileId])).get(fileId)
    return signed ? mediaFileOf(signed) : null
  }

  // ── Highlights ─────────────────────────────────────────────────────────────────────────────────────────────

  /** The note's highlights, in page order; only the owner and editors see them. */
  async list(opened: OpenedNote, fileId?: string | null): Promise<HighlightRow[]> {
    if (opened.access === 'READER') return []
    return this.db.noteHighlight.findMany({
      where: { noteId: opened.note.id, ...(fileId ? { fileId } : {}) },
      orderBy: [{ page: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: HIGHLIGHT_LIMITS.perNote,
    })
  }

  async add(viewerId: string, input: AddHighlightInput): Promise<HighlightRow> {
    await this.notes.require(viewerId, input.noteId, 'edit')
    const limit = await this.limiter.hit(`notes:highlight:${viewerId}`, { max: 1_000, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have made a lot of highlights in the last hour. Try again later.')
    await this.assertPdf(input.noteId, input.fileId)
    if (!Number.isInteger(input.page) || input.page < 1 || input.page > CARD_LIMITS.anchorPage) throw Errors.validation('Choose a page of the PDF.', field('page'))
    if (!Object.values(HighlightKind).includes(input.kind)) throw Errors.validation('Choose a passage or an area.', field('kind'))
    const rects = parseRects(input.rects)
    if (input.kind === HighlightKind.AREA && rects.length !== 1) throw Errors.validation('An area is one rectangle.', field('rects'))
    const quote = input.quote?.trim() || null
    if (quote && quote.length > CARD_LIMITS.anchorQuote) throw Errors.validation(`Highlight at most ${CARD_LIMITS.anchorQuote} characters at a time.`, field('quote'))
    const comment = this.comment(input.comment)
    if (input.cardId) await this.assertCard(input.noteId, input.cardId)
    if ((await this.db.noteHighlight.count({ where: { noteId: input.noteId } })) >= HIGHLIGHT_LIMITS.perNote) {
      throw Errors.validation(`A note can have at most ${HIGHLIGHT_LIMITS.perNote} highlights. Remove some first.`)
    }
    return this.db.noteHighlight.create({
      data: {
        id: newId(),
        noteId: input.noteId,
        fileId: input.fileId,
        page: input.page,
        kind: input.kind,
        color: this.color(input.color),
        rects,
        quote,
        comment,
        cardId: input.cardId ?? null,
        createdById: viewerId,
      },
    })
  }

  async update(viewerId: string, input: UpdateHighlightInput): Promise<HighlightRow> {
    const highlight = await this.editable(viewerId, input.highlightId)
    const data: Prisma.NoteHighlightUpdateInput = {}
    if (input.color) data.color = this.color(input.color)
    if (input.comment !== undefined) data.comment = this.comment(input.comment)
    if (input.cardId !== undefined) {
      if (input.cardId) await this.assertCard(highlight.noteId, input.cardId)
      data.cardId = input.cardId
    }
    return this.db.noteHighlight.update({ where: { id: highlight.id }, data })
  }

  async remove(viewerId: string, highlightId: string): Promise<void> {
    const highlight = await this.editable(viewerId, highlightId)
    await this.db.noteHighlight.delete({ where: { id: highlight.id } })
  }

  /** A highlight the viewer may change; NOT_FOUND for one they cannot see. */
  private async editable(viewerId: string, highlightId: string): Promise<HighlightRow> {
    const highlight = await this.db.noteHighlight.findUnique({ where: { id: highlightId } })
    const opened = highlight ? await this.notes.open(viewerId, highlight.noteId) : null
    if (!highlight || !opened || opened.access === 'READER') throw Errors.notFound('Highlight not found.')
    await this.notes.require(viewerId, highlight.noteId, 'edit')
    return highlight
  }

  private color(color: HighlightColor | null | undefined): HighlightColor {
    if (!color) return HighlightColor.YELLOW
    if (!Object.values(HighlightColor).includes(color)) throw Errors.validation('Choose one of the highlight colours.', field('color'))
    return color
  }

  private comment(comment: string | null | undefined): string | null {
    const text = comment?.trim() || null
    if (text && text.length > HIGHLIGHT_LIMITS.comment) throw Errors.validation(`Keep the comment under ${HIGHLIGHT_LIMITS.comment} characters.`, field('comment'))
    return text
  }

  private async assertPdf(noteId: string, fileId: string): Promise<void> {
    const attached = await this.db.noteAttachment.findUnique({ where: { noteId_fileId: { noteId, fileId } }, include: { file: { select: { mimeType: true, status: true, deletedAt: true } } } })
    if (!attached || attached.file.deletedAt || attached.file.status !== 'READY') throw Errors.validation('This PDF is not in the note.', field('fileId'))
    if (attached.file.mimeType !== PDF) throw Errors.validation('Only PDFs can be highlighted.', field('fileId'))
  }

  private async assertCard(noteId: string, cardId: string): Promise<void> {
    const card = await this.db.card.findFirst({ where: { id: cardId, noteId, deletedAt: null }, select: { id: true } })
    if (!card) throw Errors.validation('That card is not in this note.', field('cardId'))
  }

  // ── Studying a PDF ─────────────────────────────────────────────────────────────────────────────────────────

  /**
   * A private note of the viewer's own for a PDF they can open (ADR-0040, the fork rule of ADR-0025): a file card with
   * the PDF, linked rather than copied, and the credit line of a copy when the note was someone else's.
   */
  async study(viewerId: string, noteId: string, fileId: string): Promise<OpenedNote> {
    const opened = await this.notes.open(viewerId, noteId)
    if (!opened) throw Errors.notFound('Note not found.')
    const { note, actor, access, shareRole } = opened
    if (!actor || !can(actor, Action.FILE_CONVERT_TO_NOTE, { kind: 'note', note: noteFacts(note, shareRole) })) throw Errors.forbidden('The owner does not allow copies of this note.')
    if (!(await this.visibleFile(opened, fileId))) throw Errors.notFound('PDF not found.')
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.deletedAt || file.status !== 'READY') throw Errors.notFound('PDF not found.')
    if (file.mimeType !== PDF) throw Errors.validation('Only PDFs can be studied this way.', field('fileId'))
    // Copies and studied PDFs share the copy budget.
    const limit = await this.limiter.hit(`notes:fork:${viewerId}`, { max: 100, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have copied a lot of notes in the last hour. Try again later.')

    const named = noteTitleSchema.safeParse(file.originalFileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').slice(0, NOTE_LIMITS.title))
    const title = (named.success && named.data) || 'PDF notes'
    const credit = note.ownerId !== viewerId
    const id = newId()
    await this.db.$transaction(async (tx) => {
      await tx.note.create({
        data: {
          id,
          ownerId: viewerId,
          title,
          draftRevision: 1,
          ...(credit ? { forkedFromNoteId: noteId, forkedFromVersionId: note.publishedVersionId, forkedFromOwnerId: note.ownerId, forkedFromVisibility: note.visibility, forkedAsRole: access } : {}),
        },
      })
      await tx.noteAttachment.create({ data: { noteId: id, fileId } })
      await tx.card.create({ data: { id: newId(), noteId: id, type: 'file', position: positionBetween(null, null), content: { fileId } } })
    })
    return (await this.notes.open(viewerId, id, actor))!
  }
}

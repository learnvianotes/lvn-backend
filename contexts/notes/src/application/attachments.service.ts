import { Injectable } from '@nestjs/common'
import { MEDIA_CARD_TYPES } from '@lvn/contracts/validation'
import type { CardType } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { FilesService } from './files.service'

/** Which files each media card shows (§8.1 limits by kind); a file card shows any attachment. */
const ACCEPTS: Partial<Record<CardType, (mimeType: string) => boolean>> = {
  image: (m) => m.startsWith('image/'),
  video: (m) => m.startsWith('video/'),
  audio: (m) => m.startsWith('audio/'),
  file: () => true,
}

/** The file a media card shows, or null for other cards. */
export function mediaFileId(type: CardType, content: unknown): string | null {
  if (!MEDIA_CARD_TYPES.has(type)) return null
  const id = (content as { fileId?: unknown } | null)?.fileId
  return typeof id === 'string' ? id : null
}

export interface MediaFile {
  id: string
  url: string
  expiresAt: Date
  mimeType: string
  fileName: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationMs: number | null
}

/**
 * Files on notes (§8, ADR-0010): an upload for a note links the file to it (NoteAttachment); a copy of the note links
 * the files its cards show. Media cards may only show files linked to their note, and the people who can read the note
 * get read URLs for them — so a card can never be used to reach someone else's file. Files no note links to any more
 * are deleted.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly files: FilesService,
  ) {}

  /** Media cards in a save must show a finished upload of their kind, linked to the note. */
  async assertUsable(noteId: string, cards: { type: CardType; content: unknown; at: string[] }[]): Promise<void> {
    const wanted = cards.map((c) => ({ ...c, fileId: mediaFileId(c.type, c.content) })).filter((c) => c.fileId)
    if (!wanted.length) return
    const linked = await this.db.noteAttachment.findMany({
      where: { noteId, fileId: { in: wanted.map((c) => c.fileId!) } },
      include: { file: { select: { status: true, mimeType: true, deletedAt: true } } },
    })
    const files = new Map(linked.map((a) => [a.fileId, a.file]))
    for (const card of wanted) {
      const file = files.get(card.fileId!)
      const at = [...card.at, 'content', 'fileId']
      if (!file || file.deletedAt) throw Errors.validation('Upload the file to this note first.', at)
      if (file.status !== 'READY') throw Errors.validation('This file has not finished uploading.', at)
      if (!ACCEPTS[card.type]!(file.mimeType)) throw Errors.validation(`This file cannot be shown in a ${card.type} card.`, at)
    }
  }

  /** Read URLs for the files media cards show, keyed `noteId:fileId`; the caller has checked the reader may read the note. */
  async media(cards: { noteId: string; fileId: string }[]): Promise<Map<string, MediaFile>> {
    const linked = cards.length ? await this.db.noteAttachment.findMany({ where: { OR: cards.map((c) => ({ noteId: c.noteId, fileId: c.fileId })) } }) : []
    const urls = await this.files.readUrls(linked.map((a) => a.fileId))
    const out = new Map<string, MediaFile>()
    for (const a of linked) {
      const signed = urls.get(a.fileId)
      if (!signed) continue
      const f = signed.file
      out.set(`${a.noteId}:${a.fileId}`, {
        id: f.id,
        url: signed.url,
        expiresAt: signed.expiresAt,
        mimeType: f.mimeType,
        fileName: f.originalFileName,
        sizeBytes: Number(f.sizeBytes),
        width: f.width,
        height: f.height,
        durationMs: f.durationMs,
      })
    }
    return out
  }

  /** Links the files the copied cards show to the copy (§4.4): the copy keeps working when the origin goes away. */
  async carryOver(tx: Prisma.TransactionClient, fromNoteId: string, toNoteId: string, cards: { type: CardType; content: unknown }[]): Promise<void> {
    const fileIds = [...new Set(cards.map((c) => mediaFileId(c.type, c.content)).filter((id): id is string => !!id))]
    if (!fileIds.length) return
    const linked = await tx.noteAttachment.findMany({ where: { noteId: fromNoteId, fileId: { in: fileIds } }, select: { fileId: true } })
    if (linked.length) await tx.noteAttachment.createMany({ data: linked.map((a) => ({ noteId: toNoteId, fileId: a.fileId })), skipDuplicates: true })
  }

  /**
   * Deletes note files that no note links to any more (their notes were deleted for good), or only those among
   * `fileIds`. Uploads still in progress are left to the expiry of PENDING files.
   */
  async purgeUnlinked(fileIds?: string[]): Promise<number> {
    const orphans = await this.db.fileObject.findMany({
      where: { purpose: 'ATTACHMENT', deletedAt: null, status: { not: 'PENDING' }, attachments: { none: {} }, ...(fileIds ? { id: { in: fileIds } } : {}) },
      select: { id: true },
      take: 1_000,
    })
    if (orphans.length) await this.files.delete(orphans.map((f) => f.id))
    return orphans.length
  }
}

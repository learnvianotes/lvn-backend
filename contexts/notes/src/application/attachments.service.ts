import { Injectable } from '@nestjs/common'
import { cardAnchor, MEDIA_CARD_TYPES } from '@lvn/contracts/validation'
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

/** The files a card uses: the one a media card shows and the PDF its anchor points into (ADR-0040). */
export function cardFileIds(type: CardType, content: unknown): string[] {
  const ids = [mediaFileId(type, content), cardAnchor(content)?.fileId].filter((id): id is string => !!id)
  return [...new Set(ids)]
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
  pageCount: number | null
  /** ADR-0041: signed URLs of what processing made, null until it is made */
  thumbUrl: string | null
  mediumUrl: string | null
  largeUrl: string | null
  posterUrl: string | null
  playbackUrl: string | null
}

/** A MediaFile from a signed file (FilesService.readUrls). */
export function mediaFileOf(signed: { file: { id: string; mimeType: string; originalFileName: string; sizeBytes: bigint; width: number | null; height: number | null; durationMs: number | null; pageCount: number | null }; url: string; expiresAt: Date; variants: Record<string, string> }): MediaFile {
  const f = signed.file
  const v = signed.variants
  return {
    id: f.id,
    url: signed.url,
    expiresAt: signed.expiresAt,
    mimeType: f.mimeType,
    fileName: f.originalFileName,
    sizeBytes: Number(f.sizeBytes),
    width: f.width,
    height: f.height,
    durationMs: f.durationMs,
    pageCount: f.pageCount,
    thumbUrl: v.thumb ?? null,
    mediumUrl: v.medium ?? null,
    largeUrl: v.large ?? null,
    posterUrl: v.poster ?? null,
    playbackUrl: v.video720 ?? v.audio ?? null,
  }
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

  /**
   * Media cards in a save must show a finished upload of their kind, and anchors must point into a PDF (ADR-0040) —
   * both linked to the note.
   */
  async assertUsable(noteId: string, cards: { type: CardType; content: unknown; at: string[] }[]): Promise<void> {
    const wanted = cards.flatMap((c) => {
      const media = mediaFileId(c.type, c.content)
      const anchor = cardAnchor(c.content)?.fileId
      return [
        ...(media ? [{ ...c, fileId: media, at: [...c.at, 'content', 'fileId'], accepts: ACCEPTS[c.type]!, refusal: `This file cannot be shown in a ${c.type} card.` }] : []),
        ...(anchor ? [{ ...c, fileId: anchor, at: [...c.at, 'content', 'anchor', 'fileId'], accepts: (m: string) => m === 'application/pdf', refusal: 'This file cannot be used in an anchor.' }] : []),
      ]
    })
    if (!wanted.length) return
    const linked = await this.db.noteAttachment.findMany({
      where: { noteId, fileId: { in: [...new Set(wanted.map((c) => c.fileId))] } },
      include: { file: { select: { status: true, mimeType: true, deletedAt: true } } },
    })
    const files = new Map(linked.map((a) => [a.fileId, a.file]))
    for (const use of wanted) {
      const file = files.get(use.fileId)
      if (!file || file.deletedAt) throw Errors.validation('Upload the file to this note first.', use.at)
      if (file.status !== 'READY') throw Errors.validation('This file has not finished uploading.', use.at)
      if (!use.accepts(file.mimeType)) throw Errors.validation(use.refusal, use.at)
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
      out.set(`${a.noteId}:${a.fileId}`, mediaFileOf(signed))
    }
    return out
  }

  /** Links the files the copied cards use to the copy (§4.4): the copy keeps working when the origin goes away. */
  async carryOver(tx: Prisma.TransactionClient, fromNoteId: string, toNoteId: string, cards: { type: CardType; content: unknown }[]): Promise<void> {
    const fileIds = [...new Set(cards.flatMap((c) => cardFileIds(c.type, c.content)))]
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

import { Injectable } from '@nestjs/common'
import { CardType } from '@lvn/contracts/domain'
import type { NoteAiSource } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { IMAGES_TOGETHER, MAX_IMAGES, MAX_PDFS, MediaInput } from './media-input'

type Card = NoteAiSource['cards'][number]
/** Who a reading is for: the note, the person who asked (null for the platform's own work) and whether it is private. */
export interface Reader {
  noteId: string
  ownerId: string | null
  private: boolean
  /** Whose age decides the provider when it is not `ownerId` (a public note's owner on the platform pipeline). */
  subjectId?: string | null
}

/** The cards whose material is read from their file: photos, PDFs and recordings (ADR-0085). */
export const MEDIA: ReadonlySet<string> = new Set([CardType.IMAGE, CardType.FILE, CardType.AUDIO, CardType.VIDEO])
export const isRecording = (c: { type: string }) => c.type === CardType.AUDIO || c.type === CardType.VIDEO
/** A media card's file. */
export const fileOf = (c: { content: unknown }) => (c.content as { fileId?: string } | null)?.fileId ?? null
/** A card's words for the model: code fenced with its language. */
export const wordsOf = (c: { type: string; text: string; content: unknown }) => (c.type === CardType.CODE ? `\`\`\`${(c.content as { language?: string }).language ?? ''}\n${c.text}\n\`\`\`` : c.text)

/** The parts of a task's options this reads (ai-tasks.service.ts has them all). */
interface ArtifactOptions {
  cardIds?: string[] | null
  read?: string[]
  keptInNote?: boolean
}

/**
 * Everything a note holds, as AI reads it (ADR-0084, ADR-0085): its words; what up to MAX_IMAGES photos say, each read
 * on its own once (MediaInput keeps the reading); the words of up to MAX_PDFS PDFs; and the asker's transcript of each
 * recording. What a kept quick note or transcript already put into the note's words is not read again.
 */
@Injectable()
export class NoteMaterial {
  constructor(
    private readonly db: PrismaService,
    private readonly media: MediaInput,
  ) {}

  /**
   * A task's material in the cards' order. A quick note (`attach`) sends up to IMAGES_TOGETHER photos with the request,
   * as the model sees them; otherwise every photo is read into words. `read` is the photos and PDFs it read, by file.
   */
  async forTask(cards: Card[], reader: Reader & { attach: boolean; labels?: boolean }): Promise<{ parts: string[]; images: string[]; read: string[] }> {
    const media = await this.ofMedia(cards, reader, reader.attach ? IMAGES_TOGETHER : 0, reader.labels ?? true)
    const parts = cards.flatMap((c) => (MEDIA.has(c.type) ? (media.texts.has(c.id) ? [media.texts.get(c.id)!] : []) : [wordsOf(c)]))
    return { parts, images: media.attach.length ? await this.media.images(media.attach.map((c) => fileOf(c)!)) : [], read: media.read }
  }

  /**
   * What each photo, PDF and recording card says, by card, labelled ("Photo 2:", "PDF 1:", "Recording 1:") unless a
   * translation asks for the words alone. When there are `attachUpTo` photos or fewer, they are not read but returned
   * in `attach`, to go with the request.
   */
  async ofMedia(cards: Card[], reader: Reader, attachUpTo = 0, labels = true): Promise<{ texts: Map<string, string>; attach: Card[]; read: string[] }> {
    const inWords = await this.keptInNote(reader.noteId, cards)
    const photos = cards.filter((c) => c.type === CardType.IMAGE && !!fileOf(c) && !inWords.has(fileOf(c)!)).slice(0, MAX_IMAGES)
    const files = cards.filter((c) => c.type === CardType.FILE && !!fileOf(c) && !inWords.has(fileOf(c)!)).slice(0, MAX_PDFS)
    const recordings = cards.filter((c) => isRecording(c) && !!fileOf(c) && !inWords.has(c.id))
    const said = recordings.length && reader.ownerId ? await this.transcripts(reader.noteId, reader.ownerId, recordings) : new Map<string, string>()
    const attach = photos.length && photos.length <= attachUpTo ? photos : []
    const who = { userId: reader.ownerId, subjectId: reader.subjectId ?? reader.ownerId, private: reader.private }
    const texts = new Map<string, string>()
    let photo = 0
    let pdf = 0
    let recording = 0
    for (const c of cards) {
      if (photos.includes(c) && !attach.length) {
        const text = await this.media.readPhoto(fileOf(c)!, who)
        photo++
        if (text.trim()) texts.set(c.id, labels ? `Photo ${photo}:\n${text}` : text)
      } else if (files.includes(c)) {
        const text = await this.media.pdfText(fileOf(c)!)
        if (text) texts.set(c.id, labels ? `PDF ${++pdf}:\n${text}` : text)
      } else if (said.has(c.id)) texts.set(c.id, labels ? `Recording ${++recording}:\n${said.get(c.id)!}` : said.get(c.id)!)
    }
    return { texts, attach, read: [...photos, ...files].map((c) => fileOf(c)!) }
  }

  /** What the person's own transcripts say, by recording card: the newest ready one of each (ADR-0062). */
  async transcripts(noteId: string, ownerId: string, recordings: Card[]): Promise<Map<string, string>> {
    const rows = await this.db.noteArtifact.findMany({ where: { noteId, ownerId, task: 'TRANSCRIBE', status: 'READY' }, orderBy: { createdAt: 'desc' }, select: { options: true, payload: true } })
    const out = new Map<string, string>()
    for (const row of rows) {
      // No card chosen: the note's only recording.
      const cardId = (row.options as ArtifactOptions).cardIds?.[0] ?? (recordings.length === 1 ? recordings[0]!.id : null)
      if (!cardId || out.has(cardId) || !recordings.some((r) => r.id === cardId)) continue
      const text = ((row.payload as { cards?: { content: unknown }[] } | null)?.cards ?? []).flatMap((c) => docLines(c.content)).join('\n').trim()
      if (text) out.set(cardId, text)
    }
    return out
  }

  /** The photos and PDFs (by file) and recordings (by card) whose words a quick note or transcript kept into the note. */
  private async keptInNote(noteId: string, cards: Card[]): Promise<Set<string>> {
    const kept = await this.db.noteArtifact.findMany({ where: { noteId, task: { in: ['QUICK_NOTE', 'TRANSCRIBE'] }, keptAt: { not: null } }, select: { task: true, options: true } })
    const recordings = cards.filter(isRecording)
    const out = new Set<string>()
    for (const { task, options } of kept) {
      const o = options as ArtifactOptions
      if (!o.keptInNote) continue
      if (task === 'QUICK_NOTE') for (const fileId of o.read ?? []) out.add(fileId)
      else {
        const cardId = o.cardIds?.[0] ?? (recordings.length === 1 ? recordings[0]!.id : null)
        if (cardId) out.add(cardId)
      }
    }
    return out
  }
}

/** The lines of a rich-text card's content (its paragraphs and headings). */
function docLines(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  const n = node as { type?: string; content?: unknown[]; doc?: unknown }
  if (n.doc) return docLines(n.doc, out)
  if (n.type === 'paragraph' || n.type === 'heading') {
    out.push((n.content ?? []).map((c) => (c as { text?: string }).text ?? '').join(''))
    return out
  }
  for (const child of n.content ?? []) docLines(child, out)
  return out
}

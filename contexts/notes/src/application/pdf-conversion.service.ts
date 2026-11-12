import { Inject, Injectable, Logger } from '@nestjs/common'
import { LimitKey, planLimitMessage, type CardType } from '@lvn/contracts/domain'
import { NOTE_LIMITS, positionsBetween } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { ENTITLEMENTS, PAGE_VISION, type Entitlements, type PageVision } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { RateLimiter } from '@lvn-backend/redis'
import { Storage } from '@lvn-backend/storage'
import { doclingToCards, type DoclingDocument } from '../domain/docling-cards'
import { acceptReading, pageText, replacePage } from '../domain/escalation'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { FilesService } from './files.service'
import type { OpenedNote } from './notes.service'
import { PdfReaderService } from './pdf-reader.service'

/** The notes context's queue for the engine's answers, and the engine's own queue (workers/pdf-engine, ADR-0028). */
export const NOTES_PDF_QUEUE = 'notes.pdf'
export const PDF_ENGINE_QUEUE = 'notes.pdf-parse'
export const PDF_LIMITS = {
  /** Pages one conversion may have: about a quarter of an hour of the engine's time */
  pagesPerConversion: 300,
  /** Pictures kept from one PDF */
  pictures: 200,
  /** The engine's document for one PDF */
  documentBytes: 100 * 1024 ** 2,
  /** A conversion still waiting after this is given up (the engine was down) */
  stuckAfterMs: 2 * 60 * 60 * 1000,
}

export type ConversionRow = Prisma.PdfConversionGetPayload<object>
const ACTIVE = ['QUEUED', 'TRIAGE', 'PARSING', 'MAPPING'] as const

/** The engine's answers on NOTES_PDF_QUEUE (workers/pdf-engine jobs.py has the same shapes). */
export interface TriagedMessage {
  conversionId: string
  pages: number
  scannedPages: number
  sha256: string
  encrypted: boolean
}
export interface ParsedMessage {
  conversionId: string
  bucket: string
  documentKey: string
  pictures: { ref: string; key: string; width: number; height: number }[]
  pages: number
  seconds: number
  /** Pages the engine chose to read again (stage 4, ADR-0063), each a PNG at `key`; absent from older engines */
  escalate?: { page: number; reason: string; score: number | null; ocr: number | null; key: string }[]
}
export interface FailedMessage {
  conversionId: string
  error: string
}

const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

/**
 * Converting a PDF into a note (ADR-0025, ADR-0028). Asking makes the asker's own private note with the PDF (the
 * fork rule, as studyPdf); the engine then reports the PDF's pages (triage) and, within the limits, reads it (parse);
 * the cards are made here, each with the page it came from (ADR-0040), to be checked beside the PDF in the reader.
 * The same PDF converted again reuses what the engine read (stored by its SHA-256).
 */
@Injectable()
export class PdfConversionService {
  private readonly log = new Logger('PdfConversion')

  constructor(
    private readonly db: PrismaService,
    private readonly reader: PdfReaderService,
    private readonly files: FilesService,
    private readonly storage: Storage,
    private readonly queues: Queues,
    private readonly limiter: RateLimiter,
    @Inject(ENTITLEMENTS) private readonly entitlements: Entitlements,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
    @Inject(PAGE_VISION) private readonly vision: PageVision,
  ) {}

  async request(viewerId: string, noteId: string, fileId: string): Promise<{ conversion: ConversionRow; note: OpenedNote }> {
    const limit = await this.limiter.hit(`notes:convert:${viewerId}`, { max: 20, windowSeconds: 86_400 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You can convert 20 PDFs a day. Try again tomorrow.')
    if (await this.db.pdfConversion.count({ where: { userId: viewerId, status: { in: [...ACTIVE] } } })) {
      throw Errors.conflict('One of your PDFs is being converted. Wait for it to finish first.')
    }
    const note = await this.reader.study(viewerId, noteId, fileId)
    const file = await this.db.fileObject.findUniqueOrThrow({ where: { id: fileId } })
    const conversion = await this.db.pdfConversion.create({ data: { id: newId(), userId: viewerId, sourceNoteId: noteId, fileId, noteId: note.note.id, status: 'TRIAGE', progress: 5 } })
    await this.queues.queue(PDF_ENGINE_QUEUE).add('triage', { conversionId: conversion.id, bucket: file.bucket, key: file.storageKey }, { jobId: `${conversion.id}.triage`, attempts: 2 })
    return { conversion, note }
  }

  /** The engine counted the pages: within the limits, the PDF is read (or what was read before is reused). */
  async triaged(m: TriagedMessage): Promise<void> {
    const c = await this.db.pdfConversion.findUnique({ where: { id: m.conversionId } })
    if (!c || c.status !== 'TRIAGE') return
    if (m.encrypted) return this.fail(c.id, 'This PDF is locked with a password, so it cannot be converted.')
    if (m.pages < 1) return this.fail(c.id, 'This PDF has no pages.')
    if (m.pages > PDF_LIMITS.pagesPerConversion) return this.fail(c.id, `PDFs of up to ${PDF_LIMITS.pagesPerConversion} pages can be converted; this one has ${m.pages}.`)
    const allowed = await this.entitlements.limit(c.userId, LimitKey.PDF_PAGES_MONTHLY)
    if (allowed !== null && BigInt(await this.pagesThisMonth(c.userId, c.id)) + BigInt(m.pages) > allowed) {
      return this.fail(c.id, planLimitMessage(LimitKey.PDF_PAGES_MONTHLY))
    }
    await this.db.pdfConversion.update({ where: { id: c.id }, data: { pages: m.pages, scannedPages: m.scannedPages, status: 'PARSING', progress: 15 } })
    const prefix = `pdf-engine/${m.sha256}/`
    const cached = await this.cached(prefix)
    if (cached) {
      await this.queues.queue(NOTES_PDF_QUEUE).add('map', { ...cached, conversionId: c.id }, { jobId: `${c.id}.map` })
      return
    }
    const file = await this.db.fileObject.findUniqueOrThrow({ where: { id: c.fileId } })
    await this.queues
      .queue(PDF_ENGINE_QUEUE)
      .add('parse', { conversionId: c.id, bucket: file.bucket, key: file.storageKey, outputBucket: this.config.restrictedBucket, outputPrefix: prefix, ocr: m.scannedPages > 0 }, { jobId: `${c.id}.parse`, attempts: 1 })
  }

  /** What the engine read for this PDF before, if it is still stored. */
  private async cached(prefix: string): Promise<Omit<ParsedMessage, 'conversionId'> | null> {
    if (!(await this.storage.head(this.config.restrictedBucket, `${prefix}result.json`))) return null
    try {
      const bytes = await this.storage.getBytes(this.config.restrictedBucket, `${prefix}result.json`, 1024 ** 2)
      return JSON.parse(new TextDecoder().decode(bytes)) as Omit<ParsedMessage, 'conversionId'>
    } catch {
      return null
    }
  }

  /** The engine read the PDF: its pictures go to the note as files, and its content becomes cards after the PDF's card. */
  async map(m: ParsedMessage): Promise<void> {
    const c = await this.db.pdfConversion.findUnique({ where: { id: m.conversionId } })
    if (!c || (c.status !== 'PARSING' && c.status !== 'MAPPING')) return
    await this.db.pdfConversion.update({ where: { id: c.id }, data: { status: 'MAPPING', progress: 85 } })
    try {
      const doc = JSON.parse(new TextDecoder().decode(await this.storage.getBytes(m.bucket, m.documentKey, PDF_LIMITS.documentBytes))) as DoclingDocument
      const pictures = new Map<string, string>()
      for (const [index, picture] of m.pictures.slice(0, PDF_LIMITS.pictures).entries()) {
        const bytes = await this.storage.getBytes(m.bucket, picture.key, 20 * 1024 ** 2)
        const stored = await this.files.storeAttachment(c.userId, c.noteId, `figure-${index + 1}.png`, bytes)
        if ('fileId' in stored) pictures.set(picture.ref, stored.fileId)
      }
      const existing = await this.db.card.findMany({ where: { noteId: c.noteId, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { position: true } })
      const room = NOTE_LIMITS.cardsPerNote - existing.length
      const converted = doclingToCards(doc, { fileId: c.fileId, picture: (ref) => pictures.get(ref) ?? null, maxCards: room })
      if (converted.warnings.length) this.log.warn(`${c.id}: ${converted.warnings.join('; ')}`)
      const again = await this.readAgain(c, m, converted.cards)
      const cards = again.cards.slice(0, room)
      const positions = positionsBetween(existing.at(-1)?.position ?? null, null, cards.length)
      await this.db.$transaction(async (tx) => {
        if (cards.length) await tx.card.createMany({ data: cards.map((card, i) => ({ id: newId(), noteId: c.noteId, type: card.type, position: positions[i]!, content: card.content as Prisma.InputJsonValue })) })
        await tx.note.update({ where: { id: c.noteId }, data: { draftRevision: { increment: 1 }, draftUpdatedAt: new Date() } })
        await tx.pdfConversion.update({ where: { id: c.id }, data: { status: 'DONE', progress: 100, cards: cards.length, aiPages: again.aiPages, aiRejected: again.aiRejected, finishedAt: new Date() } })
      })
    } catch (e) {
      this.log.error(`${c.id}: mapping failed: ${(e as Error).message}`)
      await this.fail(c.id, 'The PDF was read but could not be turned into cards. Try again later.')
    }
  }

  /**
   * Stage 4 of ADR-0028 (ADR-0063): the pages the engine chose, read again by the vision model. A reading that shares
   * too little of the OCR's words is rejected; a page that fails, or AI being off, keeps the OCR's cards. Never fails
   * the conversion.
   */
  private async readAgain<T extends { type: CardType; content: unknown }>(c: { id: string; fileId: string; userId: string }, m: ParsedMessage, cards: T[]) {
    const pages = m.escalate ?? []
    if (!pages.length) return { cards: cards as { type: T['type']; content: unknown }[], aiPages: null, aiRejected: null }
    if (!(await this.vision.available().catch(() => false))) return { cards: cards as { type: T['type']; content: unknown }[], aiPages: 0, aiRejected: 0 }
    let out: { type: T['type']; content: unknown }[] = cards
    let read = 0
    let rejected = 0
    for (const p of pages) {
      try {
        const png = Buffer.from(await this.storage.getBytes(m.bucket, p.key, 20 * 1024 ** 2)).toString('base64')
        const reading = await this.vision.read(png, c.userId)
        read++
        if (!acceptReading(pageText(out, p.page), reading.text, p.ocr ?? null)) {
          rejected++
          continue
        }
        out = replacePage(out, p.page, reading.cards, c.fileId)
      } catch (e) {
        this.log.warn(`${c.id}: page ${p.page} was not read again: ${(e as Error).message}`)
      }
    }
    return { cards: out, aiPages: read, aiRejected: rejected }
  }

  async failed(m: FailedMessage): Promise<void> {
    const c = await this.db.pdfConversion.findUnique({ where: { id: m.conversionId } })
    if (c && (ACTIVE as readonly string[]).includes(c.status)) await this.fail(c.id, m.error)
  }

  /** Conversions the engine never answered (it was down) fail rather than block their owner's next one. */
  async expireStuck(now = new Date()): Promise<number> {
    const { count } = await this.db.pdfConversion.updateMany({
      where: { status: { in: [...ACTIVE] }, createdAt: { lt: new Date(now.getTime() - PDF_LIMITS.stuckAfterMs) } },
      data: { status: 'FAILED', error: 'The conversion took too long. Try again.', finishedAt: now },
    })
    return count
  }

  private async fail(id: string, error: string): Promise<void> {
    await this.db.pdfConversion.update({ where: { id }, data: { status: 'FAILED', error, finishedAt: new Date() } })
  }

  /** Pages converted this calendar month (UTC); failed conversions do not count. */
  async pagesThisMonth(userId: string, except?: string): Promise<number> {
    const sum = await this.db.pdfConversion.aggregate({ where: { userId, createdAt: { gte: monthStart() }, status: { not: 'FAILED' }, ...(except ? { id: { not: except } } : {}) }, _sum: { pages: true } })
    return sum._sum.pages ?? 0
  }

  async limit(userId: string): Promise<number | null> {
    const allowed = await this.entitlements.limit(userId, LimitKey.PDF_PAGES_MONTHLY)
    return allowed === null ? null : Number(allowed)
  }

  /** A conversion its asker may see. */
  async get(viewerId: string, id: string): Promise<ConversionRow | null> {
    return this.db.pdfConversion.findFirst({ where: { id, userId: viewerId } })
  }

  /** The latest conversion filling a note, for its asker. */
  async forNote(viewerId: string, noteId: string): Promise<ConversionRow | null> {
    return this.db.pdfConversion.findFirst({ where: { noteId, userId: viewerId }, orderBy: { createdAt: 'desc' } })
  }
}

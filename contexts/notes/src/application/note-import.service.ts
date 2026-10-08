import { createHash } from 'node:crypto'
import path from 'node:path'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Action, can, type CardType } from '@lvn/contracts/domain'
import { NOTE_LIMITS, noteTitleSchema, parseCardContent, positionsBetween } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { POLICY, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { RateLimiter } from '@lvn-backend/redis'
import { strFromU8, unzipSync } from 'fflate'
import { parse as parseYaml } from 'yaml'
import { markdownToCards, type ImportedCard } from '../domain/markdown-import'
import { FilesService } from './files.service'
import { OrganiseService } from './organise.service'

export const NOTES_IMPORT_QUEUE = 'notes.import'
/** ADR-0018 guards: at most 200 MB uploaded, 1 GB unpacked, 5,000 files, and no file packed more than 200 times. */
const LIMITS = { uploadBytes: 200 * 1024 ** 2, unpackedBytes: 1024 ** 3, files: 5_000, ratio: 200 }
const TEXT = /\.(md|markdown|txt)$/i

interface Report {
  created: number
  notes: { id: string; title: string }[]
  skipped: { path: string; reason: string }[]
}

interface NoteToCreate {
  path: string
  title: string
  kind: 'NOTE' | 'PROJECT' | 'BLOG' | 'POST'
  folder: string[]
  tags: string[]
  topicIds: string[]
  cards: ImportedCard[]
  /** Pictures and files to store first: card index → archive path */
  files: { index: number; path: string }[]
  forkedFrom: { noteId?: string | null; versionId?: string | null; ownerId: string; originVisibility?: string | null; forkedAs?: string | null } | null
}

class ImportRefused extends Error {}

/**
 * Settings → Data → Import notes (ADR-0018): an LVN export (read losslessly from note.json), Markdown files, or a ZIP of
 * Markdown with pictures (Obsidian, Notion, Joplin, plain folders). Everything arrives PRIVATE; folders, tags, topics
 * and fork credits are kept; nothing social is imported. Runs in apps/worker with progress and a report.
 */
@Injectable()
export class NoteImportService {
  private readonly log = new Logger('NoteImport')

  constructor(
    private readonly db: PrismaService,
    private readonly files: FilesService,
    private readonly organise: OrganiseService,
    private readonly queues: Queues,
    private readonly limiter: RateLimiter,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async start(userId: string, fileId: string) {
    if (!can(await this.policy.actor(userId), Action.ACCOUNT_IMPORT_NOTES)) throw Errors.forbidden()
    const limit = await this.limiter.hit(`imports:${userId}`, { max: 5, windowSeconds: 86_400 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You can import five times a day. Try again tomorrow.')
    const [file] = await this.files.describe([fileId])
    if (!file || file.ownerId !== userId || file.purpose !== 'IMPORT' || file.status !== 'READY') throw Errors.notFound('Upload not found.')
    const id = newId()
    await this.files.attach([fileId], userId, 'IMPORT', { type: 'IMPORT_JOB', id })
    const row = await this.db.noteImport.create({ data: { id, userId, fileId, fileName: file.originalFileName } })
    await this.queues.queue(NOTES_IMPORT_QUEUE).add('run-import', { importId: id }, { jobId: id })
    return row
  }

  /** The same file was imported before: the person says to import it again anyway. */
  async confirm(userId: string, importId: string) {
    const row = await this.db.noteImport.findUnique({ where: { id: importId } })
    if (!row || row.userId !== userId) throw Errors.notFound('Import not found.')
    if (row.status !== 'NEEDS_CONFIRMATION') throw Errors.validation('This import does not need a confirmation.')
    const next = await this.db.noteImport.update({ where: { id: importId }, data: { allowDuplicate: true, status: 'PENDING' } })
    await this.queues.queue(NOTES_IMPORT_QUEUE).add('run-import', { importId }, { jobId: `${importId}.confirmed` })
    return next
  }

  list(userId: string) {
    return this.db.noteImport.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 })
  }

  /** The worker's job. */
  async run(importId: string): Promise<void> {
    const row = await this.db.noteImport.findUnique({ where: { id: importId } })
    if (!row || row.status !== 'PENDING') return
    await this.db.noteImport.update({ where: { id: importId }, data: { status: 'RUNNING', progress: 0 } })
    const report: Report = { created: 0, notes: [], skipped: [] }
    try {
      const { bytes, fileName } = await this.files.readBytes(row.userId, row.fileId, LIMITS.uploadBytes)
      const checksum = createHash('sha256').update(bytes).digest('hex')
      if (!row.allowDuplicate && (await this.db.noteImport.count({ where: { userId: row.userId, checksum, status: 'DONE', id: { not: row.id } } }))) {
        await this.db.noteImport.update({ where: { id: importId }, data: { status: 'NEEDS_CONFIRMATION', checksum } })
        return
      }
      await this.db.noteImport.update({ where: { id: importId }, data: { checksum } })
      const entries = bytes[0] === 0x50 && bytes[1] === 0x4b ? this.unzip(bytes) : new Map([[path.basename(fileName), bytes]])
      const notes = entries.has('manifest.json') && this.isLvnExport(entries) ? this.fromLvnExport(entries, report) : this.fromMarkdown(entries, report)
      if (!notes.length && !report.skipped.length) report.skipped.push({ path: fileName, reason: 'no notes found (Markdown or text files)' })
      const actor = await this.policy.actor(row.userId)
      let done = 0
      for (const note of notes) {
        try {
          const created = await this.create(row.userId, actor?.globalRole === 'TEACHER', note, entries, report)
          report.created++
          if (report.notes.length < 100) report.notes.push(created)
        } catch (e) {
          report.skipped.push({ path: note.path, reason: (e as Error).message.slice(0, 200) })
        }
        if (++done % 10 === 0) await this.db.noteImport.update({ where: { id: importId }, data: { progress: Math.round((done / notes.length) * 100) } })
      }
      await this.db.noteImport.update({ where: { id: importId }, data: { status: 'DONE', progress: 100, report: report as unknown as Prisma.InputJsonValue, finishedAt: new Date() } })
      await this.events.publish('NotesImportCompleted', { importId, userId: row.userId, created: report.created, skipped: report.skipped.length, failed: 0 })
    } catch (e) {
      const message = e instanceof ImportRefused ? e.message : 'The import failed. Try again, or import a smaller file.'
      if (!(e instanceof ImportRefused)) this.log.error(`import ${importId} failed: ${(e as Error).message}`)
      await this.db.noteImport.update({ where: { id: importId }, data: { status: 'FAILED', error: message, report: report as unknown as Prisma.InputJsonValue, finishedAt: new Date() } })
    }
  }

  // ── Reading the upload ───────────────────────────────────────────────────────────────────────────────────

  /** Unpacks a ZIP with the zip-bomb and path guards of ADR-0018; folders and hidden files are skipped. */
  private unzip(bytes: Uint8Array): Map<string, Uint8Array> {
    let count = 0
    let total = 0
    const out = unzipSync(bytes, {
      filter: (f) => {
        // Unsafe paths fail the whole import, before anything is skipped.
        const clean = path.posix.normalize(f.name)
        if (f.name.includes('\\') || f.name.includes('\0') || path.posix.isAbsolute(f.name) || clean.startsWith('..')) throw new ImportRefused(`The archive has an unsafe path: ${f.name.slice(0, 100)}`)
        if (f.name.endsWith('/') || /(^|\/)(__MACOSX|\.)/.test(f.name)) return false
        if (++count > LIMITS.files) throw new ImportRefused(`The archive has more than ${LIMITS.files} files.`)
        total += f.originalSize
        if (total > LIMITS.unpackedBytes) throw new ImportRefused('The archive unpacks to more than 1 GB.')
        if (f.size > 0 && f.originalSize / f.size > LIMITS.ratio) throw new ImportRefused('The archive is packed suspiciously tightly.')
        return true
      },
    })
    return new Map(Object.entries(out).map(([name, data]) => [path.posix.normalize(name), data]))
  }

  private isLvnExport(entries: Map<string, Uint8Array>): boolean {
    try {
      return (JSON.parse(strFromU8(entries.get('manifest.json')!)) as { format?: string }).format === 'lvn-export/1'
    } catch {
      return false
    }
  }

  /** An LVN export: note.json holds every card exactly; only the notes/ folder is read. */
  private fromLvnExport(entries: Map<string, Uint8Array>, report: Report): NoteToCreate[] {
    const notes: NoteToCreate[] = []
    for (const [file, data] of entries) {
      if (!file.startsWith('notes/') || !file.endsWith('/note.json')) continue
      try {
        const n = JSON.parse(strFromU8(data)) as { format: string; title: string; kind: NoteToCreate['kind']; folder?: string; tags?: string[]; topicIds?: string[]; forkedFrom?: NoteToCreate['forkedFrom']; draft: { type: CardType; content: unknown; media?: string | null }[] }
        if (n.format !== 'lvn-note/1') continue
        const dir = path.posix.dirname(file)
        const files: NoteToCreate['files'] = []
        const cards = n.draft.map((c, index) => {
          if (c.media) files.push({ index, path: path.posix.join(dir, c.media) })
          return { type: c.type, content: c.content }
        })
        notes.push({ path: file, title: n.title ?? '', kind: n.kind, folder: (n.folder ?? '').split('/').filter(Boolean), tags: n.tags ?? [], topicIds: n.topicIds ?? [], cards, files, forkedFrom: n.forkedFrom ?? null })
      } catch {
        report.skipped.push({ path: file, reason: 'not a readable note.json' })
      }
    }
    return notes
  }

  /** Markdown and text files: front matter, then cards; a folder all files share is dropped from their folders. */
  private fromMarkdown(entries: Map<string, Uint8Array>, report: Report): NoteToCreate[] {
    const files = [...entries.keys()].filter((f) => TEXT.test(f))
    for (const f of entries.keys()) if (!TEXT.test(f) && !/\.(png|jpe?g|gif|webp|mp4|webm|mov|mp3|m4a|ogg|wav|pdf)$/i.test(f)) report.skipped.push({ path: f, reason: 'not Markdown, text or a file notes accept' })
    const roots = new Set(files.map((f) => f.split('/')[0]))
    const strip = roots.size === 1 && files.every((f) => f.includes('/')) ? 1 : 0
    return files.map((file) => {
      const raw = strFromU8(entries.get(file)!).replace(/^\uFEFF/, '')
      const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
      let front: Record<string, unknown> = {}
      if (fm) {
        try {
          front = (parseYaml(fm[1]!) as Record<string, unknown>) ?? {}
        } catch {
          report.skipped.push({ path: file, reason: 'front matter could not be read; the note was imported without it' })
        }
      }
      const body = fm ? raw.slice(fm[0].length) : raw
      const parsed = /\.txt$/i.test(file) ? { title: null, cards: this.plainText(body), images: [], warnings: [] } : markdownToCards(body)
      for (const w of parsed.warnings) report.skipped.push({ path: file, reason: w })
      const dir = path.posix.dirname(file)
      const tags = Array.isArray(front.tags) ? front.tags.map(String) : typeof front.tags === 'string' ? front.tags.split(/[,\s]+/) : []
      return {
        path: file,
        title: String(front.title ?? parsed.title ?? path.posix.basename(file).replace(TEXT, '')),
        kind: 'NOTE' as const,
        folder: dir === '.' ? [] : dir.split('/').slice(strip),
        tags: tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean),
        topicIds: [],
        cards: parsed.cards,
        files: parsed.images.map((i) => ({ index: i.index, path: /^https?:/i.test(i.src) ? i.src : path.posix.normalize(path.posix.join(dir, i.src)) })),
        forkedFrom: null,
      }
    })
  }

  private plainText(body: string): ImportedCard[] {
    const paragraphs = body.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean)
    return paragraphs.length ? [{ type: 'text', content: { doc: { type: 'doc', content: paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })) } } }] : []
  }

  // ── Writing notes ────────────────────────────────────────────────────────────────────────────────────────

  private async create(userId: string, teacher: boolean, n: NoteToCreate, entries: Map<string, Uint8Array>, report: Report): Promise<{ id: string; title: string }> {
    const title = noteTitleSchema.safeParse(n.title.trim().slice(0, 200))
    const kind = n.kind === 'PROJECT' || (teacher && (n.kind === 'BLOG' || n.kind === 'POST')) ? n.kind : 'NOTE'
    const folderId = n.folder.length ? await this.organise.ensureFolderPath(userId, n.folder) : null
    const topicIds = n.topicIds.length ? await this.organise.usableTopics(userId, n.topicIds, ['topicIds']).catch(() => []) : []
    const fork = n.forkedFrom ? await this.forkCredit(n.forkedFrom) : null
    const id = newId()
    await this.db.note.create({ data: { id, ownerId: userId, kind, title: title.success ? title.data : 'Imported note', folderId, ...fork } })
    // Files go to the note first, so the cards can point at them.
    const cards = [...n.cards]
    for (const f of n.files) {
      const data = entries.get(f.path)
      const stored = data ? await this.files.storeAttachment(userId, id, path.posix.basename(f.path), data) : { refused: /^https?:/i.test(f.path) ? 'pictures from the web are not downloaded' : 'not found in the archive' }
      const card = cards[f.index]!
      if ('fileId' in stored) cards[f.index] = { type: card.type, content: { ...(card.content as object), fileId: stored.fileId } }
      else {
        report.skipped.push({ path: `${n.path} → ${f.path}`, reason: stored.refused })
        cards[f.index] = { type: 'text', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `[${path.posix.basename(f.path)} was not imported]` }] }] } } }
      }
    }
    const valid = cards.filter((c) => parseCardContent(c.type, c.content).ok).slice(0, NOTE_LIMITS.cardsPerNote)
    if (valid.length < cards.length) report.skipped.push({ path: n.path, reason: `${cards.length - valid.length} card(s) left out (not valid, or over ${NOTE_LIMITS.cardsPerNote})` })
    const positions = positionsBetween(null, null, valid.length)
    await this.db.$transaction(async (tx) => {
      if (valid.length) await tx.card.createMany({ data: valid.map((c, i) => ({ id: newId(), noteId: id, type: c.type, position: positions[i]!, content: parseCardContentOrThrow(c) })) })
      await tx.note.update({ where: { id }, data: { draftRevision: valid.length ? 1 : 0 } })
      if (n.tags.length) await this.organise.setTags(tx, userId, id, n.tags.slice(0, 20), ['tagNames']).catch(() => report.skipped.push({ path: n.path, reason: 'some tags were not valid' }))
      if (topicIds.length) await tx.noteTopic.createMany({ data: topicIds.map((topicId) => ({ noteId: id, topicId })) })
    })
    return { id, title: title.success ? title.data : 'Imported note' }
  }

  /** Fork credit survives (ADR-0010): the author always; the origin only where it still exists. Unknown visibility counts as not public. */
  private async forkCredit(f: NonNullable<NoteToCreate['forkedFrom']>): Promise<Prisma.NoteUncheckedCreateInput | Record<string, never>> {
    if (!f.ownerId) return {}
    const origin = f.noteId ? await this.db.note.findUnique({ where: { id: f.noteId }, select: { id: true } }) : null
    const version = f.versionId ? await this.db.noteVersion.findUnique({ where: { id: f.versionId }, select: { id: true } }) : null
    const visibility = f.originVisibility === 'PUBLIC' || f.originVisibility === 'SHARED' || f.originVisibility === 'PRIVATE' ? f.originVisibility : 'SHARED'
    const role = f.forkedAs === 'OWNER' || f.forkedAs === 'EDITOR' || f.forkedAs === 'READER' ? f.forkedAs : 'READER'
    return { forkedFromOwnerId: f.ownerId, forkedFromNoteId: origin?.id ?? null, forkedFromVersionId: version?.id ?? null, forkedFromVisibility: visibility, forkedAsRole: role } as Prisma.NoteUncheckedCreateInput
  }
}

function parseCardContentOrThrow(c: ImportedCard): Prisma.InputJsonValue {
  const parsed = parseCardContent(c.type, c.content)
  if (!parsed.ok) throw new Error(parsed.message)
  return parsed.content as Prisma.InputJsonValue
}

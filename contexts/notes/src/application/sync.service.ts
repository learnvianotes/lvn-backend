import { Injectable, Logger } from '@nestjs/common'
import type { NoteKind } from '@lvn/contracts/domain'
import { AppError, ErrorCode, Errors } from '@lvn-backend/errors'
import { decodeCursor, encodeCursor } from '@lvn-backend/graphql'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { visibleNotesWhere } from '../domain/note-access'
import { DraftsService, type CardOp, type CardOpResult, type SnapshotCard } from './drafts.service'
import { NotesService, type CardInput, type OpenedNote } from './notes.service'

export const SYNC_LIMITS = { opsPerPush: 100, notesPerPull: 50 } as const
/** The first page of a sync starts this much before the last cursor: writes that committed late are not missed. */
const OVERLAP_MS = 2_000

export type SyncOpKind = 'CREATE_NOTE' | 'UPDATE_NOTE' | 'TRASH_NOTE' | 'RESTORE_NOTE'

export interface SyncOp {
  clientOpId: string
  kind: SyncOpKind
  noteId: string
  title?: string | null
  cards?: CardInput[] | null
  ops?: CardOp[] | null
  /** CREATE_NOTE: the note's kind (ADR-0052) */
  noteKind?: NoteKind | null
}

export interface SyncOpResult {
  clientOpId: string
  /** APPLIED, REJECTED (it will never apply: show it as needing attention) or RETRY (try again later) */
  status: 'APPLIED' | 'REJECTED' | 'RETRY'
  code: ErrorCode | null
  message: string | null
  noteId: string
  cardResults: CardOpResult[]
  conflictVersionId: string | null
}

/**
 * Offline sync for devices (§13.2). Devices write locally, keep an outbox of operations and push them here in order;
 * every operation has a clientOpId, so a retried push gets the first answer again instead of a second write. The
 * rules for conflicts are those of updateNoteDraft (§13.2): this is the same code, batched. Devices then pull what
 * changed since their cursor — their own notes and notes shared with them — plus the ids of every note they may keep,
 * so notes they lost access to can be removed.
 */
@Injectable()
export class SyncService {
  private readonly log = new Logger('Sync')

  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    private readonly drafts: DraftsService,
  ) {}

  async push(userId: string, ops: SyncOp[]): Promise<SyncOpResult[]> {
    if (ops.length > SYNC_LIMITS.opsPerPush) throw Errors.validation(`Push at most ${SYNC_LIMITS.opsPerPush} changes at once.`, ['ops'])
    if (new Set(ops.map((o) => o.clientOpId)).size !== ops.length) throw Errors.validation('An operation appears twice.', ['ops'])
    const done = await this.db.syncOpLog.findMany({ where: { clientOpId: { in: ops.map((o) => o.clientOpId) } } })
    const earlier = new Map(done.map((d) => [d.clientOpId, d]))

    const results: SyncOpResult[] = []
    let stopped = false
    for (const op of ops) {
      const seen = earlier.get(op.clientOpId)
      if (seen) {
        results.push(seen.userId === userId ? (seen.result as unknown as SyncOpResult) : this.result(op, 'REJECTED', ErrorCode.VALIDATION, 'This operation id was already used.'))
        continue
      }
      // After a rate limit or a server error, later operations wait: they may depend on this one.
      if (stopped) {
        results.push(this.result(op, 'RETRY', null, null))
        continue
      }
      const result = await this.apply(userId, op)
      if (result.status === 'RETRY') stopped = true
      else await this.remember(userId, result)
      results.push(result)
    }
    return results
  }

  private async apply(userId: string, op: SyncOp): Promise<SyncOpResult> {
    try {
      switch (op.kind) {
        case 'CREATE_NOTE': {
          // Created already (an answer lost on the way back, or the log expired): the device's note is the same note.
          const existing = await this.db.note.findUnique({ where: { id: op.noteId }, select: { ownerId: true } })
          if (existing?.ownerId === userId) return this.result(op, 'APPLIED', null, null)
          await this.notes.create(userId, { id: op.noteId, title: op.title ?? '', cards: op.cards ?? [], kind: op.noteKind ?? null })
          return this.result(op, 'APPLIED', null, null)
        }
        case 'UPDATE_NOTE': {
          const { results, conflictVersionId } = await this.drafts.update(userId, { noteId: op.noteId, ...(op.title !== undefined && op.title !== null ? { title: op.title } : {}), ops: op.ops ?? [] })
          return { ...this.result(op, 'APPLIED', null, null), cardResults: results, conflictVersionId }
        }
        case 'TRASH_NOTE':
          await this.notes.trash(userId, op.noteId)
          return this.result(op, 'APPLIED', null, null)
        case 'RESTORE_NOTE':
          await this.notes.restore(userId, op.noteId)
          return this.result(op, 'APPLIED', null, null)
      }
    } catch (e) {
      if (e instanceof AppError) {
        if (e.code === ErrorCode.UNAUTHENTICATED) throw e
        if (e.code === ErrorCode.RATE_LIMITED) return this.result(op, 'RETRY', e.code, e.message)
        return this.result(op, 'REJECTED', e.code, e.message)
      }
      this.log.error(`sync op ${op.kind} on note ${op.noteId} failed: ${(e as Error).message}`)
      return this.result(op, 'RETRY', ErrorCode.INTERNAL, 'Something went wrong; it will be sent again.')
    }
  }

  private result(op: SyncOp, status: SyncOpResult['status'], code: ErrorCode | null, message: string | null): SyncOpResult {
    return { clientOpId: op.clientOpId, status, code, message, noteId: op.noteId, cardResults: [], conflictVersionId: null }
  }

  private async remember(userId: string, result: SyncOpResult): Promise<void> {
    await this.db.syncOpLog.createMany({ data: [{ clientOpId: result.clientOpId, userId, result: result as unknown as Prisma.InputJsonValue }], skipDuplicates: true })
  }

  /**
   * What changed since the device's last sync (`since`, the cursor it kept) or the previous page of this one (`after`),
   * oldest change first: each note with all its cards (the draft for owners and editors, the published version for
   * readers). `liveNoteIds` lists every note the device may keep.
   */
  async pull(userId: string, since: string | null | undefined, after: string | null | undefined, first: number | null | undefined) {
    const size = Math.min(Math.max(first ?? 20, 1), SYNC_LIMITS.notesPerPull)
    const scope: Prisma.NoteWhereInput = { OR: [{ ownerId: userId }, { shares: { some: { userId } } }] }
    const page = decodeCursor(after, 2) as [string, string] | null
    const start = page ?? (decodeCursor(since, 2) as [string, string] | null)
    const from = start ? new Date(new Date(start[0]).getTime() - (page ? 0 : OVERLAP_MS)) : null
    const rows = await this.db.note.findMany({
      where: from ? { AND: [scope, page ? { OR: [{ updatedAt: { gt: from } }, { updatedAt: from, id: { gt: page[1] } }] } : { updatedAt: { gte: from } }] } : scope,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: size + 1,
    })
    const actor = await this.notes.actor(userId)
    const notes: { opened: OpenedNote; cards: (SnapshotCard & { noteId: string })[] }[] = []
    for (const row of rows.slice(0, size)) {
      const opened = await this.notes.open(userId, row.id, actor)
      if (!opened) continue
      notes.push({ opened, cards: (await this.allCards(opened)).map((c) => ({ ...c, noteId: row.id })) })
    }
    const live = await this.db.note.findMany({ where: { OR: [{ ownerId: userId }, { AND: [visibleNotesWhere(userId), { shares: { some: { userId } } }] }] }, select: { id: true } })
    const last = rows.slice(0, size).at(-1)
    const cursor = last ? encodeCursor([last.updatedAt.toISOString(), last.id]) : (after ?? since ?? null)
    return { notes, liveNoteIds: live.map((n) => n.id), cursor, hasMore: rows.length > size }
  }

  private async allCards(opened: OpenedNote): Promise<SnapshotCard[]> {
    if (opened.access === 'READER') {
      const version = await this.db.noteVersion.findUniqueOrThrow({ where: { id: opened.note.publishedVersionId! }, select: { cards: true } })
      return version.cards as unknown as SnapshotCard[]
    }
    const cards = await this.db.card.findMany({ where: { noteId: opened.note.id, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })
    return cards.map((c) => ({ id: c.id, type: c.type, position: c.position, content: c.content, revision: c.revision }))
  }
}

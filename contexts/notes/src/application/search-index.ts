import { Injectable, Logger } from '@nestjs/common'
import { cardPlainText } from '@lvn/contracts/validation'
import type { CardType } from '@lvn/contracts/domain'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import type { SnapshotCard } from '../domain/snapshot'

/** The notes context's search queue (§9.1 `search`): index-note, remove-note, reindex-all; run by apps/worker. */
export const NOTES_SEARCH_QUEUE = 'notes.search'
const BODY_CHARS = 100_000

/**
 * Keeps NoteSearchDocument in step with each note's published version (§10.4): asynchronous, through the search queue,
 * so publishing never waits for it. Rows say nothing about who may read a note; queries apply the read predicate.
 */
@Injectable()
export class SearchIndex {
  private readonly log = new Logger('SearchIndex')

  constructor(
    private readonly db: PrismaService,
    private readonly queues: Queues,
  ) {}

  /** Asks the worker to (re)index a note; the same published version is indexed once (BullMQ job ids take no colons). */
  async enqueue(noteId: string, versionId: string | null): Promise<void> {
    try {
      await this.queues.queue(NOTES_SEARCH_QUEUE).add('index-note', { noteId }, versionId ? { jobId: `${noteId}.${versionId}` } : {})
    } catch (e) {
      // Search catches up with the nightly reindex; publishing must not fail because Redis did.
      this.log.warn(`could not queue indexing of note ${noteId}: ${(e as Error).message}`)
    }
  }

  /** Builds the search row from the published version: title (A), topics (B), the words of every card (C). */
  async indexNote(noteId: string): Promise<'indexed' | 'removed'> {
    const note = await this.db.note.findUnique({ where: { id: noteId }, include: { publishedVersion: true, topics: { include: { topic: true } } } })
    if (!note?.publishedVersion) {
      await this.db.noteSearchDocument.deleteMany({ where: { noteId } })
      return 'removed'
    }
    const version = note.publishedVersion
    const body = (version.cards as unknown as SnapshotCard[])
      .map((c) => cardPlainText(c.type as CardType, c.content))
      .filter(Boolean)
      .join('\n')
      .slice(0, BODY_CHARS)
    const topics = note.topics.map((t) => t.topic.title).join(' · ')
    await this.db.$executeRaw`
      INSERT INTO "notes"."NoteSearchDocument" ("noteId", "versionId", "title", "topics", "body", "document", "updatedAt")
      VALUES (${noteId}::uuid, ${version.id}::uuid, ${version.title}, ${topics}, ${body},
        setweight(to_tsvector('english', ${version.title}), 'A') || setweight(to_tsvector('english', ${topics}), 'B') || setweight(to_tsvector('english', ${body}), 'C'),
        now())
      ON CONFLICT ("noteId") DO UPDATE SET "versionId" = EXCLUDED."versionId", "title" = EXCLUDED."title", "topics" = EXCLUDED."topics",
        "body" = EXCLUDED."body", "document" = EXCLUDED."document", "updatedAt" = now()`
    return 'indexed'
  }

  /** Every published note again, 500 at a time (§10.4 reindex-all); safe while writes continue. */
  async reindexAll(): Promise<number> {
    let after: string | undefined
    let count = 0
    for (;;) {
      const batch = await this.db.note.findMany({ where: { publishedVersionId: { not: null }, ...(after ? { id: { gt: after } } : {}) }, select: { id: true }, orderBy: { id: 'asc' }, take: 500 })
      if (!batch.length) return count
      for (const { id } of batch) await this.indexNote(id)
      count += batch.length
      after = batch.at(-1)!.id
    }
  }
}

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type { CardType } from '@lvn/contracts/domain'
import { cardPlainText } from '@lvn/contracts/validation'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { EMBEDDINGS, PEOPLE, type Embeddings, type NoteRetrieval, type People, type RetrievalScope, type RetrievedChunk } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { chunkCards, toVector } from '../domain/chunking'
import { visibleNotesWhere } from '../domain/note-access'
import type { SemanticSearch } from './search-ranking'

/** The notes context's embedding queue (ADR-0060): run one at a time by apps/worker, beside the GPU's AI tasks. */
export const NOTES_CHUNKS_QUEUE = 'notes.chunks'
/** Texts per embedding call */
const BATCH = 32
/** The most notes a bounded scope searches among, newest published first */
const CANDIDATE_CAP = 10_000

/**
 * A published version's chunks and their embeddings (§10.2, ADR-0060). `NotePublished` queues the note; the worker
 * replaces its chunks with the current version's, and a nightly sweep catches what was missed (AI was off, a new
 * embedding model). Chunks go with their note (the foreign key cascades); who may read them is the read predicate's.
 */
@Injectable()
export class NoteChunks implements OnModuleInit {
  private readonly log = new Logger('NoteChunks')

  constructor(
    private readonly db: PrismaService,
    private readonly queues: Queues,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('NotePublished', (e) => this.queue(e.payload.noteId, e.payload.versionId))
  }

  async queue(noteId: string, versionId: string): Promise<void> {
    await this.queues.queue(NOTES_CHUNKS_QUEUE).add('embed-note', { noteId }, { jobId: `${noteId}.${versionId}` })
  }

  /** The note's chunks for its current published version: made, kept (already there for this model) or removed. */
  async embedNote(noteId: string): Promise<'made' | 'kept' | 'removed' | 'off'> {
    const note = await this.db.note.findUnique({ where: { id: noteId }, select: { title: true, visibility: true, publishedVersion: { select: { id: true, title: true, cards: true } } } })
    if (!note?.publishedVersion) {
      await this.db.noteChunk.deleteMany({ where: { noteId } })
      return 'removed'
    }
    const model = await this.embeddings.model()
    if (!model) return 'off'
    const version = note.publishedVersion
    if (await this.db.noteChunk.findFirst({ where: { noteId, versionId: version.id, model }, select: { id: true } })) return 'kept'
    const cards = (version.cards as { id: string; type: CardType; content: unknown }[]).map((c) => ({ id: c.id, text: cardPlainText(c.type, c.content) }))
    const chunks = chunkCards(cards)
    const title = version.title || note.title
    const vectors: number[][] = []
    let used = model
    for (let i = 0; i < chunks.length; i += BATCH) {
      // The title goes with each chunk into the embedding, not into its stored text.
      const batch = chunks.slice(i, i + BATCH).map((c) => (title ? `${title}\n\n${c.text}` : c.text))
      const out = await this.embeddings.embed(batch, { userId: null, private: note.visibility !== 'PUBLIC', task: 'EMBED' })
      vectors.push(...out.vectors)
      used = out.model
    }
    await this.db.$transaction([
      this.db.noteChunk.deleteMany({ where: { noteId } }),
      ...chunks.map(
        (c, i) => this.db.$executeRaw`
          INSERT INTO "notes"."NoteChunk" ("id", "noteId", "versionId", "position", "cardIds", "text", "tokens", "model", "embedding")
          VALUES (${newId()}::uuid, ${noteId}::uuid, ${version.id}::uuid, ${c.position}, ${c.cardIds}::uuid[], ${c.text}, ${c.tokens}, ${used}, ${toVector(vectors[i]!)}::vector)`,
      ),
    ])
    return 'made'
  }

  /** Nightly: published notes whose current version has no chunks from the current model. */
  async queueMissing(limit = 5000): Promise<number> {
    const model = await this.embeddings.model()
    if (!model) return 0
    const rows = await this.db.$queryRaw<{ id: string; versionId: string }[]>`
      SELECT n."id", n."publishedVersionId" AS "versionId" FROM "notes"."Note" n
      WHERE n."publishedVersionId" IS NOT NULL AND n."deletedAt" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "notes"."NoteChunk" c WHERE c."noteId" = n."id" AND c."versionId" = n."publishedVersionId" AND c."model" = ${model})
      ORDER BY n."publishedAt" DESC LIMIT ${limit}`
    for (const r of rows) await this.queue(r.id, `${r.versionId}.${model}`)
    if (rows.length) this.log.log(`queued ${rows.length} notes to embed`)
    return rows.length
  }
}

interface ChunkRow {
  noteId: string
  versionId: string
  cardIds: string[]
  text: string
  title: string
  visibility: RetrievedChunk['visibility']
  similarity: number
}

/**
 * The NOTE_RETRIEVAL facade (ADR-0060): the chunks nearest a question among the notes a person may read, the read rule
 * decided in Postgres before the vector search. Bounded scopes take their candidates from `visibleNotesWhere`; public
 * notes are the predicate's public branch, joined in the vector query (the RAG leakage test holds it to the predicate).
 * Either way the predicate runs once more over the notes found before anything leaves.
 */
@Injectable()
export class NoteRetrievalFacade implements NoteRetrieval {
  constructor(
    private readonly db: PrismaService,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  async nearest(viewerId: string, embedding: number[], scope: RetrievalScope, limit: number): Promise<RetrievedChunk[]> {
    const vector = toVector(embedding)
    const blocked = await this.people.blockedIds(viewerId)
    let rows: ChunkRow[]
    if (scope.kind === 'PUBLIC') {
      rows = await this.search(
        (tx) => tx.$queryRaw<ChunkRow[]>`
          SELECT c."noteId", c."versionId", c."cardIds", c."text", n."title", n."visibility"::text AS "visibility", 1 - (c."embedding" <=> ${vector}::vector) AS "similarity"
          FROM "notes"."NoteChunk" c JOIN "notes"."Note" n ON n."id" = c."noteId" AND n."publishedVersionId" = c."versionId"
          WHERE n."deletedAt" IS NULL AND n."visibility" = 'PUBLIC' AND n."moderation" = 'OK' AND NOT (n."ownerId" = ANY(${blocked}::uuid[]))
          ORDER BY c."embedding" <=> ${vector}::vector LIMIT ${limit}`,
      )
    } else {
      const candidates = await this.db.note.findMany({
        where: { AND: [visibleNotesWhere(viewerId), scopeWhere(viewerId, scope), ...(blocked.length ? [{ ownerId: { notIn: blocked } }] : [])] },
        select: { id: true },
        orderBy: { publishedAt: 'desc' },
        take: CANDIDATE_CAP,
      })
      if (!candidates.length) return []
      const ids = candidates.map((n) => n.id)
      rows = await this.search(
        (tx) => tx.$queryRaw<ChunkRow[]>`
          SELECT c."noteId", c."versionId", c."cardIds", c."text", n."title", n."visibility"::text AS "visibility", 1 - (c."embedding" <=> ${vector}::vector) AS "similarity"
          FROM "notes"."NoteChunk" c JOIN "notes"."Note" n ON n."id" = c."noteId" AND n."publishedVersionId" = c."versionId"
          WHERE c."noteId" = ANY(${ids}::uuid[])
          ORDER BY c."embedding" <=> ${vector}::vector LIMIT ${limit}`,
      )
    }
    if (!rows.length) return []
    // The read rule once more over the few notes found: nothing leaves that the asker cannot open.
    const found = [...new Set(rows.map((r) => r.noteId))]
    const readable = new Set((await this.db.note.findMany({ where: { AND: [visibleNotesWhere(viewerId), { id: { in: found } }] }, select: { id: true } })).map((n) => n.id))
    return rows
      .filter((r) => readable.has(r.noteId))
      .map((r) => ({ noteId: r.noteId, versionId: r.versionId, title: r.title, visibility: r.visibility, cardIds: r.cardIds, text: r.text, similarity: Number(r.similarity) }))
      .sort((a, b) => b.similarity - a.similarity)
  }

  /** A vector search that filtering cannot empty: HNSW keeps scanning until it has enough rows (pgvector 0.8). */
  private search<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL hnsw.iterative_scan = relaxed_order')
      return run(tx)
    })
  }
}

/** A bounded scope as a note filter, always alongside the read predicate. */
function scopeWhere(viewerId: string, scope: Exclude<RetrievalScope, { kind: 'PUBLIC' }>): Prisma.NoteWhereInput {
  switch (scope.kind) {
    case 'MY_NOTES':
      return { ownerId: viewerId }
    case 'MY_PLACES':
      return {
        OR: [
          { groupShares: { some: { group: { deletedAt: null, members: { some: { userId: viewerId } } } } } },
          { classroomShares: { some: { classroom: { deletedAt: null, members: { some: { userId: viewerId } } } } } },
        ],
      }
    case 'WORKSPACE':
      return { groupShares: { some: { groupId: scope.groupId } } }
  }
}

/**
 * Hybrid search's semantic side (ADR-0057), on the chunks' embeddings: the notes nearest a query, best first, before
 * any read rule (search applies the predicate before it fuses). Empty while AI is off.
 */
@Injectable()
export class PgvectorSemanticSearch implements SemanticSearch {
  private readonly log = new Logger('PgvectorSemanticSearch')

  constructor(
    private readonly db: PrismaService,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
  ) {}

  async similarNotes(text: string, limit: number): Promise<string[]> {
    if (!text.trim() || !(await this.embeddings.model())) return []
    try {
      const { vectors } = await this.embeddings.embed([text], { userId: null, private: false, task: 'EMBED_QUERY' })
      const vector = toVector(vectors[0]!)
      const rows = await this.db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL hnsw.iterative_scan = relaxed_order')
        return tx.$queryRaw<{ noteId: string }[]>`
          SELECT t."noteId" FROM (
            SELECT c."noteId", c."embedding" <=> ${vector}::vector AS "distance"
            FROM "notes"."NoteChunk" c JOIN "notes"."Note" n ON n."id" = c."noteId" AND n."publishedVersionId" = c."versionId"
            WHERE n."deletedAt" IS NULL
            ORDER BY c."embedding" <=> ${vector}::vector LIMIT ${limit * 4}
          ) t GROUP BY t."noteId" ORDER BY min(t."distance") LIMIT ${limit}`
      })
      return rows.map((r) => r.noteId)
    } catch (e) {
      // Search goes on by keywords alone (ADR-0057).
      this.log.warn(`semantic search skipped: ${(e as Error).message}`)
      return []
    }
  }
}

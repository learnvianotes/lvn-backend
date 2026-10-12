import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, PLACES, type People, type Places } from '@lvn-backend/facades'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import type { Typesense } from '../infrastructure/typesense'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { aliasName, COLLECTIONS, ENGLISH_STOPWORDS, schemaOf, STOPWORDS_SET, versionName, versionsOf, type CollectionDef, type SearchEntityName } from './search-collections'
import { classroomDocument, forTypesense, groupDocument, noteDocuments, personDocument, topicDocuments, type NoteDocument } from './search-documents'

/** The notes context's search queue (§9.1 `search`): the nightly reindex-all; run by apps/worker. */
export const NOTES_SEARCH_QUEUE = 'notes.search'
/** Typesense's client, or null when it is not configured (ADR-0055). */
export const TYPESENSE = Symbol('TYPESENSE')

/** Outbox rows per turn, and documents per batch (§11: batches of 500). */
const TURN = 500
/** §11: a stale window above 60 s is an incident. */
const LAG_WARNING_MS = 60_000
/** One drainer at a time, across workers: a transaction-scoped advisory lock on this key. */
const DRAIN_LOCK = 4_055_055
const ENTITIES: SearchEntityName[] = ['NOTE', 'USER', 'TOPIC', 'GROUP', 'CLASSROOM']

/**
 * Keeps search's indexes in step with Postgres (ADR-0055): the Postgres provider's `NoteSearchDocument` and, when
 * configured, Typesense's collections. Changes reach `SearchChange` from triggers on notes' tables and from other
 * contexts' events; the worker drains it in order — read the rows, read the current state, write, delete exactly the
 * rows read — so a change committed after its state was read always leaves a row for the next turn (the version
 * check). Re-indexing everything goes through the same drainer, and so does building a new collection version.
 */
@Injectable()
export class SearchIndex implements OnModuleInit {
  private readonly log = new Logger('SearchIndex')
  private names: { list: string[]; at: number } | null = null

  constructor(
    private readonly db: PrismaService,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
    @Inject(TYPESENSE) private readonly typesense: Typesense | null,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(PLACES) private readonly places: Places,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    // What people search finds lives in `users`; its events stand in for the triggers notes' own tables have.
    const person = ({ payload }: { payload: { userId: string } }) => this.touch('USER', [payload.userId])
    this.events.subscribe('UserRegistered', person)
    this.events.subscribe('PersonChanged', person)
    this.events.subscribe('RoleChanged', person)
    this.events.subscribe('UserDeleted', person)
    // Groups and classes live in `core` (ADR-0056); a membership changes the member count search ranks them by.
    const group = ({ payload }: { payload: { groupId: string } }) => this.touch('GROUP', [payload.groupId])
    for (const name of ['GroupCreated', 'GroupUpdated', 'GroupDeleted', 'GroupRestored', 'GroupMembershipChanged'] as const) this.events.subscribe(name, group)
    const classroom = ({ payload }: { payload: { classroomId: string } }) => this.touch('CLASSROOM', [payload.classroomId])
    for (const name of ['ClassroomCreated', 'ClassroomUpdated', 'ClassroomDeleted', 'ClassroomMembershipChanged'] as const) this.events.subscribe(name, classroom)
  }

  private get prefix(): string {
    return this.config.search.typesense?.prefix ?? ''
  }

  /** Marks entities for (re)indexing; the drainer writes them within a second or two. */
  async touch(entity: SearchEntityName, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += TURN) await this.db.searchChange.createMany({ data: ids.slice(i, i + TURN).map((entityId) => ({ entity, entityId })) })
  }

  /**
   * Marks every entity of a kind, and every document an index holds for one (so documents whose entity is gone are
   * removed too): §11's reindex-all, through the drainer, so it never races a live change. Returns the last outbox id.
   */
  async touchAll(entity: SearchEntityName): Promise<bigint> {
    if (entity === 'NOTE') {
      await this.db.$executeRaw`INSERT INTO "notes"."SearchChange" ("entity", "entityId") SELECT 'NOTE', "id" FROM "notes"."Note" WHERE "publishedVersionId" IS NOT NULL AND "deletedAt" IS NULL`
      await this.db.$executeRaw`INSERT INTO "notes"."SearchChange" ("entity", "entityId") SELECT 'NOTE', "noteId" FROM "notes"."NoteSearchDocument"`
    } else if (entity === 'TOPIC') {
      await this.db.$executeRaw`INSERT INTO "notes"."SearchChange" ("entity", "entityId") SELECT 'TOPIC', "id" FROM "notes"."Topic"`
    } else {
      const page = (after: string | null) => (entity === 'USER' ? this.people.personIdsAfter(after, TURN) : this.places.placeIdsAfter(entity, after, TURN))
      for (let after: string | null = null; ; ) {
        const ids = await page(after)
        if (!ids.length) break
        await this.touch(entity, ids)
        after = ids.at(-1)!
      }
    }
    for (const name of await this.versions(COLLECTIONS[entity])) await this.touch(entity, await this.typesense!.ids(name))
    return (await this.db.searchChange.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? 0n
  }

  /** §11 reindex-all: every note, person and topic again (nightly, and on demand). */
  async reindexAll(): Promise<void> {
    for (const entity of ENTITIES) await this.touchAll(entity)
  }

  /**
   * One turn: at most 500 rows, oldest first; returns how many were done. 0 when the outbox is empty or another
   * drainer holds the lock. When Typesense cannot be written, the Postgres index still takes the next rows (marked
   * `postgresAt`, kept for Typesense) and the error is thrown after the turn is saved.
   */
  async drain(): Promise<number> {
    let failure: Error | null = null
    const done = await this.db.$transaction(
      async (tx) => {
        const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${DRAIN_LOCK}) AS locked`
        if (!lock?.locked) return 0
        const rows = await tx.searchChange.findMany({ orderBy: { id: 'asc' }, take: TURN })
        if (!rows.length) {
          await this.advanceAliases(tx)
          return 0
        }
        const idsOf = (list: typeof rows, entity: SearchEntityName) => [...new Set(list.filter((r) => r.entity === entity).map((r) => r.entityId))]
        // Read after the rows: whatever changed since has a row of its own for a later turn.
        const docs = await noteDocuments(this.db, idsOf(rows, 'NOTE'))
        const unmarked = new Set(idsOf(rows.filter((r) => !r.postgresAt), 'NOTE'))
        await this.writePostgres(new Map([...docs].filter(([id]) => unmarked.has(id))))
        try {
          for (const entity of ENTITIES) {
            const ids = idsOf(rows, entity)
            if (ids.length) await this.writeTypesense(entity, ids, docs)
          }
        } catch (e) {
          failure = e as Error
          // Keep the fallback's index moving: mark what Postgres has, and give it the next rows too.
          const more = await tx.searchChange.findMany({ where: { postgresAt: null, id: { gt: rows.at(-1)!.id } }, orderBy: { id: 'asc' }, take: TURN })
          await this.writePostgres(await noteDocuments(this.db, idsOf(more, 'NOTE')))
          const marked = [...rows.filter((r) => !r.postgresAt), ...more].map((r) => r.id)
          await tx.searchChange.updateMany({ where: { id: { in: marked } }, data: { postgresAt: new Date() } })
          return marked.length
        }
        await tx.searchChange.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
        this.reportLag(rows[0]!.createdAt, rows.length)
        await this.advanceAliases(tx)
        return rows.length
      },
      { timeout: 120_000, maxWait: 10_000 },
    )
    if (failure) throw failure
    return done
  }

  private lagLoggedAt = 0

  private reportLag(oldest: Date, count: number): void {
    const lag = Date.now() - oldest.getTime()
    if (lag <= LAG_WARNING_MS) return this.log.debug(`indexed ${count} changes, ${lag} ms after the oldest`)
    if (Date.now() - this.lagLoggedAt < LAG_WARNING_MS) return
    this.lagLoggedAt = Date.now()
    this.log.warn(`search index is ${Math.round(lag / 1000)} s behind (§11: past 60 s is an incident)`)
  }

  /** Drains until the outbox is empty (tests and scripts; the worker runs `drain` in a loop). */
  async drainAll(): Promise<number> {
    let total = 0
    for (;;) {
      const n = await this.drain()
      total += n
      if (n < TURN) return total
    }
  }

  /** Writes one note to both indexes now, outside the outbox (tests). */
  async indexNote(noteId: string): Promise<'indexed' | 'removed'> {
    const docs = await noteDocuments(this.db, [noteId])
    await this.writePostgres(docs)
    await this.writeTypesense('NOTE', [noteId], docs)
    return docs.get(noteId) ? 'indexed' : 'removed'
  }

  /**
   * Creates what Typesense lacks and starts any rebuild (ADR-0055); the worker calls it when it starts. A collection
   * version that does not exist yet is created and filled through the outbox; the alias moves to it once the drainer
   * has passed the rows that fill it.
   */
  async ensureCollections(): Promise<void> {
    const ts = this.typesense
    if (!ts) return
    await ts.setStopwords(this.prefix + STOPWORDS_SET, ENGLISH_STOPWORDS)
    const names = await this.collectionNames(true)
    for (const def of Object.values(COLLECTIONS)) {
      const target = versionName(this.prefix, def)
      const row = await this.db.searchCollection.findUnique({ where: { name: def.name } })
      const exists = names.includes(target)
      if (!exists) await ts.createCollection(schemaOf(this.prefix, def))
      if (exists && (await ts.alias(aliasName(this.prefix, def))) === target) {
        if (row?.version !== def.version || row.marker !== null) {
          await this.db.searchCollection.upsert({ where: { name: def.name }, create: { name: def.name, version: def.version, aliasedAt: new Date() }, update: { version: def.version, marker: null } })
        }
        continue
      }
      // Already being built (the worker restarted meanwhile): the drainer carries on.
      if (exists && row?.version === def.version && row.marker !== null) continue
      this.names = null
      const marker = await this.touchAll(def.entity)
      await this.db.searchCollection.upsert({ where: { name: def.name }, create: { name: def.name, version: def.version, marker }, update: { version: def.version, marker, aliasedAt: null } })
      this.log.log(`building search collection ${target}`)
    }
  }

  private async advanceAliases(tx: Prisma.TransactionClient): Promise<void> {
    const ts = this.typesense
    if (!ts) return
    for (const row of await tx.searchCollection.findMany({ where: { marker: { not: null } } })) {
      const def = Object.values(COLLECTIONS).find((d) => d.name === row.name)
      if (!def || def.version !== row.version) continue
      if (await tx.searchChange.findFirst({ where: { entity: def.entity, id: { lte: row.marker! } }, select: { id: true } })) continue
      await ts.setAlias(aliasName(this.prefix, def), versionName(this.prefix, def))
      for (const old of versionsOf(this.prefix, def, await this.collectionNames(true))) if (old.version !== def.version) await ts.deleteCollection(old.name)
      this.names = null
      await tx.searchCollection.update({ where: { name: row.name }, data: { marker: null, aliasedAt: new Date() } })
      this.log.log(`search collection ${versionName(this.prefix, def)} is complete and answers as ${aliasName(this.prefix, def)}`)
    }
  }

  /** The Postgres provider's rows for these notes; a note search must not hold (a null document) is removed. */
  private async writePostgres(docs: Map<string, NoteDocument | null>): Promise<void> {
    const gone = [...docs].filter(([, d]) => !d).map(([id]) => id)
    if (gone.length) await this.db.noteSearchDocument.deleteMany({ where: { noteId: { in: gone } } })
    for (const d of docs.values()) {
      if (!d) continue
      const topics = d.topics.join(' · ')
      await this.db.$executeRaw`
        INSERT INTO "notes"."NoteSearchDocument" ("noteId", "versionId", "title", "topics", "body", "document", "updatedAt")
        VALUES (${d.id}::uuid, ${d.versionId}::uuid, ${d.title}, ${topics}, ${d.body},
          setweight(to_tsvector('english', ${d.title}), 'A') || setweight(to_tsvector('english', ${topics}), 'B') || setweight(to_tsvector('english', ${d.body}), 'C'),
          now())
        ON CONFLICT ("noteId") DO UPDATE SET "versionId" = EXCLUDED."versionId", "title" = EXCLUDED."title", "topics" = EXCLUDED."topics",
          "body" = EXCLUDED."body", "document" = EXCLUDED."document", "updatedAt" = now()`
    }
  }

  /** Typesense's documents for these entities, from their current state; one that must not be found is removed. */
  private async writeTypesense(entity: SearchEntityName, ids: string[], notes: Map<string, NoteDocument | null>): Promise<void> {
    if (!this.typesense) return
    let docs: Map<string, object | null>
    if (entity === 'NOTE') {
      docs = new Map(ids.map((id) => [id, notes.get(id) ? forTypesense(notes.get(id)!) : null]))
    } else if (entity === 'TOPIC') {
      docs = await topicDocuments(this.db, ids)
    } else {
      docs = new Map<string, object | null>(ids.map((id) => [id, null]))
      if (entity === 'USER') for (const p of await this.people.searchProfiles(ids)) docs.set(p.id, personDocument(p))
      if (entity === 'GROUP') for (const g of await this.places.groupsForSearch(ids)) docs.set(g.id, groupDocument(g))
      if (entity === 'CLASSROOM') for (const c of await this.places.classroomsForSearch(ids)) docs.set(c.id, classroomDocument(c))
    }
    await this.writeCollection(COLLECTIONS[entity], docs)
  }

  /** Every existing version of the collection gets the change, so one being built is complete when it takes over. */
  private async writeCollection(def: CollectionDef, docs: Map<string, object | null>): Promise<void> {
    const ts = this.typesense
    if (!ts) return
    const present = [...docs.values()].filter((d): d is object => d !== null)
    const gone = [...docs].filter(([, d]) => !d).map(([id]) => id)
    try {
      for (const name of await this.versions(def)) {
        await ts.upsert(name, present)
        await ts.remove(name, gone)
      }
    } catch (e) {
      // Collections may have changed under us (a rebuild elsewhere, Typesense restarted empty): look again next turn.
      this.names = null
      throw e
    }
  }

  private async versions(def: CollectionDef): Promise<string[]> {
    if (!this.typesense) return []
    return versionsOf(this.prefix, def, await this.collectionNames()).map((v) => v.name)
  }

  private async collectionNames(fresh = false): Promise<string[]> {
    if (!this.typesense) return []
    if (fresh || !this.names || Date.now() - this.names.at > 10_000) this.names = { list: await this.typesense.collections(), at: Date.now() }
    return this.names.list
  }
}

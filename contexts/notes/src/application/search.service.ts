import { createHash } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { metrics, SpanStatusCode, trace } from '@opentelemetry/api'
import { Errors } from '@lvn-backend/errors'
import { PEOPLE, PLACES, PLATFORM_SETTINGS, RESOURCE_SEARCH, type People, type Places, type PlatformSettings, type ResourceSearch } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { visibleNotesWhere } from '../domain/note-access'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import type { NoteFilters } from './search-filters'
import { lead, MAX_NOTES, noteFiltersWhere, placesOf, PostgresSearchProvider, TypesenseSearchProvider, type Found, type SearchProvider, type SearchQuery, type SearchScope, MAX_TOPICS } from './search-providers'
import { fuse, HYBRID_DEPTH, SEMANTIC_SEARCH, type SemanticSearch } from './search-ranking'

export { MATCH_END, MATCH_START, type SearchScope } from './search-providers'

/** How often a fallback is logged while Typesense stays unreachable. */
const FALLBACK_LOG_MS = 30_000
const ALL_SCOPES: SearchScope[] = ['NOTES', 'PEOPLE', 'TOPICS', 'GROUPS', 'CLASSROOMS', 'RESOURCES']
const tracer = trace.getTracer('lvn-notes')
const duration = metrics.getMeter('lvn-notes').createHistogram('lvn.search.duration', { unit: 'ms', description: 'Time to answer a search, by provider (ADR-0057)' })

/** Words of a query, safe to put in a tsquery: letters and digits only, at most eight. */
export function queryTerms(query: string): string[] {
  return (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8)
}

/** Ties a cursor to the search it continues, so a page of one search is never read as another's. */
const searchKey = (terms: string[], f: NoteFilters) =>
  createHash('sha256')
    .update(JSON.stringify([terms, f.kinds ?? [], f.subjectId ?? '', f.topicId ?? '', [...(f.topicIds ?? [])].sort(), f.authorId ?? '', f.sources ?? []]))
    .digest('base64url')
    .slice(0, 12)

export const encodeCursor = (offset: number, key: string) => Buffer.from(`${offset}.${key}`).toString('base64url')

function decodeCursor(after: string, key: string): number {
  const [offset, from] = Buffer.from(after, 'base64url').toString().split('.')
  const n = Number(offset)
  if (from !== key || !Number.isInteger(n) || n < 0 || n >= MAX_NOTES) throw Errors.validation('This page belongs to another search: search again.', ['after'])
  return n
}

export type SearchResult = Found & { notesCursor: string | null }

/**
 * One search over notes, people, topics, groups and classes (§11, ADR-0056, ADR-0057). `SEARCH_PROVIDER` chooses who answers;
 * when Typesense fails or is slower than `SEARCH_TIMEOUT_MS`, Postgres answers that request instead (ADR-0055). Either
 * way only notes the viewer may read come back, and nothing of people a block keeps apart (ADR-0043). Filters narrow
 * notes, and alone (without words) list the notes they allow, newest first.
 */
@Injectable()
export class SearchService {
  private readonly log = new Logger('Search')
  private fallbacks = { count: 0, loggedAt: 0 }

  constructor(
    private readonly db: PrismaService,
    private readonly postgres: PostgresSearchProvider,
    private readonly typesense: TypesenseSearchProvider,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(PLACES) private readonly places: Places,
    @Inject(RESOURCE_SEARCH) private readonly resources: ResourceSearch,
    @Inject(SEMANTIC_SEARCH) private readonly semantic: SemanticSearch | null,
    @Inject(PLATFORM_SETTINGS) private readonly settings: PlatformSettings,
  ) {}

  /** Who answers this deployment's searches when all is well. */
  get provider(): SearchProvider {
    return this.config.search.provider === 'typesense' ? this.typesense : this.postgres
  }

  /** One search, in a `search` span (never with its words) and timed by provider (ADR-0057). */
  search(
    viewerId: string | null,
    query: string,
    scopes: SearchScope[] | null | undefined,
    first: number | null | undefined,
    filters: NoteFilters | null = null,
    after: string | null = null,
  ): Promise<SearchResult> {
    return tracer.startActiveSpan('search', async (span) => {
      const started = performance.now()
      const how = { provider: this.provider.name as string, fallback: false, hybrid: false }
      try {
        const result = await this.answer(viewerId, query, scopes, first, filters, after, how)
        span.setAttributes({
          'search.provider': how.provider,
          'search.fallback': how.fallback,
          'search.hybrid': how.hybrid,
          'search.scopes': (scopes?.length ? scopes : ALL_SCOPES).join(','),
          'search.filtered': !!filters,
          'search.continued': !!after,
          'search.notes': result.notes.length,
          'search.people': result.people.length,
          'search.places': result.groups.length + result.classrooms.length,
        })
        this.log.debug(`search by ${how.provider}${how.fallback ? ' (fallback)' : ''}: ${result.notes.length} notes, ${result.people.length} people in ${Math.round(performance.now() - started)} ms`)
        return result
      } catch (e) {
        span.recordException(e as Error)
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw e
      } finally {
        duration.record(performance.now() - started, { provider: how.provider, fallback: how.fallback })
        span.end()
      }
    })
  }

  private async answer(
    viewerId: string | null,
    query: string,
    scopes: SearchScope[] | null | undefined,
    first: number | null | undefined,
    filters: NoteFilters | null,
    after: string | null,
    how: { provider: string; fallback: boolean; hybrid: boolean },
  ): Promise<SearchResult> {
    const text = query.trim()
    if (text.length > 100) throw Errors.validation('Search for at most 100 characters.', ['query'])
    const f = filters ?? {}
    if ((f.topicIds?.length ?? 0) > MAX_TOPICS) throw Errors.validation(`Filter by at most ${MAX_TOPICS} topics.`, ['filters', 'topicIds'])
    const terms = queryTerms(text)
    const filtered = !!(f.kinds?.length || f.subjectId || f.topicId || f.topicIds?.length || f.authorId || f.sources?.length)
    const empty = { notes: [], notesTotal: 0, people: [], topics: [], groups: [], classrooms: [], resources: [], notesCursor: null }
    if (!terms.length && !filtered) return empty
    const key = searchKey(terms, f)
    const offset = after ? decodeCursor(after, key) : 0
    const size = Math.min(Math.max(first ?? 5, 1), 20)
    const wanted = new Set<SearchScope>(scopes?.length ? scopes : ALL_SCOPES)
    // Group and class pages need an account: signed out, search finds neither.
    if (!viewerId) ['GROUPS', 'CLASSROOMS'].forEach((s) => wanted.delete(s as SearchScope))
    const q: SearchQuery = {
      viewerId,
      text,
      terms,
      size: Math.min(size, MAX_NOTES - offset),
      offset,
      scopes: wanted,
      filters: f,
      blockedIds: viewerId ? await this.people.blockedIds(viewerId) : [],
      ...(await placesOf(this.db, viewerId)),
    }
    // Hybrid ranking fuses the first HYBRID_DEPTH notes of each side, so the keyword side is asked for all of them.
    how.hybrid = this.settings.boolean('search_hybrid', this.config.search.hybrid) && this.semantic !== null && terms.length > 0 && wanted.has('NOTES')
    const asked = how.hybrid ? { ...q, offset: 0, size: HYBRID_DEPTH } : q
    let found: Found | null = null
    if (this.provider === this.typesense) {
      try {
        found = await this.typesense.find(asked)
      } catch (e) {
        how.fallback = true
        how.provider = this.postgres.name
        this.fellBack(e as Error)
      }
    }
    found ??= await this.postgres.find(asked)
    if (how.hybrid) found = await this.fused(found, q)
    found = await this.dropClosedNotes(found)
    const next = offset + q.size
    return { ...found, ...(await this.live(found, q)), notesCursor: q.scopes.has('NOTES') && next < found.notesTotal ? encodeCursor(next, key) : null }
  }

  /**
   * Keyword and semantic ranks fused (ADR-0057). Semantic candidates pass the read predicate and the filters first;
   * the page is cut from the fused order, and the other kinds come only with the first page.
   */
  private async fused(found: Found, q: SearchQuery): Promise<Found> {
    const similar = await this.semantic!.similarNotes(q.text, HYBRID_DEPTH, q.viewerId)
    const filters = noteFiltersWhere(q.filters, q)
    const readable =
      similar.length && filters
        ? new Set(
            (
              await this.db.note.findMany({
                where: { AND: [visibleNotesWhere(q.viewerId), { publishedVersionId: { not: null } }, ...filters, { id: { in: similar } }, ...(q.blockedIds.length ? [{ ownerId: { notIn: q.blockedIds } }] : [])] },
                select: { id: true },
              })
            ).map((n) => n.id),
          )
        : new Set<string>()
    const order = fuse([found.notes.map((h) => h.noteId), similar.filter((id) => readable.has(id))]).slice(0, HYBRID_DEPTH)
    const page = order.slice(q.offset, q.offset + q.size)
    const snippets = new Map(found.notes.map((h) => [h.noteId, h.snippet]))
    const missing = page.filter((id) => !snippets.has(id))
    if (missing.length) for (const d of await this.db.noteSearchDocument.findMany({ where: { noteId: { in: missing } }, select: { noteId: true, body: true } })) snippets.set(d.noteId, lead(d.body))
    const first = q.offset === 0
    return {
      notes: page.map((noteId) => ({ noteId, snippet: snippets.get(noteId) ?? '' })),
      notesTotal: order.length,
      people: first ? found.people.slice(0, q.size) : [],
      topics: first ? found.topics.slice(0, q.size) : [],
      groups: first ? found.groups.slice(0, q.size) : [],
      classrooms: first ? found.classrooms.slice(0, q.size) : [],
      resources: first ? found.resources.slice(0, q.size) : [],
    }
  }

  /**
   * Groups and classes as they stand now (an index can be a moment behind): gone ones dropped, private groups and
   * classes kept only for their members. What remains always resolves for the viewer in `core`.
   */
  private async live(found: Found, q: { groupIds: string[]; classroomIds: string[] }): Promise<Pick<Found, 'groups' | 'classrooms' | 'resources'>> {
    const [groups, classes, resources] = await Promise.all([this.places.groupsForSearch(found.groups), this.places.classroomsForSearch(found.classrooms), this.resources.forSearch(found.resources)])
    const groupOk = new Set(groups.filter((g) => g.privacy === 'PUBLIC' || q.groupIds.includes(g.id)).map((g) => g.id))
    const classOk = new Set(classes.filter((c) => q.classroomIds.includes(c.id)).map((c) => c.id))
    // A resource rejected a moment ago may still be in the index: only approved ones come back (ADR-0075).
    const resourceOk = new Set(resources.map((r) => r.id))
    return { groups: found.groups.filter((id) => groupOk.has(id)), classrooms: found.classrooms.filter((id) => classOk.has(id)), resources: found.resources.filter((id) => resourceOk.has(id)) }
  }

  /** A public note by an under-13 account stays out of search until a parent turns social features on. */
  private async dropClosedNotes(found: Found): Promise<Found> {
    if (!found.notes.length) return found
    const rows = await this.db.note.findMany({ where: { id: { in: found.notes.map((note) => note.noteId) } }, select: { id: true, ownerId: true } })
    const closed = new Set(await this.people.socialClosedIds(rows.map((row) => row.ownerId)))
    if (!closed.size) return found
    const hidden = new Set(rows.filter((row) => closed.has(row.ownerId)).map((row) => row.id))
    return { ...found, notes: found.notes.filter((note) => !hidden.has(note.noteId)) }
  }

  private fellBack(e: Error): void {
    this.fallbacks.count++
    if (Date.now() - this.fallbacks.loggedAt < FALLBACK_LOG_MS) return
    this.log.warn(`search.fallback: Postgres answered ${this.fallbacks.count} search(es) — ${e.message}`)
    this.fallbacks = { count: 0, loggedAt: Date.now() }
  }
}

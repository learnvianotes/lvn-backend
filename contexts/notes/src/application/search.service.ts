import { createHash } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PEOPLE, PLACES, type People, type Places } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import type { NoteFilters } from './search-filters'
import { MAX_NOTES, placesOf, PostgresSearchProvider, TypesenseSearchProvider, type Found, type SearchProvider, type SearchScope } from './search-providers'

export { MATCH_END, MATCH_START, type SearchScope } from './search-providers'

/** How often a fallback is logged while Typesense stays unreachable. */
const FALLBACK_LOG_MS = 30_000
const ALL_SCOPES: SearchScope[] = ['NOTES', 'PEOPLE', 'TOPICS', 'GROUPS', 'CLASSROOMS']

/** Words of a query, safe to put in a tsquery: letters and digits only, at most eight. */
export function queryTerms(query: string): string[] {
  return (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8)
}

/** Ties a cursor to the search it continues, so a page of one search is never read as another's. */
const searchKey = (terms: string[], f: NoteFilters) =>
  createHash('sha256')
    .update(JSON.stringify([terms, f.kinds ?? [], f.subjectId ?? '', f.topicId ?? '', f.authorId ?? '', f.sources ?? []]))
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
 * One search over notes, people, topics, groups and classes (§11, ADR-0056). `SEARCH_PROVIDER` chooses who answers;
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
  ) {}

  /** Who answers this deployment's searches when all is well. */
  get provider(): SearchProvider {
    return this.config.search.provider === 'typesense' ? this.typesense : this.postgres
  }

  async search(
    viewerId: string | null,
    query: string,
    scopes: SearchScope[] | null | undefined,
    first: number | null | undefined,
    filters: NoteFilters | null = null,
    after: string | null = null,
  ): Promise<SearchResult> {
    const text = query.trim()
    if (text.length > 100) throw Errors.validation('Search for at most 100 characters.', ['query'])
    const f = filters ?? {}
    const terms = queryTerms(text)
    const filtered = !!(f.kinds?.length || f.subjectId || f.topicId || f.authorId || f.sources?.length)
    const empty = { notes: [], notesTotal: 0, people: [], topics: [], groups: [], classrooms: [], notesCursor: null }
    if (!terms.length && !filtered) return empty
    const key = searchKey(terms, f)
    const offset = after ? decodeCursor(after, key) : 0
    const size = Math.min(Math.max(first ?? 5, 1), 20)
    const wanted = new Set<SearchScope>(scopes?.length ? scopes : ALL_SCOPES)
    // Group and class pages need an account: signed out, search finds neither.
    if (!viewerId) ['GROUPS', 'CLASSROOMS'].forEach((s) => wanted.delete(s as SearchScope))
    const q = {
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
    let found: Found | null = null
    if (this.provider === this.typesense) {
      try {
        found = await this.typesense.find(q)
      } catch (e) {
        this.fellBack(e as Error)
      }
    }
    found ??= await this.postgres.find(q)
    const next = offset + q.size
    return { ...found, ...(await this.live(found, q)), notesCursor: q.scopes.has('NOTES') && next < found.notesTotal ? encodeCursor(next, key) : null }
  }

  /**
   * Groups and classes as they stand now (an index can be a moment behind): gone ones dropped, private groups and
   * classes kept only for their members. What remains always resolves for the viewer in `core`.
   */
  private async live(found: Found, q: { groupIds: string[]; classroomIds: string[] }): Promise<Pick<Found, 'groups' | 'classrooms'>> {
    const [groups, classes] = await Promise.all([this.places.groupsForSearch(found.groups), this.places.classroomsForSearch(found.classrooms)])
    const groupOk = new Set(groups.filter((g) => g.privacy === 'PUBLIC' || q.groupIds.includes(g.id)).map((g) => g.id))
    const classOk = new Set(classes.filter((c) => q.classroomIds.includes(c.id)).map((c) => c.id))
    return { groups: found.groups.filter((id) => groupOk.has(id)), classrooms: found.classrooms.filter((id) => classOk.has(id)) }
  }

  private fellBack(e: Error): void {
    this.fallbacks.count++
    if (Date.now() - this.fallbacks.loggedAt < FALLBACK_LOG_MS) return
    this.log.warn(`search.fallback: Postgres answered ${this.fallbacks.count} search(es) — ${e.message}`)
    this.fallbacks = { count: 0, loggedAt: Date.now() }
  }
}

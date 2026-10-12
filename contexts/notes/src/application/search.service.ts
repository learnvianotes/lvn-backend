import { Inject, Injectable, Logger } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PEOPLE, type People } from '@lvn-backend/facades'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { PostgresSearchProvider, TypesenseSearchProvider, type Found, type SearchProvider, type SearchScope } from './search-providers'

export { MATCH_END, MATCH_START, type SearchScope } from './search-providers'

/** How often a fallback is logged while Typesense stays unreachable. */
const FALLBACK_LOG_MS = 30_000

/** Words of a query, safe to put in a tsquery: letters and digits only, at most eight. */
export function queryTerms(query: string): string[] {
  return (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8)
}

/**
 * One search over notes, people and topics (§11). `SEARCH_PROVIDER` chooses who answers; when Typesense fails or is
 * slower than `SEARCH_TIMEOUT_MS`, Postgres answers that request instead (ADR-0055). Either way only notes the viewer
 * may read come back, and nothing of people a block keeps apart (ADR-0043).
 */
@Injectable()
export class SearchService {
  private readonly log = new Logger('Search')
  private fallbacks = { count: 0, loggedAt: 0 }

  constructor(
    private readonly postgres: PostgresSearchProvider,
    private readonly typesense: TypesenseSearchProvider,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  /** Who answers this deployment's searches when all is well. */
  get provider(): SearchProvider {
    return this.config.search.provider === 'typesense' ? this.typesense : this.postgres
  }

  async search(viewerId: string | null, query: string, scopes: SearchScope[] | null | undefined, first: number | null | undefined): Promise<Found> {
    const text = query.trim()
    if (text.length > 100) throw Errors.validation('Search for at most 100 characters.', ['query'])
    const terms = queryTerms(text)
    if (!terms.length) return { notes: [], people: [], topics: [] }
    const q = {
      viewerId,
      text,
      terms,
      size: Math.min(Math.max(first ?? 5, 1), 20),
      scopes: new Set<SearchScope>(scopes?.length ? scopes : ['NOTES', 'PEOPLE', 'TOPICS']),
      blockedIds: viewerId ? await this.people.blockedIds(viewerId) : [],
    }
    if (this.provider === this.typesense) {
      try {
        return await this.typesense.find(q)
      } catch (e) {
        this.fellBack(e as Error)
      }
    }
    return this.postgres.find(q)
  }

  private fellBack(e: Error): void {
    this.fallbacks.count++
    if (Date.now() - this.fallbacks.loggedAt < FALLBACK_LOG_MS) return
    this.log.warn(`search.fallback: Postgres answered ${this.fallbacks.count} search(es) — ${e.message}`)
    this.fallbacks = { count: 0, loggedAt: Date.now() }
  }
}

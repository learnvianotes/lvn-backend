import { Inject, Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PEOPLE, type People, type Person } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { visibleNotesWhere } from '../domain/note-access'
import { OrganiseService } from './organise.service'

/** Matches in snippets are wrapped in these private-use characters, for clients to highlight. */
export const MATCH_START = ''
export const MATCH_END = ''
const CANDIDATES = 200

export type SearchScope = 'NOTES' | 'PEOPLE' | 'TOPICS'

/** Words of a query, safe to put in a tsquery: letters and digits only, at most eight. */
export function queryTerms(query: string): string[] {
  return (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8)
}

/**
 * One search over notes, people and topics (§10.4) — the Postgres provider of Phases 2–3. Notes match on their
 * published version (full text with English stemming, the last word as a prefix so results come while typing, and
 * trigram similarity of titles for typos), and only notes the viewer may read come back: candidates are filtered by
 * the same read predicate as every list (§5). Blocks leave out the other person and their notes (ADR-0043).
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly db: PrismaService,
    private readonly organise: OrganiseService,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  async search(viewerId: string | null, query: string, scopes: SearchScope[] | null | undefined, first: number | null | undefined) {
    const text = query.trim()
    if (text.length > 100) throw Errors.validation('Search for at most 100 characters.', ['query'])
    const size = Math.min(Math.max(first ?? 5, 1), 20)
    const wanted = new Set<SearchScope>(scopes?.length ? scopes : ['NOTES', 'PEOPLE', 'TOPICS'])
    const terms = queryTerms(text)
    if (!terms.length) return { notes: [], people: [], topics: [] }
    const [notes, people, topics] = await Promise.all([
      wanted.has('NOTES') ? this.notes(viewerId, text, terms, size) : [],
      wanted.has('PEOPLE') ? this.people.search(text, size, viewerId) : ([] as Person[]),
      wanted.has('TOPICS') ? this.organise.findTopics(text, null, viewerId).then((t) => t.slice(0, size)) : [],
    ])
    return { notes, people, topics }
  }

  private async notes(viewerId: string | null, text: string, terms: string[], size: number) {
    const tsquery = terms.map((t, i) => (i === terms.length - 1 ? `${t}:*` : t)).join(' & ')
    const options = `StartSel=${MATCH_START}, StopSel=${MATCH_END}, MaxWords=24, MinWords=10, MaxFragments=1`
    const candidates = await this.db.$queryRaw<{ noteId: string; snippet: string }[]>`
      SELECT d."noteId", ts_headline('english', d."body", q, ${options}) AS snippet
      FROM "notes"."NoteSearchDocument" d, to_tsquery('english', ${tsquery}) q
      WHERE d."document" @@ q OR d."title" % ${text}
      ORDER BY ts_rank_cd(d."document", q) + similarity(d."title", ${text}) DESC, d."noteId"
      LIMIT ${CANDIDATES}`
    if (!candidates.length) return []
    // Notes of people the viewer blocked, or who blocked the viewer, are left out (ADR-0043).
    const blocked = viewerId ? await this.people.blockedIds(viewerId) : []
    const visible = await this.db.note.findMany({
      where: { AND: [visibleNotesWhere(viewerId), { id: { in: candidates.map((c) => c.noteId) } }, ...(blocked.length ? [{ ownerId: { notIn: blocked } }] : [])] },
      select: { id: true },
    })
    const ok = new Set(visible.map((n) => n.id))
    return candidates.filter((c) => ok.has(c.noteId)).slice(0, size)
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { PEOPLE, type People } from '@lvn-backend/facades'
import { PrismaService, type Topic } from '@lvn-backend/prisma-base'
import type { Typesense } from '../infrastructure/typesense'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { visibleNotesWhere } from '../domain/note-access'
import { aliasName, COLLECTIONS, STOPWORDS_SET } from './search-collections'
import { todayDays } from './search-documents'
import { peopleFilter, topicsFilter, visibleNotesFilter } from './search-filters'
import { TYPESENSE } from './search-index'
import { OrganiseService } from './organise.service'

/** Matches in snippets are wrapped in these private-use characters, for clients to highlight. */
export const MATCH_START = ''
export const MATCH_END = ''

export type SearchScope = 'NOTES' | 'PEOPLE' | 'TOPICS'

/** One search, as every provider receives it. */
export interface SearchQuery {
  viewerId: string | null
  /** The query as typed (trimmed) */
  text: string
  /** Its words: letters and digits only, at most eight */
  terms: string[]
  /** Results per scope */
  size: number
  scopes: Set<SearchScope>
  /** People a block keeps apart from the viewer (ADR-0043) */
  blockedIds: string[]
}

export interface NoteHit {
  noteId: string
  snippet: string
}

export interface Found {
  notes: NoteHit[]
  /** Person ids, best first */
  people: string[]
  topics: Topic[]
}

/** §11: clients call one `search` field and never know which provider answered. */
export interface SearchProvider {
  readonly name: 'postgres' | 'typesense'
  find(q: SearchQuery): Promise<Found>
}

const CANDIDATES = 200

/**
 * The Postgres provider of Phases 2–3. Notes match on their published version (full text with English stemming, the
 * last word as a prefix so results come while typing, and trigram similarity of titles for typos); candidates are
 * filtered by the read predicate (§5). People and topics are read from their tables.
 */
@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  readonly name = 'postgres'

  constructor(
    private readonly db: PrismaService,
    private readonly organise: OrganiseService,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  async find(q: SearchQuery): Promise<Found> {
    const [notes, people, topics] = await Promise.all([
      q.scopes.has('NOTES') ? this.notes(q) : [],
      q.scopes.has('PEOPLE') ? this.people.search(q.text, q.size, q.viewerId).then((p) => p.map((x) => x.id)) : [],
      q.scopes.has('TOPICS') ? this.organise.findTopics(q.text, null, q.viewerId).then((t) => t.slice(0, q.size)) : [],
    ])
    return { notes, people, topics }
  }

  private async notes({ viewerId, text, terms, size, blockedIds }: SearchQuery): Promise<NoteHit[]> {
    const tsquery = terms.map((t, i) => (i === terms.length - 1 ? `${t}:*` : t)).join(' & ')
    const options = `StartSel=${MATCH_START}, StopSel=${MATCH_END}, MaxWords=24, MinWords=10, MaxFragments=1`
    const candidates = await this.db.$queryRaw<{ noteId: string; snippet: string }[]>`
      SELECT d."noteId", ts_headline('english', d."body", q, ${options}) AS snippet
      FROM "notes"."NoteSearchDocument" d, to_tsquery('english', ${tsquery}) q
      WHERE d."document" @@ q OR d."title" % ${text}
      ORDER BY ts_rank_cd(d."document", q) + similarity(d."title", ${text}) DESC, d."noteId"
      LIMIT ${CANDIDATES}`
    if (!candidates.length) return []
    const visible = await this.db.note.findMany({
      where: { AND: [visibleNotesWhere(viewerId), { id: { in: candidates.map((c) => c.noteId) } }, ...(blockedIds.length ? [{ ownerId: { notIn: blockedIds } }] : [])] },
      select: { id: true },
    })
    const ok = new Set(visible.map((n) => n.id))
    return candidates.filter((c) => ok.has(c.noteId)).slice(0, size)
  }
}

/** A match ending inside a word (a prefix or a stem) is widened to the whole word. */
const widen = (snippet: string) => snippet.replace(new RegExp(`${MATCH_END}([\\p{L}\\p{N}]+)`, 'gu'), `$1${MATCH_END}`)

/**
 * The Typesense provider (ADR-0055): all scopes in one request, each filtered in the engine by the viewer's reach,
 * built now from their groups, classes and blocks. Every word must match (the last as a prefix), with English
 * stemming and PostgreSQL's stop words; typos are tried only when nothing matches exactly.
 */
@Injectable()
export class TypesenseSearchProvider implements SearchProvider {
  readonly name = 'typesense'

  constructor(
    private readonly db: PrismaService,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
    @Inject(TYPESENSE) private readonly typesense: Typesense | null,
  ) {}

  async find(q: SearchQuery): Promise<Found> {
    const ts = this.typesense
    if (!ts) throw new Error('Typesense is not configured')
    const prefix = this.config.search.typesense!.prefix
    const words = { drop_tokens_threshold: 0, per_page: q.size, include_fields: 'id' }
    const stopwords = prefix + STOPWORDS_SET
    const searches: { scope: SearchScope; params: Record<string, unknown> }[] = []
    if (q.scopes.has('NOTES')) {
      searches.push({
        scope: 'NOTES',
        params: {
          collection: aliasName(prefix, COLLECTIONS.NOTE),
          q: q.text,
          query_by: 'title,topics,body',
          query_by_weights: '3,2,1',
          filter_by: visibleNotesFilter({ viewerId: q.viewerId, blockedIds: q.blockedIds, ...(await placesOf(this.db, q.viewerId)) }),
          ...words,
          stopwords,
          include_fields: 'id,lead',
          highlight_fields: 'body',
          highlight_start_tag: MATCH_START,
          highlight_end_tag: MATCH_END,
          highlight_affix_num_tokens: 12,
        },
      })
    }
    const person = q.text.replace(/^@/, '')
    if (q.scopes.has('PEOPLE') && person.length >= 2) {
      searches.push({
        scope: 'PEOPLE',
        params: { collection: aliasName(prefix, COLLECTIONS.USER), q: person, query_by: 'handle,displayName,headline,bio', query_by_weights: '4,4,1,1', filter_by: peopleFilter(todayDays(), q.blockedIds), ...words },
      })
    }
    if (q.scopes.has('TOPICS')) {
      searches.push({ scope: 'TOPICS', params: { collection: aliasName(prefix, COLLECTIONS.TOPIC), q: q.text, query_by: 'title,subject', query_by_weights: '2,1', filter_by: topicsFilter(q.viewerId), ...words, stopwords } })
    }
    const results = searches.length ? await ts.multiSearch<{ id: string; lead?: string }>(searches.map((s) => s.params), this.config.search.timeoutMs) : []
    const of = (scope: SearchScope) => results[searches.findIndex((s) => s.scope === scope)]?.hits ?? []
    const notes = of('NOTES').map((h) => {
      const body = h.highlights?.find((x) => x.field === 'body')?.snippet
      return { noteId: h.document.id, snippet: body ? widen(body) : (h.document.lead ?? '') }
    })
    const topicIds = of('TOPICS').map((h) => h.document.id)
    const rows = topicIds.length ? await this.db.topic.findMany({ where: { id: { in: topicIds } } }) : []
    const byId = new Map(rows.map((t) => [t.id, t]))
    return { notes, people: of('PEOPLE').map((h) => h.document.id), topics: topicIds.map((id) => byId.get(id)).filter((t): t is Topic => !!t) }
  }
}

/** The groups and classes a viewer is in, from notes' read models; deleted places are left out (as in §5's predicate). */
export async function placesOf(db: PrismaService, viewerId: string | null): Promise<{ groupIds: string[]; classroomIds: string[] }> {
  if (!viewerId) return { groupIds: [], classroomIds: [] }
  const [groups, classes] = await Promise.all([
    db.groupMemberRead.findMany({ where: { userId: viewerId, group: { deletedAt: null } }, select: { groupId: true } }),
    db.classroomMemberRead.findMany({ where: { userId: viewerId, classroom: { deletedAt: null } }, select: { classroomId: true } }),
  ])
  return { groupIds: groups.map((g) => g.groupId), classroomIds: classes.map((c) => c.classroomId) }
}

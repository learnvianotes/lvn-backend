import { Inject, Injectable } from '@nestjs/common'
import { PEOPLE, PLACES, PLATFORM_SETTINGS, RESOURCE_SEARCH, type People, type Places, type PlatformSettings, type ResourceSearch } from '@lvn-backend/facades'
import { PrismaService, type Prisma, type Topic } from '@lvn-backend/prisma-base'
import type { Typesense } from '../infrastructure/typesense'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { visibleNotesWhere } from '../domain/note-access'
import { aliasName, COLLECTIONS, STOPWORDS_SET } from './search-collections'
import { todayDays } from './search-documents'
import { classroomsFilter, groupsFilter, noteFiltersFilter, peopleFilter, resourcesFilter, topicsFilter, visibleNotesFilter, type NoteFilters } from './search-filters'
import { TYPESENSE } from './search-index'
import { OrganiseService } from './organise.service'

/** Matches in snippets are wrapped in these private-use characters, for clients to highlight. */
export const MATCH_START = '\uE000'
export const MATCH_END = '\uE001'
/** Notes one search reaches, page after page, on either provider (ADR-0056). */
export const MAX_NOTES = 200
/** How many topics one search may filter by (an exam's, ADR-0076) */
export const MAX_TOPICS = 20

export type SearchScope = 'NOTES' | 'PEOPLE' | 'TOPICS' | 'GROUPS' | 'CLASSROOMS' | 'RESOURCES'

/** One search, as every provider receives it. */
export interface SearchQuery {
  viewerId: string | null
  /** The query as typed (trimmed) */
  text: string
  /** Its words: letters and digits only, at most eight; none when filters alone list notes */
  terms: string[]
  /** Results per kind */
  size: number
  /** Notes already given on earlier pages (only notes come back past the first page) */
  offset: number
  scopes: Set<SearchScope>
  filters: NoteFilters
  /** People a block keeps apart from the viewer (ADR-0043) */
  blockedIds: string[]
  /** Groups and classes the viewer is in, from notes' read models; deleted places left out */
  groupIds: string[]
  classroomIds: string[]
}

export interface NoteHit {
  noteId: string
  snippet: string
}

export interface Found {
  notes: NoteHit[]
  /** How many notes the search reaches in all, up to MAX_NOTES */
  notesTotal: number
  /** Ids, best first */
  people: string[]
  topics: Topic[]
  groups: string[]
  classrooms: string[]
  /** Approved resources' ids, best first (ADR-0075) */
  resources: string[]
}

/** §11: clients call one `search` field and never know which provider answered. */
export interface SearchProvider {
  readonly name: 'postgres' | 'typesense'
  find(q: SearchQuery): Promise<Found>
}

const LEAD_WORDS = 24
export const lead = (body: string) => body.split(/\s+/).filter(Boolean).slice(0, LEAD_WORDS).join(' ')

/** The filters (ADR-0056) as Prisma conditions on notes, with the viewer's places for SHARED; null when nothing is left. */
export function noteFiltersWhere(f: NoteFilters, q: Pick<SearchQuery, 'viewerId' | 'groupIds' | 'classroomIds'>): Prisma.NoteWhereInput[] | null {
  const and: Prisma.NoteWhereInput[] = []
  if (f.kinds?.length) and.push({ kind: { in: f.kinds as Prisma.EnumNoteKindFilter['in'] } })
  if (f.subjectId) and.push({ topics: { some: { topic: { subjectId: f.subjectId } } } })
  if (f.topicId) and.push({ topics: { some: { topicId: f.topicId } } })
  if (f.topicIds?.length) and.push({ topics: { some: { topicId: { in: f.topicIds } } } })
  if (f.authorId) and.push({ ownerId: f.authorId })
  if (f.sources?.length) {
    const me = q.viewerId
    const from = f.sources.flatMap((source): Prisma.NoteWhereInput[] => {
      if (source === 'PUBLIC') return [me ? { ownerId: { not: me }, visibility: 'PUBLIC' } : { visibility: 'PUBLIC' }]
      if (!me) return []
      if (source === 'MINE') return [{ ownerId: me }]
      return [
        {
          ownerId: { not: me },
          OR: [{ shares: { some: { userId: me } } }, { groupShares: { some: { groupId: { in: q.groupIds } } } }, { classroomShares: { some: { classroomId: { in: q.classroomIds } } } }],
        },
      ]
    })
    if (!from.length) return null
    and.push({ OR: from })
  }
  return and
}

/**
 * The Postgres provider of Phases 2–3. Notes match on their published version (full text with English stemming, the
 * last word as a prefix so results come while typing, and trigram similarity of titles for typos); candidates are
 * filtered by the read predicate (§5) and the filters. People, topics, groups and classes are read from their tables.
 */
@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  readonly name = 'postgres'

  constructor(
    private readonly db: PrismaService,
    private readonly organise: OrganiseService,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(PLACES) private readonly places: Places,
    @Inject(RESOURCE_SEARCH) private readonly resources: ResourceSearch,
  ) {}

  async find(q: SearchQuery): Promise<Found> {
    const words = q.terms.length > 0
    const first = q.offset === 0
    const [notes, people, topics, groups, classrooms, resources] = await Promise.all([
      q.scopes.has('NOTES') ? this.notes(q) : { hits: [], total: 0 },
      first && words && q.scopes.has('PEOPLE') ? this.people.search(q.text, q.size, q.viewerId).then((p) => p.map((x) => x.id)) : [],
      first && words && q.scopes.has('TOPICS') ? this.organise.findTopics(q.text, q.filters.subjectId, q.viewerId).then((t) => t.slice(0, q.size)) : [],
      first && words && q.scopes.has('GROUPS') ? this.places.findGroups(q.terms, q.groupIds, q.size) : [],
      first && words && q.scopes.has('CLASSROOMS') ? this.places.findClassrooms(q.terms, q.classroomIds, q.size) : [],
      first && words && q.scopes.has('RESOURCES') ? this.resources.find(q.terms, q.blockedIds, q.size) : [],
    ])
    return { notes: notes.hits, notesTotal: notes.total, people, topics, groups, classrooms, resources }
  }

  private async notes(q: SearchQuery): Promise<{ hits: NoteHit[]; total: number }> {
    const filters = noteFiltersWhere(q.filters, q)
    if (!filters) return { hits: [], total: 0 }
    const where = (ids?: string[]): Prisma.NoteWhereInput => ({
      AND: [visibleNotesWhere(q.viewerId), { publishedVersionId: { not: null } }, ...filters, ...(ids ? [{ id: { in: ids } }] : []), ...(q.blockedIds.length ? [{ ownerId: { notIn: q.blockedIds } }] : [])],
    })
    if (!q.terms.length) {
      // Filters alone: the notes they allow, newest first.
      const [total, rows] = await Promise.all([
        this.db.note.count({ where: where() }),
        this.db.note.findMany({ where: where(), select: { id: true, searchDocument: { select: { body: true } } }, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], skip: q.offset, take: q.size }),
      ])
      return { hits: rows.map((r) => ({ noteId: r.id, snippet: lead(r.searchDocument?.body ?? '') })), total: Math.min(total, MAX_NOTES) }
    }
    const tsquery = q.terms.map((t, i) => (i === q.terms.length - 1 ? `${t}:*` : t)).join(' & ')
    const options = `StartSel=${MATCH_START}, StopSel=${MATCH_END}, MaxWords=24, MinWords=10, MaxFragments=1`
    const candidates = await this.db.$queryRaw<{ noteId: string; snippet: string }[]>`
      SELECT d."noteId", ts_headline('english', d."body", q, ${options}) AS snippet
      FROM "notes"."NoteSearchDocument" d, to_tsquery('english', ${tsquery}) q
      WHERE d."document" @@ q OR d."title" % ${q.text}
      ORDER BY ts_rank_cd(d."document", q) + similarity(d."title", ${q.text}) DESC, d."noteId"
      LIMIT ${MAX_NOTES}`
    if (!candidates.length) return { hits: [], total: 0 }
    const visible = await this.db.note.findMany({ where: where(candidates.map((c) => c.noteId)), select: { id: true } })
    const ok = new Set(visible.map((n) => n.id))
    const all = candidates.filter((c) => ok.has(c.noteId))
    return { hits: all.slice(q.offset, q.offset + q.size), total: all.length }
  }
}

/** A match ending inside a word (a prefix or a stem) is widened to the whole word. */
const widen = (snippet: string) => snippet.replace(new RegExp(`${MATCH_END}([\\p{L}\\p{N}]+)`, 'gu'), `$1${MATCH_END}`)

/**
 * The Typesense provider (ADR-0055): all kinds in one request, each filtered in the engine by the viewer's reach,
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
    @Inject(PLATFORM_SETTINGS) private readonly settings: PlatformSettings,
  ) {}

  async find(q: SearchQuery): Promise<Found> {
    const ts = this.typesense
    if (!ts) throw new Error('Typesense is not configured')
    const prefix = this.config.search.typesense!.prefix
    const words = q.terms.length > 0
    const first = q.offset === 0
    const matching = { drop_tokens_threshold: 0, include_fields: 'id' }
    const firstOnes = { ...matching, per_page: q.size }
    const stopwords = prefix + STOPWORDS_SET
    const searches: { scope: SearchScope; params: Record<string, unknown> }[] = []
    const narrowed = noteFiltersFilter(q.filters, { viewerId: q.viewerId, groupIds: q.groupIds, classroomIds: q.classroomIds, blockedIds: q.blockedIds })
    if (q.scopes.has('NOTES') && narrowed !== null) {
      const visible = visibleNotesFilter({ viewerId: q.viewerId, groupIds: q.groupIds, classroomIds: q.classroomIds, blockedIds: q.blockedIds })
      searches.push({
        scope: 'NOTES',
        params: {
          collection: aliasName(prefix, COLLECTIONS.NOTE),
          filter_by: narrowed ? `(${visible}) && ${narrowed}` : visible,
          ...matching,
          offset: q.offset,
          limit: q.size,
          include_fields: 'id,lead',
          ...(words
            ? { q: q.text, query_by: 'title,topics,body', query_by_weights: '3,2,1', stopwords, highlight_fields: 'body', highlight_start_tag: MATCH_START, highlight_end_tag: MATCH_END, highlight_affix_num_tokens: 12 }
            : { q: '*', sort_by: 'publishedAt:desc' }),
        },
      })
    }
    const person = q.text.replace(/^@/, '')
    if (first && words && q.scopes.has('PEOPLE') && person.length >= 2) {
      searches.push({ scope: 'PEOPLE', params: { collection: aliasName(prefix, COLLECTIONS.USER), q: person, query_by: 'handle,displayName,headline,bio', query_by_weights: '4,4,1,1', filter_by: peopleFilter(todayDays(), q.blockedIds), ...firstOnes } })
    }
    if (first && words && q.scopes.has('TOPICS')) {
      searches.push({ scope: 'TOPICS', params: { collection: aliasName(prefix, COLLECTIONS.TOPIC), q: q.text, query_by: 'title,subject', query_by_weights: '2,1', filter_by: topicsFilter(q.viewerId, q.filters.subjectId), ...firstOnes, stopwords } })
    }
    if (first && words && q.scopes.has('GROUPS')) {
      searches.push({ scope: 'GROUPS', params: { collection: aliasName(prefix, COLLECTIONS.GROUP), q: q.text, query_by: 'name,description', query_by_weights: '3,1', filter_by: groupsFilter(q.groupIds), ...firstOnes, stopwords } })
    }
    const ownClasses = classroomsFilter(q.classroomIds)
    if (first && words && q.scopes.has('CLASSROOMS') && ownClasses) {
      searches.push({ scope: 'CLASSROOMS', params: { collection: aliasName(prefix, COLLECTIONS.CLASSROOM), q: q.text, query_by: 'name,description', query_by_weights: '3,1', filter_by: ownClasses, ...firstOnes, stopwords } })
    }
    if (first && words && q.scopes.has('RESOURCES')) {
      const filter = resourcesFilter(q.blockedIds)
      searches.push({ scope: 'RESOURCES', params: { collection: aliasName(prefix, COLLECTIONS.RESOURCE), q: q.text, query_by: 'title,author,topics,description', query_by_weights: '4,2,2,1', ...(filter ? { filter_by: filter } : {}), ...firstOnes, stopwords } })
    }
    const timeoutMs = this.settings.integer('search_timeout_ms', this.config.search.timeoutMs) ?? this.config.search.timeoutMs
    const results = searches.length ? await ts.multiSearch<{ id: string; lead?: string }>(searches.map((s) => s.params), timeoutMs) : []
    const of = (scope: SearchScope) => results[searches.findIndex((s) => s.scope === scope)]
    const ids = (scope: SearchScope) => of(scope)?.hits.map((h) => h.document.id) ?? []
    const notes = (of('NOTES')?.hits ?? []).map((h) => {
      const body = h.highlights?.find((x) => x.field === 'body')?.snippet
      return { noteId: h.document.id, snippet: body ? widen(body) : (h.document.lead ?? '') }
    })
    const topicIds = ids('TOPICS')
    const rows = topicIds.length ? await this.db.topic.findMany({ where: { id: { in: topicIds } } }) : []
    const byId = new Map(rows.map((t) => [t.id, t]))
    return {
      notes,
      notesTotal: Math.min(of('NOTES')?.found ?? 0, MAX_NOTES),
      people: ids('PEOPLE'),
      topics: topicIds.map((id) => byId.get(id)).filter((t): t is Topic => !!t),
      groups: ids('GROUPS'),
      classrooms: ids('CLASSROOMS'),
      resources: ids('RESOURCES'),
    }
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

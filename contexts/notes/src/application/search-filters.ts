import { quote } from '../infrastructure/typesense'

/** Who is asking, as the notes filter needs it: built on every request from notes' read models and blocks (ADR-0055). */
export interface SearchReach {
  viewerId: string | null
  /** Groups and classes the viewer is in, deleted ones left out (notes' read models, ADR-0045 and ADR-0046) */
  groupIds: string[]
  classroomIds: string[]
  /** People a block keeps apart from the viewer, either way (ADR-0043) */
  blockedIds: string[]
}

const list = (ids: string[]) => `[${ids.map(quote).join(',')}]`

/**
 * `visibleNotesWhere` (domain/note-access) as a Typesense filter (§5: "a matching Typesense filter string"), for
 * documents that only ever hold published notes outside the trash. The owner; PUBLIC notes that are OK; SHARED or
 * PUBLIC notes, OK or held for review, shared with the viewer, a group of theirs or a class of theirs. Never a blocked
 * person's. A test holds this to `visibleNotesWhere` on seeded data.
 */
export function visibleNotesFilter(reach: SearchReach): string {
  const open = 'visibility:=PUBLIC && moderation:=OK'
  if (!reach.viewerId) return open
  const me = quote(reach.viewerId)
  const through = [`sharedUserIds:=${me}`, ...(reach.groupIds.length ? [`groupIds:=${list(reach.groupIds)}`] : []), ...(reach.classroomIds.length ? [`classroomIds:=${list(reach.classroomIds)}`] : [])]
  const shared = `(visibility:=[SHARED,PUBLIC] && moderation:=[OK,PENDING_REVIEW] && (${through.join(' || ')}))`
  const readable = `(ownerId:=${me} || (${open}) || ${shared})`
  return reach.blockedIds.length ? `${readable} && ownerId:!=${list(reach.blockedIds)}` : readable
}

/** People who may be found (§15.2, ADR-0043): past the digital-consent age today, and nobody a block keeps apart. */
export function peopleFilter(today: number, blockedIds: string[]): string {
  return blockedIds.length ? `adultFromDays:<=${today} && id:!=${list(blockedIds)}` : `adultFromDays:<=${today}`
}

/** Where a note comes from for the viewer (ADR-0056). */
export type NoteSource = 'MINE' | 'SHARED' | 'PUBLIC'

/** What `filters` narrows notes to (ADR-0056); never more than the read predicate allows. */
export interface NoteFilters {
  kinds?: string[] | null
  subjectId?: string | null
  topicId?: string | null
  authorId?: string | null
  sources?: NoteSource[] | null
}

/**
 * The filters as a Typesense filter, AND-ed with `visibleNotesFilter`; null when they leave nothing (a signed-out
 * visitor asking only for their own or shared notes), '' when they narrow nothing.
 */
export function noteFiltersFilter(f: NoteFilters, reach: SearchReach): string | null {
  const parts: string[] = []
  if (f.kinds?.length) parts.push(`kind:=[${f.kinds.join(',')}]`)
  if (f.subjectId) parts.push(`subjectIds:=${quote(f.subjectId)}`)
  if (f.topicId) parts.push(`topicIds:=${quote(f.topicId)}`)
  if (f.authorId) parts.push(`ownerId:=${quote(f.authorId)}`)
  if (f.sources?.length) {
    const me = reach.viewerId ? quote(reach.viewerId) : null
    const through = me ? [`sharedUserIds:=${me}`, ...(reach.groupIds.length ? [`groupIds:=${list(reach.groupIds)}`] : []), ...(reach.classroomIds.length ? [`classroomIds:=${list(reach.classroomIds)}`] : [])] : []
    const from = f.sources.flatMap((source) => {
      if (source === 'PUBLIC') return [me ? `(ownerId:!=${me} && visibility:=PUBLIC)` : 'visibility:=PUBLIC']
      if (!me) return []
      return [source === 'MINE' ? `ownerId:=${me}` : `(ownerId:!=${me} && (${through.join(' || ')}))`]
    })
    if (!from.length) return null
    parts.push(`(${from.join(' || ')})`)
  }
  return parts.join(' && ')
}

/** Groups a viewer may find (ADR-0045, ADR-0056): PUBLIC ones, and PRIVATE ones they are in. */
export function groupsFilter(groupIds: string[]): string {
  return groupIds.length ? `privacy:=PUBLIC || id:=${list(groupIds)}` : 'privacy:=PUBLIC'
}

/** Resources a viewer may find (ADR-0075): approved ones (the only ones indexed), none by people a block keeps apart. */
export function resourcesFilter(blockedIds: string[]): string | undefined {
  return blockedIds.length ? `submittedById:!=${list(blockedIds)}` : undefined
}

/** Classes a viewer may find: their own (§11, members only); null signed out or in none. */
export function classroomsFilter(classroomIds: string[]): string | null {
  return classroomIds.length ? `id:=${list(classroomIds)}` : null
}

/** Topics a viewer may use (organise.service's rule): curated ones, and the ones they proposed. */
export function topicsFilter(viewerId: string | null, subjectId?: string | null): string {
  const usable = viewerId ? `(origin:=CURATED || proposedById:=${quote(viewerId)})` : 'origin:=CURATED'
  return subjectId ? `${usable} && subjectId:=${quote(subjectId)}` : usable
}

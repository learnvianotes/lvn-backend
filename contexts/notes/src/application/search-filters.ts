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

/** Topics a viewer may use (organise.service's rule): curated ones, and the ones they proposed. */
export function topicsFilter(viewerId: string | null): string {
  return viewerId ? `origin:=CURATED || proposedById:=${quote(viewerId)}` : 'origin:=CURATED'
}

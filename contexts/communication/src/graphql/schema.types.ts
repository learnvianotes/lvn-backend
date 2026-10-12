// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

/** A class, owned by the core subgraph: null when the viewer may no longer see it */
export interface Classroom {
  id: string
}

export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL'

/** A group, owned by the core subgraph: null when the viewer may no longer see it */
export interface Group {
  id: string
}

export interface MarkNotificationsReadInput {
  /** These notifications; ignored when all is true */
  ids?: Array<string> | null
  all?: boolean | null
}

export interface MarkNotificationsReadPayload {
  /** What stays unread */
  unreadCount: number
  userErrors: Array<UserError>
}

export interface MutationMarkNotificationsReadArgs {
  input: MarkNotificationsReadInput
}

/** A note, owned by the notes subgraph: null when the viewer can no longer read it */
export interface Note {
  id: string
}

/** Something that happened for the viewer. Ids only: the client writes the sentence from the category, the actor and the
 * note, which resolve through their own subgraphs with their own permission checks. */
export interface Notification {
  id: string
  category: NotificationCategory
  /** In-app path to open, the same on web and phone, e.g. /notes/<id> */
  path: string
  /** Who did it; null for the system, platform admins and deleted accounts */
  actor: User | null
  /** The note it is about; null when there is none or the viewer can no longer read it */
  note: Note | null
  /** The group it is about (JOIN_REQUEST, JOIN_DECISION); null when there is none or the viewer may no longer see it */
  group: Group | null
  /** The class it is about (JOIN_REQUEST, JOIN_DECISION, CLASSROOM_INVITE, CLASSROOM_POST); null when there is none or the viewer may no longer see it */
  classroom: Classroom | null
  /** Facts of the category that are not user content: VERIFICATION { kind: REQUESTED | DECIDED, decision }, NOTES_IMPORT { created, skipped, failed }, CONNECTION { kind: REQUESTED | ACCEPTED }, JOIN_DECISION { decision: APPROVED | REJECTED } */
  data: unknown | null
  readAt: Date | null
  createdAt: Date
}

export type NotificationCategory = 'COMMENT' | 'SHARE' | 'CLASSROOM_POST' | 'QUIZ_PUBLISHED' | 'REVISION_REMINDER' | 'STREAK_AT_RISK' | 'JOIN_REQUEST' | 'JOIN_DECISION' | 'FOLLOW' | 'CONNECTION' | 'MENTOR_INVITE' | 'DOUBT' | 'FORK_PUBLISHED' | 'VERIFICATION' | 'DATA_EXPORT' | 'NOTES_IMPORT' | 'CLASSROOM_INVITE'

export interface NotificationConnection {
  edges: Array<NotificationEdge>
  pageInfo: PageInfo
}

export interface NotificationEdge {
  cursor: string
  node: Notification
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface QueryNotificationsArgs {
  first?: number | null
  after?: string | null
}

/** A person, owned by the users subgraph */
export interface User {
  id: string
}

export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
}

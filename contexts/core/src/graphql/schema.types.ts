// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

export interface AppealModerationInput {
  entityType: ReportEntityType
  entityId: string
  message: string
}

export interface CoreProblemMark {
  problemId: string
  mark: ProblemMark
}

/** Progress on a /core subject — the old site's history plus everything recorded since */
export interface CoreSubjectProgress {
  subjectId: string
  topics: Array<CoreTopicProgress>
  problems: Array<CoreProblemMark>
}

/** topicKey = subjectId/topicId of the /core content */
export interface CoreTopicProgress {
  topicKey: string
  completed: boolean
  revisit: boolean
  secondsStudied: number
  lastStudiedAt: Date | null
}

export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL'

export interface ModerateContentInput {
  entityType: ReportEntityType
  entityId: string
  action: ModerationActionType
  /** Required for HIDE, REMOVE and WARN: the author is told */
  reason?: string | null
}

/** A note as moderators see it: the published version readers would see */
export interface ModeratedNote {
  id: string
  title: string
  excerpt: string
  owner: User
  visibility: string
  moderation: ModerationState
  moderationReason: string | null
  deleted: boolean
}

/** APPROVE frees a held note; HIDE and REMOVE take it off for everyone but its author; DISMISS closes reports; WARN tells the author. SUSPEND is not available yet. */
export type ModerationActionType = 'APPROVE' | 'HIDE' | 'REMOVE' | 'WARN' | 'SUSPEND' | 'DISMISS'

export interface ModerationAppeal {
  message: string
  createdAt: Date
}

export interface ModerationCase {
  entityType: ReportEntityType
  entityId: string
  /** Set for NOTE cases */
  note: ModeratedNote | null
  /** Set for USER cases */
  user: User | null
  reports: Array<ModerationReport>
  appeal: ModerationAppeal | null
  openedAt: Date
}

export interface ModerationCaseConnection {
  edges: Array<ModerationCaseEdge>
  pageInfo: PageInfo
}

export interface ModerationCaseEdge {
  cursor: string
  node: ModerationCase
}

export interface ModerationReport {
  reason: ReportReason
  details: string | null
  /** null when the scorer held the content on its way to the public */
  reporter: User | null
  createdAt: Date
}

export type ModerationState = 'OK' | 'PENDING_REVIEW' | 'HIDDEN' | 'REMOVED'

export interface MutationReportContentArgs {
  input: ReportContentInput
}

export interface MutationModerateContentArgs {
  input: ModerateContentInput
}

export interface MutationAppealModerationArgs {
  input: AppealModerationInput
}

export interface OkPayload {
  ok: boolean
  userErrors: Array<UserError>
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export type ProblemMark = 'SOLVED' | 'REVISIT'

export interface QueryCoreProgressArgs {
  subjectId: string
}

export interface QueryModerationQueueArgs {
  first?: number | null
  after?: string | null
}

export interface ReportContentInput {
  entityType: ReportEntityType
  entityId: string
  reason: ReportReason
  /** What is wrong, in the reporter's words (at most 1,000 characters) */
  details?: string | null
}

export type ReportEntityType = 'NOTE' | 'USER'

export type ReportReason = 'HARASSMENT' | 'SEXUAL' | 'SELF_HARM' | 'HATE' | 'SPAM' | 'COPYRIGHT' | 'OTHER'

/** A person, owned by the users subgraph */
export interface User {
  id: string
}

export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
}

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

export interface CreateGroupInput {
  /** 3 to 80 characters */
  name: string
  /** At most 2,000 characters */
  description?: string | null
  privacy: GroupPrivacy
  /** OPEN lets anyone join a public group at once; new groups approve members unless told otherwise */
  joinPolicy?: GroupJoinPolicy | null
}

export interface CreateGroupPostInput {
  groupId: string
  body: unknown
}

export interface EditGroupPostInput {
  postId: string
  body: unknown
}

export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL'

export interface Group {
  id: string
  name: string
  description: string | null
  type: GroupType
  privacy: GroupPrivacy
  /** A private group always approves members, whatever was chosen */
  joinPolicy: GroupJoinPolicy
  owner: User
  memberCount: number
  viewerRole: GroupRole | null
  /** The viewer's request to join, while it waits */
  viewerRequestId: string | null
  viewerCan: GroupActions
  createdAt: Date
  /** Members only */
  members: Array<GroupMember> | null
  /** Admins only: requests waiting for an answer, oldest first */
  joinRequests: Array<GroupJoinRequest> | null
  /** Members only: pinned posts, then the newest */
  posts: GroupPostConnection | null
}

export interface GroupPostsArgs {
  first?: number | null
  after?: string | null
}

/** What the viewer may do in the group, from the same rules the API applies */
export interface GroupActions {
  join: boolean
  requestJoin: boolean
  post: boolean
  moderate: boolean
  manage: boolean
  delete: boolean
  reviewRequests: boolean
  leave: boolean
}

export interface GroupIdInput {
  groupId: string
}

export type GroupJoinPolicy = 'OPEN' | 'APPROVAL'

export interface GroupJoinRequest {
  id: string
  user: User
  message: string | null
  createdAt: Date
}

export interface GroupMember {
  user: User
  role: GroupRole
  joinedAt: Date
  /** Muted members cannot post until then */
  mutedUntil: Date | null
}

export interface GroupMemberInput {
  groupId: string
  userId: string
}

export interface GroupPayload {
  group: Group | null
  userErrors: Array<UserError>
}

export interface GroupPost {
  id: string
  author: User
  /** Rich text: a card's document */
  body: unknown
  pinned: boolean
  createdAt: Date
  editedAt: Date | null
  viewerCan: GroupPostActions
}

export interface GroupPostActions {
  edit: boolean
  delete: boolean
  pin: boolean
}

export interface GroupPostConnection {
  /** On the first page only */
  pinned: Array<GroupPost>
  edges: Array<GroupPostEdge>
  pageInfo: PageInfo
}

export interface GroupPostEdge {
  cursor: string
  node: GroupPost
}

export interface GroupPostIdInput {
  postId: string
}

export interface GroupPostPayload {
  post: GroupPost | null
  userErrors: Array<UserError>
}

export type GroupPrivacy = 'PUBLIC' | 'PRIVATE'

export type GroupRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'MENTOR'

export type GroupType = 'COMMUNITY' | 'PROJECT'

export type JoinDecision = 'APPROVED' | 'REJECTED'

export interface JoinRequestIdInput {
  requestId: string
}

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

export interface MutationCreateGroupArgs {
  input: CreateGroupInput
}

export interface MutationUpdateGroupArgs {
  input: UpdateGroupInput
}

export interface MutationDeleteGroupArgs {
  input: GroupIdInput
}

export interface MutationJoinGroupArgs {
  input: GroupIdInput
}

export interface MutationRequestToJoinGroupArgs {
  input: RequestToJoinGroupInput
}

export interface MutationWithdrawGroupJoinRequestArgs {
  input: JoinRequestIdInput
}

export interface MutationReviewGroupJoinRequestArgs {
  input: ReviewGroupJoinRequestInput
}

export interface MutationLeaveGroupArgs {
  input: GroupIdInput
}

export interface MutationRemoveGroupMemberArgs {
  input: GroupMemberInput
}

export interface MutationSetGroupRoleArgs {
  input: SetGroupRoleInput
}

export interface MutationMuteGroupMemberArgs {
  input: MuteGroupMemberInput
}

export interface MutationCreateGroupPostArgs {
  input: CreateGroupPostInput
}

export interface MutationEditGroupPostArgs {
  input: EditGroupPostInput
}

export interface MutationDeleteGroupPostArgs {
  input: GroupPostIdInput
}

export interface MutationPinGroupPostArgs {
  input: PinGroupPostInput
}

export interface MuteGroupMemberInput {
  groupId: string
  userId: string
  /** Null lifts the mute */
  until?: Date | null
}

export interface OkPayload {
  ok: boolean
  userErrors: Array<UserError>
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface PinGroupPostInput {
  postId: string
  pinned: boolean
}

export type ProblemMark = 'SOLVED' | 'REVISIT'

export interface QueryCoreProgressArgs {
  subjectId: string
}

export interface QueryGroupArgs {
  id: string
}

export interface QueryDiscoverGroupsArgs {
  query?: string | null
  first?: number | null
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

export interface RequestToJoinGroupInput {
  groupId: string
  /** At most 500 characters, for the admins */
  message?: string | null
}

export interface ReviewGroupJoinRequestInput {
  requestId: string
  decision: JoinDecision
}

export interface SetGroupRoleInput {
  groupId: string
  userId: string
  /** OWNER hands the group over (the owner only); otherwise a role below the viewer's own */
  role: GroupRole
}

export interface UpdateGroupInput {
  groupId: string
  name?: string | null
  description?: string | null
  privacy?: GroupPrivacy | null
  joinPolicy?: GroupJoinPolicy | null
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

// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

export interface AddCommentInput {
  target: CommentTargetInput
  /** A card of the note */
  cardId?: string | null
  /** Reply to this top-level comment */
  parentId?: string | null
  body: unknown
}

export interface AnswerClassroomInviteInput {
  inviteId: string
  accept: boolean
}

export interface AppealModerationInput {
  entityType: ReportEntityType
  entityId: string
  message: string
}

export interface Classroom {
  id: string
  name: string
  description: string | null
  teacher: User
  memberCount: number
  /** Staff only: the code students ask to join with */
  joinCode: string | null
  viewerRole: ClassroomRole | null
  viewerRequestId: string | null
  viewerInviteId: string | null
  viewerCan: ClassroomActions
  createdAt: Date
  /** Staff only */
  members: Array<ClassroomMember> | null
  /** Staff only: waiting requests, oldest first */
  joinRequests: Array<ClassroomJoinRequest> | null
  /** Members only: announcements, newest first */
  posts: ClassroomPostConnection | null
}

export interface ClassroomPostsArgs {
  first?: number | null
  after?: string | null
}

export interface ClassroomActions {
  requestJoin: boolean
  acceptInvite: boolean
  /** Teacher and TAs: answer requests, invite, post */
  review: boolean
  post: boolean
  /** The teacher: settings, roles, removing people */
  manage: boolean
  leave: boolean
}

export interface ClassroomIdInput {
  classroomId: string
}

export interface ClassroomInviteItem {
  id: string
  classroom: ClassroomPreview
  role: ClassroomRole
  invitedBy: User
  expiresAt: Date
}

export interface ClassroomJoinRequest {
  id: string
  user: User
  via: JoinVia
  createdAt: Date
}

export interface ClassroomMember {
  user: User
  role: ClassroomRole
  joinedAt: Date
}

export interface ClassroomMemberInput {
  classroomId: string
  userId: string
}

export interface ClassroomPayload {
  classroom: Classroom | null
  userErrors: Array<UserError>
}

export interface ClassroomPost {
  id: string
  author: User
  body: unknown
  createdAt: Date
  viewerCanDelete: boolean
  /** Members: comments and reactions. A student's thread is seen by them and the class's staff only */
  discussion?: Discussion
}

export interface ClassroomPostConnection {
  edges: Array<ClassroomPostEdge>
  pageInfo: PageInfo
}

export interface ClassroomPostEdge {
  cursor: string
  node: ClassroomPost
}

export interface ClassroomPostIdInput {
  postId: string
}

/** What a class code shows before joining: its name and teacher, nothing inside */
export interface ClassroomPreview {
  id: string
  name: string
  teacher: User
  viewerRole: ClassroomRole | null
  viewerRequestId: string | null
}

export type ClassroomRole = 'TEACHER' | 'TA' | 'STUDENT'

export interface Comment {
  id: string
  /** Null when removed */
  author: User | null
  /** Rich text: a card's document; null when removed */
  body: unknown | null
  /** The card of the note it is about */
  cardId: string | null
  removed: boolean
  /** Waiting for the owner's approval: seen by its author and the owner only */
  pendingApproval: boolean
  /** In a class: seen by the student whose thread it is and the class's staff only */
  private: boolean
  createdAt: Date
  editedAt: Date | null
  /** Replies, oldest first (one level) */
  replies: Array<Comment>
  reactions: Reactions
  viewerCan: CommentActions
}

export interface CommentActions {
  reply: boolean
  edit: boolean
  delete: boolean
  /** The content's owner: let a restricted person's comment be seen */
  approve: boolean
}

export interface CommentConnection {
  edges: Array<CommentEdge>
  pageInfo: PageInfo
}

export interface CommentEdge {
  cursor: string
  node: Comment
}

export interface CommentIdInput {
  commentId: string
}

export interface CommentPayload {
  comment: Comment | null
  userErrors: Array<UserError>
}

export interface CommentTargetInput {
  type: CommentTargetType
  id: string
}

export type CommentTargetType = 'NOTE' | 'GROUP_POST' | 'CLASSROOM_POST'

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

export interface CreateClassroomInput {
  name: string
  description?: string | null
}

export interface CreateClassroomPostInput {
  classroomId: string
  body: unknown
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

export interface Discussion {
  /** Top-level comments, oldest first; with cardId, those on one card of the note */
  comments: CommentConnection
  /** Comments and replies the viewer can see */
  commentCount: number
  reactions: Reactions
  viewerCanComment: boolean
  /** Why the viewer may not comment or react, in words */
  whyNot: string | null
}

export interface DiscussionCommentsArgs {
  first?: number | null
  after?: string | null
  cardId?: string | null
}

export interface EditCommentInput {
  commentId: string
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
  /** Members: comments and reactions on the post */
  discussion?: Discussion
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

export interface InviteToClassroomInput {
  classroomId: string
  /** A handle or an email address */
  person: string
  /** TA only by the teacher */
  role?: ClassroomRole | null
}

export type JoinDecision = 'APPROVED' | 'REJECTED'

export interface JoinRequestIdInput {
  requestId: string
}

export type JoinVia = 'CODE' | 'LINK'

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

export interface MutationCreateClassroomArgs {
  input: CreateClassroomInput
}

export interface MutationUpdateClassroomArgs {
  input: UpdateClassroomInput
}

export interface MutationDeleteClassroomArgs {
  input: ClassroomIdInput
}

export interface MutationRequestToJoinClassroomArgs {
  input: RequestToJoinClassroomInput
}

export interface MutationWithdrawClassroomJoinRequestArgs {
  input: JoinRequestIdInput
}

export interface MutationReviewClassroomJoinRequestArgs {
  input: ReviewClassroomJoinRequestInput
}

export interface MutationInviteToClassroomArgs {
  input: InviteToClassroomInput
}

export interface MutationAnswerClassroomInviteArgs {
  input: AnswerClassroomInviteInput
}

export interface MutationLeaveClassroomArgs {
  input: ClassroomIdInput
}

export interface MutationRemoveClassroomMemberArgs {
  input: ClassroomMemberInput
}

export interface MutationSetClassroomRoleArgs {
  input: SetClassroomRoleInput
}

export interface MutationCreateClassroomPostArgs {
  input: CreateClassroomPostInput
}

export interface MutationDeleteClassroomPostArgs {
  input: ClassroomPostIdInput
}

export interface MutationAddCommentArgs {
  input: AddCommentInput
}

export interface MutationEditCommentArgs {
  input: EditCommentInput
}

export interface MutationDeleteCommentArgs {
  input: CommentIdInput
}

export interface MutationApproveCommentArgs {
  input: CommentIdInput
}

export interface MutationReactArgs {
  input: ReactInput
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

/** A note, owned by the notes subgraph; core adds its discussion */
export interface Note {
  id: string
  /** Signed-in readers of the note: its comments and reactions. Null for anonymous visitors */
  discussion: Discussion | null
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

export interface QueryClassroomArgs {
  id: string
}

export interface QueryClassroomByCodeArgs {
  code: string
}

export interface QueryDiscussionArgs {
  target: CommentTargetInput
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

export interface ReactInput {
  target: ReactionTargetInput
  /** Null takes the viewer's reaction away */
  kind?: ReactionKind | null
}

export interface ReactionCount {
  kind: ReactionKind
  /** Exact; or, on a public note for anyone but its owner, a milestone (ADR-0027) when atLeast, and null below the first */
  count: number | null
  atLeast: boolean
}

export type ReactionKind = 'LIKE' | 'HELPFUL' | 'CELEBRATE'

export interface Reactions {
  counts: Array<ReactionCount>
  viewerReaction: ReactionKind | null
}

export interface ReactionTargetInput {
  type: ReactionTargetType
  id: string
}

export type ReactionTargetType = 'NOTE' | 'COMMENT' | 'GROUP_POST' | 'CLASSROOM_POST'

export interface ReactPayload {
  reactions: Reactions | null
  userErrors: Array<UserError>
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

export interface RequestToJoinClassroomInput {
  code: string
  via?: JoinVia | null
}

export interface RequestToJoinGroupInput {
  groupId: string
  /** At most 500 characters, for the admins */
  message?: string | null
}

export interface ReviewClassroomJoinRequestInput {
  requestId: string
  decision: JoinDecision
}

export interface ReviewGroupJoinRequestInput {
  requestId: string
  decision: JoinDecision
}

export interface SetClassroomRoleInput {
  classroomId: string
  userId: string
  /** TEACHER hands the class to another teacher, who must hold the teacher role */
  role: ClassroomRole
}

export interface SetGroupRoleInput {
  groupId: string
  userId: string
  /** OWNER hands the group over (the owner only); otherwise a role below the viewer's own */
  role: GroupRole
}

export interface UpdateClassroomInput {
  classroomId: string
  name?: string | null
  description?: string | null
  /** A new code; the old one stops working */
  newCode?: boolean | null
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

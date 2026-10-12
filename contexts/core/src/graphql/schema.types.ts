// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

export interface ActivityConnection {
  edges: Array<ActivityEdge>
  pageInfo: PageInfo
}

export interface ActivityEdge {
  cursor: string
  node: ActivityItem
}

export interface ActivityItem {
  /** Unique in the feed: a note shared to two places is two items. Deliberately not an id, so caches keep items apart */
  key: string
  kind: ActivityKind
  at: Date
  /** Who posted, asked or shared */
  actor: User | null
  group: Group | null
  classroom: Classroom | null
  /** GROUP_POST and IDEA */
  post: GroupPost | null
  /** CLASS_ANNOUNCEMENT */
  announcement: ClassroomPost | null
  /** DOUBT */
  doubt: Doubt | null
  /** SHARED_NOTE: null when the viewer can no longer read it */
  note: Note | null
}

export type ActivityKind = 'GROUP_POST' | 'IDEA' | 'DOUBT' | 'CLASS_ANNOUNCEMENT' | 'SHARED_NOTE'

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

export interface AnswerDoubtInput {
  doubtId: string
  body: unknown
}

export interface AnswerMentorInviteInput {
  inviteId: string
  accept: boolean
}

export interface AppealModerationInput {
  entityType: ReportEntityType
  entityId: string
  message: string
}

export interface AskDoubtInput {
  groupId: string
  /** 3 to 200 characters */
  title: string
  body: unknown
  repoRef?: string | null
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
  /** Not OK only for its author (ADR-0051) */
  moderation: ModerationState
  moderationReason: string | null
  /** Its author may still appeal: hidden or removed by a moderator, and not appealed yet */
  moderationCanAppeal: boolean
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
  /** Not OK only for its author: held, hidden or removed by moderation (ADR-0051) */
  moderation: ModerationState
  /** Why, for its author */
  moderationReason: string | null
  /** Its author may still appeal: hidden or removed by a moderator, and not appealed yet */
  moderationCanAppeal: boolean
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
  /** PROJECT starts a project workspace (ADR-0048); COMMUNITY when left out */
  type?: GroupType | null
}

export interface CreateGroupPostInput {
  groupId: string
  body: unknown
  /** IDEA: on a project workspace's ideas board; POST when left out */
  kind?: GroupPostKind | null
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

export interface Doubt {
  id: string
  title: string
  /** Rich text: a card's document */
  body: unknown
  /** A path, line or commit in the repository */
  repoRef: string | null
  status: DoubtStatus
  author: User
  createdAt: Date
  resolvedAt: Date | null
  answerCount: number
  /** Oldest first */
  answers: Array<DoubtAnswer>
  viewerCan: DoubtActions
  /** Not OK only for its author (ADR-0051) */
  moderation: ModerationState
  moderationReason: string | null
  /** Its author may still appeal: hidden or removed by a moderator, and not appealed yet */
  moderationCanAppeal: boolean
}

export interface DoubtActions {
  answer: boolean
  resolve: boolean
  reopen: boolean
  delete: boolean
}

export interface DoubtAnswer {
  id: string
  author: User
  body: unknown
  byMentor: boolean
  createdAt: Date
}

export interface DoubtConnection {
  edges: Array<DoubtEdge>
  pageInfo: PageInfo
}

export interface DoubtEdge {
  cursor: string
  node: Doubt
}

export interface DoubtIdInput {
  doubtId: string
}

export interface DoubtPayload {
  doubt: Doubt | null
  userErrors: Array<UserError>
}

export type DoubtStatus = 'OPEN' | 'ANSWERED' | 'RESOLVED'

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
  /** Its owner only: the platform moderators' warning about the group from the last 30 days, if any (ADR-0051) */
  moderationWarning?: string | null
  /** The linked repository, for anyone who sees the workspace */
  repository?: GroupRepository | null
  /** Members: the ideas board, most reactions first */
  ideas?: Array<GroupPost> | null
  /** Members and the mentor: doubts, newest first */
  doubts?: DoubtConnection | null
  /** The viewer's open invite to mentor this workspace */
  viewerMentorInviteId?: string | null
  /** The note that credits the team; null when there is none or the viewer cannot read it */
  showcase?: Note | null
}

export interface GroupPostsArgs {
  first?: number | null
  after?: string | null
}

export interface GroupDoubtsArgs {
  status?: DoubtStatus | null
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
  /** Project workspaces (ADR-0048): the team asks doubts */
  askDoubt: boolean
  /** Project workspaces: admins invite teachers to mentor */
  inviteMentor: boolean
  /** A teacher with an open invite to mentor */
  acceptMentorInvite: boolean
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
  kind: GroupPostKind
  pinned: boolean
  createdAt: Date
  editedAt: Date | null
  /** Not OK only for its author (ADR-0051) */
  moderation: ModerationState
  moderationReason: string | null
  /** Its author may still appeal: hidden or removed by a moderator, and not appealed yet */
  moderationCanAppeal: boolean
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

export type GroupPostKind = 'POST' | 'IDEA'

export interface GroupPostPayload {
  post: GroupPost | null
  userErrors: Array<UserError>
}

export type GroupPrivacy = 'PUBLIC' | 'PRIVATE'

/** Public details come from the provider's API when it shows the repository; otherwise the card is the link */
export interface GroupRepository {
  provider: RepositoryProvider
  url: string
  available: boolean
  name: string | null
  description: string | null
  language: string | null
  stars: number | null
  pushedAt: Date | null
  refreshedAt: Date | null
}

export type GroupRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'MENTOR'

export type GroupType = 'COMMUNITY' | 'PROJECT'

export interface InviteMentorInput {
  groupId: string
  /** A teacher's handle or email */
  person: string
}

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

export interface MentorInviteItem {
  id: string
  group: Group
  invitedBy: User
  expiresAt: Date
}

export interface ModerateContentInput {
  entityType: ReportEntityType
  entityId: string
  action: ModerationActionType
  /** Required for HIDE, REMOVE and WARN: the author is told */
  reason?: string | null
}

/** A comment, post, announcement or doubt as its scope's moderators see it */
export interface ModeratedContent {
  entityType: ReportEntityType
  id: string
  author: User
  /** The start of its text */
  excerpt: string
  moderation: ModerationState
  moderationReason: string | null
  deleted: boolean
  /** Where it is, in the app */
  path: string
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
  scope: ModerationScope
  /** The group or class, for those scopes */
  scopeId: string | null
  /** Set for NOTE cases */
  note: ModeratedNote | null
  /** Set for COMMENT, GROUP_POST, CLASSROOM_POST and DOUBT cases */
  content: ModeratedContent | null
  /** Set for GROUP cases */
  group: Group | null
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

/** Whose queue a case is in (ADR-0051) */
export type ModerationScope = 'PLATFORM' | 'GROUP' | 'CLASSROOM'

/** A group's or class's queue for its moderators; without it, platform admins see every case */
export interface ModerationScopeInput {
  scope: ModerationScope
  /** The group or class */
  id?: string | null
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

export interface MutationSetGroupRepositoryArgs {
  input: SetGroupRepositoryInput
}

export interface MutationInviteMentorArgs {
  input: InviteMentorInput
}

export interface MutationAnswerMentorInviteArgs {
  input: AnswerMentorInviteInput
}

export interface MutationAskDoubtArgs {
  input: AskDoubtInput
}

export interface MutationAnswerDoubtArgs {
  input: AnswerDoubtInput
}

export interface MutationResolveDoubtArgs {
  input: DoubtIdInput
}

export interface MutationReopenDoubtArgs {
  input: DoubtIdInput
}

export interface MutationDeleteDoubtArgs {
  input: DoubtIdInput
}

export interface MutationSetProjectShowcaseArgs {
  input: SetProjectShowcaseInput
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

export interface QueryActivityFeedArgs {
  first?: number | null
  after?: string | null
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
  scope?: ModerationScopeInput | null
}

export interface QueryDoubtArgs {
  id: string
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

export type ReportEntityType = 'NOTE' | 'USER' | 'COMMENT' | 'GROUP_POST' | 'CLASSROOM_POST' | 'DOUBT' | 'GROUP'

export type ReportReason = 'HARASSMENT' | 'SEXUAL' | 'SELF_HARM' | 'HATE' | 'SPAM' | 'COPYRIGHT' | 'OTHER'

export type RepositoryProvider = 'GITHUB' | 'GITLAB'

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

export interface SetGroupRepositoryInput {
  groupId: string
  /** https://github.com/<owner>/<repo> or https://gitlab.com/<namespace>/<project>; empty unlinks */
  url?: string | null
}

export interface SetGroupRoleInput {
  groupId: string
  userId: string
  /** OWNER hands the group over (the owner only); otherwise a role below the viewer's own */
  role: GroupRole
}

export interface SetProjectShowcaseInput {
  groupId: string
  /** A PUBLIC project note shared to the workspace; null clears it */
  noteId?: string | null
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

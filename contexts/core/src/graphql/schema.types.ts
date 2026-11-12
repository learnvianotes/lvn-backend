// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

/** An account's standing, for its owner alone (ADR-0053) */
export interface AccountStanding {
  /** Set while the account is suspended: nothing it does reaches other people until then */
  suspendedUntil: Date | null
  suspensionReason: string | null
  /** The suspension can still be appealed (once) */
  canAppeal: boolean
  /** Warnings from the last 90 days, newest first */
  warnings: Array<AccountWarning>
}

/** A warning platform moderators gave an account (ADR-0053) */
export interface AccountWarning {
  reason: string
  at: Date
}

/** An achievement: the highest tier reached of one kind (and subject) */
export interface Achievement {
  id: string
  kind: AchievementKind
  /** The threshold reached: 5 topics, 12 weeks, 250 points… */
  tier: number
  title: string
  /** What it says the person did */
  description: string
  /** For a subject contributor */
  subjectTitle: string | null
  earnedAt: Date
}

/** What an achievement marks */
export type AchievementKind = 'TOPICS_MASTERED' | 'QUIZ_MASTER' | 'EXAM_READY' | 'RHYTHM_WEEKS' | 'SUBJECT_CONTRIBUTOR'

export interface AchievementSettings {
  /** Achievements and level shown on the viewer's profile */
  showAchievements: boolean
  /** Only adults may show them */
  canShow: boolean
}

export interface AchievementSettingsPayload {
  settings: AchievementSettings | null
  userErrors: Array<UserError>
}

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
  /** Who posted, asked or shared; null for REPOSITORY */
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
  /** REPOSITORY: a commit, pull request or issue in a workspace's repository (ADR-0078) */
  repositoryEvent: RepositoryEvent | null
}

export type ActivityKind = 'GROUP_POST' | 'IDEA' | 'DOUBT' | 'CLASS_ANNOUNCEMENT' | 'SHARED_NOTE' | 'REPOSITORY'

export interface AddCommentInput {
  target: CommentTargetInput
  /** A card of the note */
  cardId?: string | null
  /** Reply to this top-level comment */
  parentId?: string | null
  body: unknown
}

export interface AddWeeklyTaskInput {
  kind: WeeklyTaskKind
  target: number
  /** Needed for TOPIC_MINUTES; optional for QUIZ_ANSWERS */
  topicId?: string | null
  /** When and where (at most 140 characters) */
  plan?: string | null
}

/** A contest as its writers see it */
export interface AdminContest {
  id: string
  title: string
  subjectId: string | null
  subjectTitle: string | null
  opensAt: Date
  closesAt: Date
  minutes: number
  questionCount: number
  published: boolean
  questions: Array<AdminContestQuestion>
  /** How many have started it */
  attempts: number
}

export interface AdminContestPayload {
  contest: AdminContest | null
  userErrors: Array<UserError>
}

export interface AdminContestQuestion {
  id: string
  prompt: string
  choices: Array<ContestChoice>
  correctChoiceId: string
  explanation: string
}

export interface AnswerClassroomInviteInput {
  inviteId: string
  accept: boolean
}

export interface AnswerContestQuestionInput {
  attemptId: string
  questionId: string
  choiceId: string
}

export interface AnswerDoubtInput {
  doubtId: string
  body: unknown
}

export interface AnswerMentorInviteInput {
  inviteId: string
  accept: boolean
}

export interface AnswerRhythmBuddyInput {
  id: string
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

export interface BuddyTogether {
  countedDays: number
  target: number
}

export interface CardIdInput {
  cardId: string
}

export interface CardReviewResult {
  cardId: string
  due: Date
  state: ReviewState
  intervalDays: number
}

/** Counted days across the class against a target; no one is listed in order, and it cannot be failed */
export interface ClassGoal {
  target: number
  /** Each student's counted days, up to their share */
  progress: number
  /** The most one student's days count */
  sharePerStudent: number
  /** Sized from the class's recent weeks rather than set by a teacher */
  automatic: boolean
  reached: boolean
  /** Teachers only: each student's part */
  parts: Array<ClassGoalPart> | null
}

export interface ClassGoalPart {
  user: User
  countedDays: number
}

export interface ClassPerformance {
  quizzes: number
  students: Array<ClassStudentPerformance>
  /** Hardest first */
  topics: Array<ClassTopicPerformance>
}

export interface ClassQuiz {
  id: string
  classroomId: string
  title: string
  author: User
  publishedAt: Date
  questionCount: number
  /** In order. The correct choices and explanations are null until the viewer has submitted (staff always see them) */
  questions: Array<ClassQuizQuestion>
  /** The viewer's attempts, newest first; the last is their score */
  myAttempts: Array<QuizAttempt>
  /** Staff only: how many of the class's students have submitted (per-student results wait for Phase 6) */
  submittedCount: number | null
  viewerCanDelete: boolean
}

export interface ClassQuizChoice {
  id: string
  /** Inline rich text */
  content: unknown
}

export interface ClassQuizIdInput {
  quizId: string
}

export interface ClassQuizPayload {
  quiz: ClassQuiz | null
  userErrors: Array<UserError>
}

export interface ClassQuizQuestion {
  id: string
  position: number
  /** Rich text, as a quiz card's question */
  question: unknown
  choices: Array<ClassQuizChoice>
  /** More than one choice is correct */
  multiple: boolean
  correct: Array<string> | null
  /** Rich text */
  explanation: unknown | null
}

export interface ClassQuizScore {
  quizId: string
  quizTitle: string
  /** The student's first attempt */
  score: number
  total: number
  submittedAt: Date
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
  /** Members only: this week's Rhythm across the class */
  rhythmRing?: ClassroomRhythm | null
  /** Staff only: each student's first score on each quiz, and the topics the class finds hard */
  performance?: ClassPerformance | null
  /** Members only: published quizzes, newest first */
  quizzes?: Array<ClassQuiz> | null
}

export interface ClassroomPostsArgs {
  first?: number | null
  after?: string | null
}

export interface ClassroomQuizzesArgs {
  first?: number | null
}

export interface ClassroomActions {
  requestJoin: boolean
  acceptInvite: boolean
  /** Teacher and TAs: answer requests, invite, post */
  review: boolean
  post: boolean
  /** Teacher and TAs: publish quizzes (ADR-0064) */
  publishQuiz: boolean
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

/** This week across a class's students */
export interface ClassroomRhythm {
  students: number
  /** Students whose week is met */
  metCount: number
  countedDays: number
  /** The sum of the students' targets */
  targetDays: number
  /** Only students who share their Rhythm with their classes */
  people: Array<ClassroomRhythmPerson>
  /** The class's pooled goal this week, when its teachers turned it on (ADR-0081) */
  goal: ClassGoal | null
}

export interface ClassroomRhythmPerson {
  user: User
  /** A child account's first name only */
  name: string
  countedDays: number
  target: number
  met: boolean
}

export type ClassroomRole = 'TEACHER' | 'TA' | 'STUDENT'

export interface ClassStudentPerformance {
  user: User
  name: string
  scores: Array<ClassQuizScore>
  submitted: number
  /** Right over asked across the scores, 0–1; null before a first quiz */
  average: number | null
}

export interface ClassTopicPerformance {
  key: string
  topic: Topic | null
  title: string
  /** Right over answers on the topic in first attempts, 0–1 */
  accuracy: number
  answers: number
  /** Under 60 % */
  hard: boolean
}

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

export type CommentTargetType = 'NOTE' | 'GROUP_POST' | 'CLASSROOM_POST' | 'RESOURCE'

export interface CommunityConnection {
  edges: Array<CommunityEdge>
  pageInfo: PageInfo
  /** For You: the topics it follows (the viewer's interests, upcoming exams and recent reading); empty when there are none, null for one that is gone */
  basedOn: Array<Topic | null>
}

export interface CommunityEdge {
  cursor: string
  /** Null when the viewer can no longer read it */
  node: Note | null
  /** For You: the viewer's topic it is on */
  topic: Topic | null
}

/** From GitHub's return to the setup page: the install link's state, the installation and the person's code */
export interface ConnectRepositoryAppInput {
  state: string
  installationId: string
  code: string
}

export interface Contest {
  id: string
  title: string
  subjectTitle: string | null
  opensAt: Date
  closesAt: Date
  minutes: number
  /** Questions each attempt gets */
  questionCount: number
  state: ContestState
  /** Participants as a milestone (1,000+, 2,000+…); null below the first */
  participantsMilestone: number | null
  /** The viewer's attempt, if they started one */
  viewerAttempt: ContestAttempt | null
}

export interface ContestAttempt {
  id: string
  startedAt: Date
  /** When it is marked as it stands */
  deadline: Date
  submittedAt: Date | null
  /** Submitted, or past its deadline */
  finished: boolean
  /** Once finished */
  score: number | null
  total: number
  /** In the order drawn for the viewer, each with its choices in the viewer's order */
  questions: Array<ContestAttemptQuestion>
  /** The viewer's best share right (0–100) on this subject's contests, once finished */
  personalBest: number | null
  /** For an adult who asked, once the window has closed; null otherwise */
  band: ContestBand | null
}

export interface ContestAttemptIdInput {
  attemptId: string
}

export interface ContestAttemptQuestion {
  id: string
  prompt: string
  choices: Array<ContestChoice>
  myChoiceId: string | null
  /** Only once the attempt is finished */
  correctChoiceId: string | null
  /** Only once the attempt is finished */
  explanation: string | null
}

/** Where an adult's finished attempt falls among adults' (ADR-0082); never given to anyone under 18 */
export type ContestBand = 'TOP_10' | 'TOP_25' | 'TOP_50'

export interface ContestChoice {
  id: string
  text: string
}

export interface ContestIdInput {
  id: string
}

export interface ContestInput {
  /** Leave out to create one */
  id?: string | null
  title: string
  subjectId?: string | null
  opensAt: Date
  closesAt: Date
  minutes: number
  questionCount: number
  questions: Array<ContestQuestionInput>
}

export interface ContestPayload {
  contest: Contest | null
  userErrors: Array<UserError>
}

export interface ContestQuestionInput {
  prompt: string
  /** 2–6 choices, in order */
  choices: Array<string>
  /** The index of the right choice */
  correct: number
  explanation: string
}

export interface ContestSettings {
  /** See a band among adults after a contest closes */
  showBands: boolean
  /** Only adults may */
  canShowBands: boolean
}

export interface ContestSettingsPayload {
  settings: ContestSettings | null
  userErrors: Array<UserError>
}

export type ContestState = 'UPCOMING' | 'OPEN' | 'CLOSED'

export interface Contribution {
  /** Points from what others did with the person's public work; never below 0 */
  points: number
  level: ContributorLevel
  /** Points at which the next level starts; null at the top */
  nextLevelAt: number | null
}

/** A level from points, lost again below its threshold */
export type ContributorLevel = 'NEWCOMER' | 'CONTRIBUTOR' | 'TRUSTED'

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

export interface CreateExamInput {
  /** 1–100 characters */
  name: string
  /** YYYY-MM-DD, today or later, at most two years away */
  date: string
  /** 1–20 notes topics the viewer may use */
  topicIds: Array<string>
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

/** Written by AI for the person once a day; a chosen line until then, or when AI is off */
export interface DailyLine {
  /** The learning day it is for (YYYY-MM-DD, in the person's zone) */
  day: string
  /** A headline of a few words */
  title: string
  /** One sentence */
  line: string
  /** Written by AI for this person */
  fromAi: boolean
  /** True when a model wrote the line, false for the chosen line. Clients use this for the AI label. */
  aiGenerated: boolean
  /** AI is writing today's line: ask again in a few seconds */
  pending: boolean
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

export interface DismissRecommendationInput {
  kind: RecommendationKind
  /** The note id or the topic key */
  entityId: string
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

export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL' | 'UNAVAILABLE' | 'UNDER_MINIMUM_AGE' | 'AGE_RESTRICTED' | 'AI_UNAVAILABLE_FOR_MINOR'

export interface Exam {
  id: string
  name: string
  /** YYYY-MM-DD, a learning day in the learner's zone */
  date: string
  /** 0 on the exam's day */
  daysLeft: number
  past: boolean
  topics: Array<ExamTopic>
  /** Oldest day first */
  tasks: Array<ExamPlanTask>
  /** Exam Readiness, 0–100: the mean mastery of the topics */
  readiness: number
  /** Where the target line ends on the exam's day, in % */
  target: number
  /** Where the target line is today, in % */
  targetToday: number
}

export interface ExamIdInput {
  id: string
}

export interface ExamPayload {
  exam: Exam | null
  userErrors: Array<UserError>
}

/** One revision session of an exam's plan */
export interface ExamPlanTask {
  id: string
  /** YYYY-MM-DD, a learning day in the learner's zone */
  day: string
  topics: Array<ExamPlanTopic>
  /** 10 minutes on its topics that day, or a quiz answered on them */
  done: boolean
  today: boolean
}

export interface ExamPlanTopic {
  key: string
  title: string
}

export interface ExamTopic {
  /** topic:<id>, as learning events name it */
  key: string
  title: string
  /** The notes topic, when the viewer may still use it */
  topic: Topic | null
  /** Mean chance of recalling the topic's studied cards now, 0–1; null without studied cards */
  recall: number | null
  /** Right answers in the topic's last 3 quiz results, 0–1; null without results */
  accuracy: number | null
  /** 0.6 × recall + 0.4 × accuracy, or the one there is; 0 with neither */
  mastery: number
}

/** A topic an exam can be set on */
export interface ExamTopicOption {
  id: string
  key: string
  title: string
  subjectTitle: string
}

export interface FocusSession {
  id: string
  /** topic:<id> or core:<subject>/<topic> */
  topicKey: string | null
  note: Note | null
  plannedMinutes: number
  breakMinutes: number
  meetUrl: string | null
  startedAt: Date
  endedAt: Date | null
  /** Counted when it ended: the time since it started, at most the plan */
  focusedSeconds: number
}

export interface FocusSessionIdInput {
  id: string
}

export interface FocusSessionPayload {
  session: FocusSession | null
  userErrors: Array<UserError>
}

export interface Group {
  id: string
  name: string
  description: string | null
  type: GroupType
  privacy: GroupPrivacy
  /** A private group always approves members, whatever was chosen */
  joinPolicy: GroupJoinPolicy
  /** The group's picture, valid for 15 minutes (ADR-0076); null without one */
  pictureUrl: string | null
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
  /** Members, for a GitHub repository while the GitHub App is set up here (ADR-0078); null otherwise */
  app: RepositoryApp | null
  /** Members: the repository's commits, pull requests and issues from the GitHub App, newest first; null for others */
  events: Array<RepositoryEvent> | null
}

export interface GroupRepositoryEventsArgs {
  first?: number | null
}

export type GroupRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'MENTOR'

export type GroupType = 'COMMUNITY' | 'PROJECT'

export interface InviteMentorInput {
  groupId: string
  /** A teacher's handle or email */
  person: string
}

export interface InviteRhythmBuddyInput {
  /** Someone the viewer follows or is connected with */
  handle: string
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

export interface LearningEventInput {
  /** The client's UUIDv7: an event sent twice counts once */
  id: string
  type: LearningEventType
  /** NOTE, CARD, CORE_TOPIC, QUIZ… */
  entityType?: string | null
  entityId?: string | null
  /** topic:<id> or core:<subject>/<topic>; at most 10 */
  topicKeys?: Array<string> | null
  /** At most 4 hours */
  durationMs?: number | null
  /** At most 2 KB; TIME_SPENT takes { activity: FOCUS | REVIEW | QUIZ | READING }, QUIZ_COMPLETED { answered } */
  metadata?: unknown | null
  /** When it happened on the device; believed back at most 30 days */
  clientTs: Date
  sessionId?: string | null
  platform: Platform
}

/** §14.1's event types. Some are recorded by the server only: notes created, published or forked; exams; AI requests */
export type LearningEventType = 'NOTE_OPENED' | 'NOTE_CREATED' | 'NOTE_PUBLISHED' | 'NOTE_FORKED' | 'CARD_VIEWED' | 'TOPIC_VIEWED' | 'VIDEO_STARTED' | 'VIDEO_COMPLETED' | 'QUIZ_STARTED' | 'QUIZ_COMPLETED' | 'FLASHCARD_REVIEWED' | 'TIME_SPENT' | 'NOTE_SAVED' | 'TOPIC_REVISITED' | 'EXAM_CREATED' | 'RESOURCE_VIEWED' | 'RESOURCE_SAVED' | 'AI_REQUESTED' | 'SEARCH_PERFORMED' | 'TOPIC_COMPLETED' | 'PROBLEM_MARKED'

export interface LearningHistory {
  /** The time zone days are counted in */
  timeZone: string
  /** Days with something in them, newest first */
  days: Array<LearningHistoryDay>
  /** Pass as `before` for older days; null when there are none */
  nextBefore: string | null
}

export interface LearningHistoryDay {
  /** The learning day, YYYY-MM-DD, in the person's time zone (it rolls over at 04:00) */
  day: string
  /** Focus sessions, reviews and quizzes */
  learningSeconds: number
  /** Notes and /core topics open */
  readingSeconds: number
  reviews: number
  quizAnswers: number
  /** Counts towards Rhythm: 10 learning minutes or 10 reviews (ADR-0030) */
  counted: boolean
  /** Most time first */
  topics: Array<LearningHistoryTopic>
  /** Notes opened that day that the viewer can still read, newest first */
  notes: Array<Note | null>
}

export interface LearningHistoryTopic {
  /** topic:<id> or core:<subject>/<topic> */
  key: string
  /** The notes topic, when the key is one the viewer may see; null for /core topics */
  topic: Topic | null
  seconds: number
}

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
  /** Required for HIDE, REMOVE, WARN and SUSPEND: the author is told */
  reason?: string | null
  /** SUSPEND: for how many days, 1 to 365 */
  suspendDays?: number | null
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

/** APPROVE frees a held note, puts back hidden or removed content and removed groups, lifts a suspension, and approves a resource; HIDE and REMOVE take it off for everyone but its author (REMOVE rejects a resource, ADR-0074); DISMISS closes reports; WARN tells the author; SUSPEND (accounts only, platform admins, ADR-0053) stops an account reaching others for suspendDays */
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
  /** USER cases: until when the account is suspended, if it is */
  suspendedUntil: Date | null
  /** GROUP cases of a group platform moderators removed (ADR-0053) */
  removedGroup: RemovedGroup | null
  reports: Array<ModerationReport>
  appeal: ModerationAppeal | null
  openedAt: Date
  /** Set for RESOURCE cases */
  resource?: Resource | null
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

export interface MutationStartContestArgs {
  input: StartContestInput
}

export interface MutationAnswerContestQuestionArgs {
  input: AnswerContestQuestionInput
}

export interface MutationSubmitContestArgs {
  input: ContestAttemptIdInput
}

export interface MutationSetContestBandsArgs {
  input: SetContestBandsInput
}

export interface MutationSaveContestArgs {
  input: ContestInput
}

export interface MutationPublishContestArgs {
  input: ContestIdInput
}

export interface MutationDeleteContestArgs {
  input: ContestIdInput
}

export interface MutationSetAchievementsShownArgs {
  input: SetAchievementsShownInput
}

export interface MutationCreateExamArgs {
  input: CreateExamInput
}

export interface MutationUpdateExamArgs {
  input: UpdateExamInput
}

export interface MutationDeleteExamArgs {
  input: ExamIdInput
}

export interface MutationStartFocusSessionArgs {
  input: StartFocusSessionInput
}

export interface MutationEndFocusSessionArgs {
  input: FocusSessionIdInput
}

export interface MutationInviteRhythmBuddyArgs {
  input: InviteRhythmBuddyInput
}

export interface MutationAnswerRhythmBuddyArgs {
  input: AnswerRhythmBuddyInput
}

export interface MutationRemoveRhythmBuddyArgs {
  input: RhythmBuddyIdInput
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

export interface MutationSetLearningTimeZoneArgs {
  input: SetLearningTimeZoneInput
}

export interface MutationTrackEventsArgs {
  input: TrackEventsInput
}

export interface MutationPublishClassQuizArgs {
  input: PublishClassQuizInput
}

export interface MutationSubmitQuizAttemptArgs {
  input: SubmitQuizAttemptInput
}

export interface MutationDeleteClassQuizArgs {
  input: ClassQuizIdInput
}

export interface MutationDismissRecommendationArgs {
  input: DismissRecommendationInput
}

export interface MutationSubmitResourceArgs {
  input: SubmitResourceInput
}

export interface MutationUpdateResourceArgs {
  input: UpdateResourceInput
}

export interface MutationDeleteResourceArgs {
  input: ResourceIdInput
}

export interface MutationSaveResourceArgs {
  input: ResourceIdInput
}

export interface MutationUnsaveResourceArgs {
  input: ResourceIdInput
}

export interface MutationRecommendResourceArgs {
  input: RecommendResourceInput
}

export interface MutationRemoveResourceRecommendationArgs {
  input: ResourceRecommendationIdInput
}

export interface MutationReviewCardArgs {
  input: ReviewCardInput
}

export interface MutationStudyNoteCardsArgs {
  input: StudyNoteInput
}

export interface MutationStopStudyingNoteCardsArgs {
  input: StudyNoteInput
}

export interface MutationResetCardReviewArgs {
  input: CardIdInput
}

export interface MutationSetRhythmPlanArgs {
  input: SetRhythmPlanInput
}

export interface MutationPauseRhythmArgs {
  input: PauseRhythmInput
}

export interface MutationEndRhythmPauseArgs {
  input: RhythmPauseIdInput
}

export interface MutationSetRhythmSharingArgs {
  input: SetRhythmSharingInput
}

export interface MutationCreateSharedQuizArgs {
  input: SharedQuizWriteInput
}

export interface MutationUpdateSharedQuizArgs {
  input: UpdateSharedQuizInput
}

export interface MutationSetSharedQuizVisibilityArgs {
  input: SetSharedQuizVisibilityInput
}

export interface MutationSubmitSharedQuizAttemptArgs {
  input: SubmitSharedQuizAttemptInput
}

export interface MutationDeleteSharedQuizArgs {
  input: SharedQuizIdInput
}

export interface MutationAddWeeklyTaskArgs {
  input: AddWeeklyTaskInput
}

export interface MutationUpdateWeeklyTaskArgs {
  input: UpdateWeeklyTaskInput
}

export interface MutationRemoveWeeklyTaskArgs {
  input: WeeklyTaskIdInput
}

export interface MutationSetClassGoalArgs {
  input: SetClassGoalInput
}

export interface MutationSetGroupRepositoryArgs {
  input: SetGroupRepositoryInput
}

export interface MutationConnectRepositoryAppArgs {
  input: ConnectRepositoryAppInput
}

export interface MutationDisconnectRepositoryAppArgs {
  input: GroupIdInput
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
  /** Signed in: whether the viewer studies this note's flashcards (their own notes' always count) */
  viewerStudying?: boolean | null
}

export interface OkPayload {
  ok: boolean
  userErrors: Array<UserError>
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface PauseRhythmInput {
  /** YYYY-MM-DD, today or later */
  from: string
  to: string
  reason: RhythmPauseReason
}

export interface PinGroupPostInput {
  postId: string
  pinned: boolean
}

export type Platform = 'WEB' | 'ANDROID' | 'IOS'

/** A line of the viewer's own points history. Who acted is never told. */
export interface PointsEntry {
  id: string
  /** Positive when earned, negative when taken back (a reaction removed, a note no longer public, a resource removed) */
  delta: number
  rule: PointsRule
  sourceType: PointsSource
  sourceId: string
  subjectTitle: string | null
  createdAt: Date
}

export interface PointsEntryConnection {
  edges: Array<PointsEntryEdge>
  pageInfo: PageInfo
}

export interface PointsEntryEdge {
  cursor: string
  node: PointsEntry
}

/** What earned points or took them back */
export type PointsRule = 'REACTION' | 'FORK' | 'RESOURCE_APPROVED'

export type PointsSource = 'NOTE' | 'RESOURCE'

export type ProblemMark = 'SOLVED' | 'REVISIT'

export interface PublishClassQuizInput {
  classroomId: string
  title: string
  /** 1 to 50 questions, each quiz card content: question, choices, correct, multiple, explanation */
  questions: Array<unknown>
  /** The note the questions came from; kept when the author can read it */
  sourceNoteId?: string | null
}

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

export interface QueryForYouFeedArgs {
  first?: number | null
  after?: string | null
}

export interface QueryTrendingFeedArgs {
  first?: number | null
  after?: string | null
}

export interface QueryContestArgs {
  id: string
}

export interface QueryMyPointsArgs {
  first?: number | null
  after?: string | null
}

export interface QueryExamArgs {
  id: string
}

export interface QueryExamTopicOptionsArgs {
  query: string
}

export interface QueryGroupArgs {
  id: string
}

export interface QueryDiscoverGroupsArgs {
  query?: string | null
  first?: number | null
}

export interface QueryLearningHistoryArgs {
  before?: string | null
  days?: number | null
}

export interface QueryModerationQueueArgs {
  first?: number | null
  after?: string | null
  scope?: ModerationScopeInput | null
}

export interface QueryRemovedGroupArgs {
  id: string
}

export interface QueryClassQuizArgs {
  id: string
}

export interface QueryRecommendationsArgs {
  limit?: number | null
}

export interface QueryResourceArgs {
  id: string
}

export interface QueryResourceTopicOptionsArgs {
  query: string
}

export interface QueryResourcePreviewArgs {
  input: ResourcePreviewInput
}

export interface QueryResourcesArgs {
  filter?: ResourceFilter | null
  sort?: ResourceSort | null
  first?: number | null
  after?: string | null
}

export interface QuerySavedResourcesArgs {
  first?: number | null
  after?: string | null
}

export interface QueryResourceRecommendationsArgs {
  to: RecommendationPlaceInput
  first?: number | null
  after?: string | null
}

export interface QuerySharedQuizArgs {
  id: string
}

export interface QuerySharedQuizByLinkArgs {
  token: string
}

export interface QueryMyQuizzesArgs {
  first?: number | null
}

export interface QueryPublicQuizzesArgs {
  first?: number | null
}

export interface QueryDoubtArgs {
  id: string
}

export interface QuizAnswer {
  questionId: string
  choiceIds: Array<string>
  correct: boolean
}

export interface QuizAnswerInput {
  questionId: string
  /** Empty leaves the question unanswered (wrong) */
  choiceIds: Array<string>
}

export interface QuizAttempt {
  id: string
  score: number
  total: number
  submittedAt: Date
  answers: Array<QuizAnswer>
}

export interface QuizAttemptPayload {
  attempt: QuizAttempt | null
  /** The quiz again, now with its answers for the viewer */
  quiz: ClassQuiz | null
  userErrors: Array<UserError>
}

export type QuizVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC'

export interface QuizVisibilityChoice {
  visibility: QuizVisibility
  enabled: boolean
  reason: string | null
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

export interface Recommendation {
  kind: RecommendationKind
  /** Why, in words */
  reason: string
  /** Higher first; each kind has its band */
  score: number
  /** The note, for CONTINUE_NOTE, QUIZ_ON_TOPIC and POPULAR_NOTE */
  note: Note | null
  /** Its title as the viewer sees it */
  noteTitle: string | null
  /** The topic key, for EXAM_TOPIC and REVISE_TOPIC */
  topicKey: string | null
  topic: Topic | null
  topicTitle: string | null
  /** The resource, for RESOURCE */
  resource: Resource | null
}

export type RecommendationKind = 'EXAM_TOPIC' | 'REVISE_TOPIC' | 'CONTINUE_NOTE' | 'QUIZ_ON_TOPIC' | 'POPULAR_NOTE' | 'RESOURCE'

/** Where a recommendation goes: one of a person, a group or a class */
export interface RecommendationPlaceInput {
  userId?: string | null
  groupId?: string | null
  classroomId?: string | null
}

export interface RecommendResourceInput {
  resourceId: string
  to: RecommendationPlaceInput
  /** Why, in a sentence or two (at most 280 characters) */
  reason?: string | null
}

export interface RejectedLearningEvent {
  /** Its place in the batch */
  index: number
  message: string
}

/** A group platform moderators removed (ADR-0053): its owner reads why and may appeal once */
export interface RemovedGroup {
  id: string
  name: string
  reason: string
  removedAt: Date
  canAppeal: boolean
}

export interface ReportContentInput {
  entityType: ReportEntityType
  entityId: string
  reason: ReportReason
  /** What is wrong, in the reporter's words (at most 1,000 characters) */
  details?: string | null
}

export type ReportEntityType = 'NOTE' | 'USER' | 'COMMENT' | 'GROUP_POST' | 'CLASSROOM_POST' | 'DOUBT' | 'GROUP' | 'RESOURCE'

export type ReportReason = 'HARASSMENT' | 'SEXUAL' | 'SELF_HARM' | 'HATE' | 'SPAM' | 'COPYRIGHT' | 'OTHER'

export interface RepositoryApp {
  /** The App is connected: the repository's activity comes to the workspace */
  connected: boolean
  /** The workspace's admins, while not connected: where to install the App (for an hour) */
  installUrl: string | null
}

/** What happened in the repository: never code, only the title, who, where and when (ADR-0078) */
export interface RepositoryEvent {
  id: string
  kind: RepositoryEventKind
  /** pushed, opened, closed, merged or reopened */
  action: string
  /** A commit's first line, or a pull request's or issue's title */
  title: string
  number: number | null
  /** A GitHub login, not a LearnViaNotes person */
  authorLogin: string | null
  url: string
  at: Date
}

export type RepositoryEventKind = 'PUSH' | 'PULL_REQUEST' | 'ISSUE'

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

/** A resource of the catalogue: approved ones are everyone's, guests included */
export interface Resource {
  id: string
  type: ResourceType
  title: string
  description: string | null
  /** The link without tracking or affiliate parameters; the apps show it with rel="ugc nofollow noopener" */
  url: string
  /** The link's site without www., e.g. nptel.ac.in */
  host: string
  /** ISBN-13, for books */
  isbn: string | null
  /** By: the author or maker */
  author: string | null
  /** A read URL for its cover picture, valid for 15 minutes */
  coverUrl: string | null
  /** Curated topics; null for one the viewer may no longer see */
  topics: Array<Topic | null>
  submittedBy: User
  status: ResourceStatus
  /** Why moderators rejected or removed it: its submitter and moderators only */
  reason: string | null
  decidedAt: Date | null
  createdAt: Date
  viewerCan: ResourceActions
  /** How many people saved it; who saved what is private */
  saveCount?: number
  viewerSaved?: boolean
  /** Search engines may index its page: approved and saved by at least three people */
  indexable?: boolean
}

export interface ResourceActions {
  /** Its submitter, until it is approved; saving a rejected one sends it to moderators again */
  edit: boolean
  delete: boolean
  report: boolean
}

export interface ResourceConnection {
  edges: Array<ResourceEdge>
  pageInfo: PageInfo
}

export interface ResourceEdge {
  cursor: string
  node: Resource
}

export interface ResourceFilter {
  type?: ResourceType | null
  topicId?: string | null
  /** Words in the title, the author or the description */
  query?: string | null
}

export interface ResourceIdInput {
  id: string
}

export interface ResourcePayload {
  resource: Resource | null
  userErrors: Array<UserError>
}

/** What a link's page or an ISBN's book says, for the person to edit before sending; nothing is kept */
export interface ResourcePreview {
  /** The link as it would be kept, or the book's Open Library page */
  url: string | null
  title: string | null
  description: string | null
  author: string | null
  isbn: string | null
  /** A guess from the page or the site; the person chooses */
  type: ResourceType | null
  siteName: string | null
  /** The page's picture on its own site: sent back with the resource, the server copies it into storage */
  imageUrl: string | null
  /** The page or the book was read; false: fill in the details by hand */
  found: boolean
  /** An approved resource with this link or ISBN already */
  existing: Resource | null
}

export interface ResourcePreviewInput {
  url?: string | null
  /** Looked up on Open Library instead of the link */
  isbn?: string | null
}

/** A resource someone recommended, with their reason */
export interface ResourceRecommendation {
  id: string
  resource: Resource
  from: User
  reason: string | null
  createdAt: Date
  /** Its sender, its recipient, the group's moderators or the class's staff */
  viewerCanRemove: boolean
}

export interface ResourceRecommendationConnection {
  edges: Array<ResourceRecommendationEdge>
  pageInfo: PageInfo
}

export interface ResourceRecommendationEdge {
  cursor: string
  node: ResourceRecommendation
}

export interface ResourceRecommendationIdInput {
  id: string
}

export type ResourceSort = 'POPULAR' | 'NEWEST'

/** PENDING: waiting for moderators (its submitter and moderators see it); APPROVED: public; REJECTED: rejected or removed, with a reason */
export type ResourceStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ResourceType = 'BOOK' | 'COURSE' | 'TOOL' | 'SOFTWARE' | 'HARDWARE' | 'OTHER'

/** A flashcard to review, as the person reads its note now */
export interface ReviewCard {
  cardId: string
  noteId: string
  noteTitle: string
  /** Rich text */
  front: unknown
  /** Rich text */
  back: unknown
  state: ReviewState
  /** null for a new card */
  due: Date | null
}

export interface ReviewCardInput {
  cardId: string
  rating: ReviewRating
  /** When it was graded on the device; now when absent; believed back at most 30 days */
  reviewedAt?: Date | null
  durationMs?: number | null
  /** The device's id for this grade: sent twice, it counts once */
  clientOpId: string
}

export interface ReviewCardPayload {
  review: CardReviewResult | null
  userErrors: Array<UserError>
}

export interface ReviewClassroomJoinRequestInput {
  requestId: string
  decision: JoinDecision
}

export interface ReviewGroupJoinRequestInput {
  requestId: string
  decision: JoinDecision
}

export interface ReviewQueue {
  /** Today's cards: due first (most overdue first), then new; 20 a day, at most 10 new */
  cards: Array<ReviewCard>
  /** Cards due by the end of today, in the whole deck */
  due: number
  /** Cards never reviewed, in the whole deck */
  new: number
  doneToday: number
  /** Cards past today's cap: they wait for the next days */
  waiting: number
}

export type ReviewRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export type ReviewState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'

export interface Rhythm {
  timeZone: string
  /** ISO weekdays, 1 Monday … 7 Sunday */
  plannedDays: Array<number>
  /** Planned days less paused ones, at least 1 */
  target: number
  countedDays: number
  met: boolean
  /** Monday to Sunday */
  week: Array<RhythmDay>
  today: RhythmToday
  weeksThisTerm: number
  weeksAllTime: number
  countedDaysAllTime: number
  /** Current and coming pauses */
  pauses: Array<RhythmPause>
  /** Of the 14 a term */
  pauseDaysLeft: number
  suggestion: RhythmSuggestion | null
  /** Their name and counted days show on their classes' Rhythm ring (ADR-0072); off by default */
  shareRhythm: boolean
}

export interface RhythmBuddies {
  /** At most five */
  buddies: Array<RhythmBuddy>
  invites: Array<RhythmBuddyInvite>
  sent: Array<RhythmBuddyInvite>
}

/** What a buddy may see of the other: studying now, and this week's counted days */
export interface RhythmBuddy {
  /** The link's id: end it with removeRhythmBuddy */
  id: string
  user: User
  since: Date
  studyingNow: boolean
  studyingSince: Date | null
  /** The session's topic, when it has one the viewer may see */
  topicTitle: string | null
  meetUrl: string | null
  countedDays: number
  target: number
  met: boolean
  /** The pair's week together (ADR-0081): both counted days against both targets */
  together: BuddyTogether
}

export interface RhythmBuddyIdInput {
  id: string
}

export interface RhythmBuddyInvite {
  id: string
  /** Who asked (invites), or who was asked (sent) */
  user: User
  at: Date
}

export interface RhythmDay {
  /** YYYY-MM-DD, a learning day in the learner's zone */
  day: string
  /** 1 Monday … 7 Sunday */
  weekday: number
  planned: boolean
  counted: boolean
  status: RhythmDayStatus
}

export type RhythmDayStatus = 'COUNTED' | 'MISSED' | 'REST' | 'PAUSED' | 'TODAY' | 'AHEAD'

/** One part of today's ring */
export interface RhythmItem {
  /** REVIEWS, PLAN_TASK (today's exam-plan tasks) or WEAK_TOPIC (one weak topic, done at 10 minutes on it today) */
  kind: string
  done: number
  total: number
  /** The exams of today's tasks, or the weak topic's title (null for a /core topic) */
  title: string | null
  /** The weak topic's key */
  topicKey: string | null
}

export interface RhythmPause {
  id: string
  from: string
  to: string
  reason: RhythmPauseReason
  active: boolean
}

export interface RhythmPauseIdInput {
  id: string
}

export type RhythmPauseReason = 'EXAMS' | 'ILLNESS' | 'FESTIVAL' | 'TRAVEL' | 'OTHER'

/** Three weeks before an exam, one more planned day a week; nothing changes until the learner sets it */
export interface RhythmSuggestion {
  plannedDays: number
  examId: string
  examName: string
  daysLeft: number
}

export interface RhythmToday {
  day: string
  learningSeconds: number
  reviews: number
  /** 10 learning minutes or 10 reviews */
  counted: boolean
  /** The day after a missed planned day, until a day counts */
  comeback: boolean
  /** Today followed a missed planned day and counted: back on rhythm */
  cameBack: boolean
  items: Array<RhythmItem>
}

export interface SetAchievementsShownInput {
  show: boolean
}

export interface SetClassGoalInput {
  classroomId: string
  on: boolean
  /** Counted days for the class this week; leave it out to size it from the class's recent weeks */
  target?: number | null
}

export interface SetClassroomRoleInput {
  classroomId: string
  userId: string
  /** TEACHER hands the class to another teacher, who must hold the teacher role */
  role: ClassroomRole
}

export interface SetContestBandsInput {
  show: boolean
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

export interface SetLearningTimeZoneInput {
  /** An IANA time zone, e.g. Asia/Kolkata */
  timeZone: string
}

export interface SetProjectShowcaseInput {
  groupId: string
  /** A PUBLIC project note shared to the workspace; null clears it */
  noteId?: string | null
}

export interface SetRhythmPlanInput {
  /** 3 to 6 weekdays, 1 Monday … 7 Sunday */
  plannedDays: Array<number>
}

export interface SetRhythmSharingInput {
  share: boolean
}

export interface SetSharedQuizVisibilityInput {
  quizId: string
  visibility: QuizVisibility
}

export interface SharedQuiz {
  id: string
  title: string
  visibility: QuizVisibility
  owner: User
  publishedAt: Date | null
  questionCount: number
  questions: Array<SharedQuizQuestion>
  /** Owner only, when the quiz is not Private: /q/{linkToken} */
  sharePath: string | null
  /** Owner only */
  visibilityChoices: Array<QuizVisibilityChoice> | null
  /** The viewer's own attempts, newest first */
  myAttempts: Array<QuizAttempt>
  /** Owner only. Counts, never who took it. */
  stats: SharedQuizStats | null
  viewerIsOwner: boolean
}

export interface SharedQuizAttemptPayload {
  attempt: QuizAttempt | null
  quiz: SharedQuiz | null
  userErrors: Array<UserError>
}

export interface SharedQuizIdInput {
  quizId: string
}

export interface SharedQuizPayload {
  quiz: SharedQuiz | null
  userErrors: Array<UserError>
}

export interface SharedQuizQuestion {
  id: string
  position: number
  question: unknown
  choices: Array<ClassQuizChoice>
  multiple: boolean
  /** Null until the viewer has submitted, or is the owner */
  correct: Array<string> | null
  explanation: unknown | null
}

export interface SharedQuizQuestionStats {
  questionId: string
  /** How many scored attempts (the first one of each person) got this question right */
  correctCount: number
}

export interface SharedQuizStats {
  takerCount: number
  scoredAttempts: number
  practiceAttempts: number
  /** Mean of each person's first score, as a fraction of the questions. Null when nobody has taken it. */
  averageScore: number | null
  questions: Array<SharedQuizQuestionStats>
}

export interface SharedQuizWriteInput {
  title: string
  /** 1 to 50 questions, each quiz card content */
  questions: Array<unknown>
  visibility?: QuizVisibility | null
}

export interface StartContestInput {
  contestId: string
}

export interface StartFocusSessionInput {
  topicKey?: string | null
  /** A note the viewer can read */
  noteId?: string | null
  /** 5–90, 25 by default */
  minutes?: number | null
  /** 0–30, 5 by default */
  breakMinutes?: number | null
  /** https://meet.google.com/abc-defg-hij; buddies see it during the session */
  meetUrl?: string | null
}

export interface StudyNoteInput {
  noteId: string
}

export interface SubmitQuizAttemptInput {
  quizId: string
  /** The client's id for this submission: sending it again returns the same attempt */
  clientOpId: string
  answers: Array<QuizAnswerInput>
}

export interface SubmitResourceInput {
  type: ResourceType
  title: string
  description?: string | null
  url: string
  /** Books only */
  isbn?: string | null
  author?: string | null
  /** 1 to 5 curated topics */
  topicIds: Array<string>
  /** An uploaded picture (purpose COVER) */
  coverFileId?: string | null
  /** Else the preview's imageUrl, copied into storage */
  imageUrl?: string | null
}

export interface SubmitSharedQuizAttemptInput {
  quizId: string
  clientOpId: string
  answers: Array<QuizAnswerInput>
}

/** A task worth setting this week, and why */
export interface TaskSuggestion {
  kind: WeeklyTaskKind
  target: number
  topicId: string | null
  topicTitle: string | null
  why: string
}

/** A topic of the notes subgraph */
export interface Topic {
  id: string
}

export interface TrackEventsInput {
  /** At most 100 */
  events: Array<LearningEventInput>
  /** The device's IANA time zone (Asia/Kolkata): days are counted in it, rolling over at 04:00 */
  timeZone?: string | null
}

export interface TrackEventsPayload {
  /** New events stored */
  accepted: number
  /** Events already received (a batch sent again) */
  duplicates: number
  /** Events refused one by one; the rest of the batch is kept */
  rejected: Array<RejectedLearningEvent>
  userErrors: Array<UserError>
}

export interface UpdateClassroomInput {
  classroomId: string
  name?: string | null
  description?: string | null
  /** A new code; the old one stops working */
  newCode?: boolean | null
}

export interface UpdateExamInput {
  id: string
  name?: string | null
  date?: string | null
  /** Replaces the topics; the plan is made again from today */
  topicIds?: Array<string> | null
}

export interface UpdateGroupInput {
  groupId: string
  name?: string | null
  description?: string | null
  privacy?: GroupPrivacy | null
  joinPolicy?: GroupJoinPolicy | null
  /** A new picture: an uploaded file (purpose GROUP_PICTURE) of the admin's own (ADR-0076) */
  pictureFileId?: string | null
  /** Takes the picture away */
  removePicture?: boolean | null
}

export interface UpdateResourceInput {
  id: string
  type: ResourceType
  title: string
  description?: string | null
  url: string
  isbn?: string | null
  author?: string | null
  topicIds: Array<string>
  coverFileId?: string | null
  imageUrl?: string | null
  /** Take the cover away */
  removeCover?: boolean | null
}

export interface UpdateSharedQuizInput {
  quizId: string
  title: string
  questions: Array<unknown>
}

export interface UpdateWeeklyTaskInput {
  id: string
  target?: number | null
  /** An empty plan clears it */
  plan?: string | null
}

/** A person, owned by the users subgraph */
export interface User {
  id: string
  /** Achievements, the highest tier of each: the viewer's own, or an adult's who shows them; null otherwise */
  achievements?: Array<Achievement> | null
  /** Points and level, under the same rule as achievements */
  contribution?: Contribution | null
}

export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
  /** Seconds until a RATE_LIMITED caller may retry. Null for every other code. */
  retryAfter: number | null
  /** One address on AGE_RESTRICTED and on a blocked sign-in: SUPPORT_EMAIL (support@learnvianotes.in unless the environment sets another). */
  supportEmail: string | null
}

export interface WeakTopic {
  key: string
  /** Null for a /core topic: show its key */
  title: string | null
  topic: Topic | null
  reason: WeakTopicReason
  accuracy: number | null
  /** The soonest exam it is a topic of, if any */
  examId: string | null
  examName: string | null
  daysLeft: number | null
}

export type WeakTopicReason = 'LOW_ACCURACY' | 'NOT_REVISITED'

export interface WeeklyTask {
  id: string
  kind: WeeklyTaskKind
  target: number
  topicId: string | null
  topicTitle: string | null
  /** When and where, in the person's words */
  plan: string | null
  /** This week so far, from what learning recorded */
  progress: number
  done: boolean
}

export interface WeeklyTaskIdInput {
  id: string
}

export type WeeklyTaskKind = 'REVIEWS' | 'QUIZ_ANSWERS' | 'TOPIC_MINUTES'

export interface WeeklyTaskPayload {
  task: WeeklyTask | null
  userErrors: Array<UserError>
}

export interface WeeklyTasks {
  /** The Monday of the person's Rhythm week (YYYY-MM-DD) */
  weekStart: string
  tasks: Array<WeeklyTask>
  /** Tasks a week may hold */
  max: number
}

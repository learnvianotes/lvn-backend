// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

export interface AcceptTermsInput {
  /** Query.termsVersion, as shown to the person */
  version: string
}

/** An application to teach (ADR-0073). fileIds: 0–3 proof files uploaded with createUploadIntent(purpose:
 * VERIFICATION_DOCUMENT), seen by platform admins only, deleted 30 days after the decision */
export interface ApplyToTeachInput {
  institution: string
  subjects?: string | null
  message?: string | null
  fileIds?: Array<string> | null
}

export interface AuthPayload {
  session: Session | null
  userErrors: Array<UserError>
}

/** After a provider sign-in (no signUp call): the same details, collected once */
export interface CompleteRegistrationInput {
  displayName: string
  dateOfBirth: string
  institutionalEmail?: string | null
  acceptedTermsVersion: string
}

export type ConnectionDirection = 'INCOMING' | 'OUTGOING'

export interface ConnectionRequestInput {
  requestId: string
}

export interface ConnectionRequestItem {
  id: string
  direction: ConnectionDirection
  /** Who asked (INCOMING) or was asked (OUTGOING) */
  person: User
  createdAt: Date
}

export interface DataExport {
  id: string
  status: DataExportStatus
  requestedAt: Date
  readyAt: Date | null
  /** Kept until then (7 days) */
  expiresAt: Date | null
  sizeBytes: number | null
  /** While READY: a download link that works for 15 minutes; ask again for a new one */
  downloadUrl: string | null
}

export interface DataExportPayload {
  export: DataExport | null
  userErrors: Array<UserError>
}

export type DataExportStatus = 'PENDING' | 'READY' | 'FAILED' | 'EXPIRED'

export interface DecideDomainReviewInput {
  domain: string
  approve: boolean
}

export interface DomainReview {
  domain: string
  status: DomainReviewStatus
  /** How many people asked for it */
  requests: number
  firstSeenAt: Date
}

export type DomainReviewStatus = 'ACADEMIC_QUEUED' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED'

/** Fixed error vocabulary (§6.2) */
export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL' | 'UNAVAILABLE'

export type GlobalRole = 'STUDENT' | 'TEACHER' | 'PLATFORM_ADMIN'

export interface Institution {
  name: string
  verified: boolean
}

export type InstitutionalEmailStatus = 'NONE' | 'CODE_SENT' | 'CONFIRMED' | 'PENDING_REVIEW'

export interface LegacyCounts {
  notes: number
  completedTopics: number
  markedProblems: number
  studyDays: number
  studyMinutes: number
}

export interface LegacyImport {
  status: LegacyImportStatus
  counts: LegacyCounts | null
  claimedAt: Date | null
}

export type LegacyImportStatus = 'NOT_FOUND' | 'AVAILABLE' | 'CLAIMED' | 'DECLINED'

/** A plan limit and current use, for "3 of 5 groups" and early warnings; limit null = unlimited */
export interface Limit {
  key: LimitKey
  limit: number | null
  used: number
}

export type LimitKey = 'STORAGE_BYTES' | 'AI_TOKENS_DAILY' | 'PDF_PAGES_MONTHLY' | 'GROUPS_OWNED' | 'GROUP_MEMBERS' | 'CLASSROOMS_OWNED' | 'CLASSROOM_MEMBERS' | 'PROJECT_WORKSPACES' | 'EXPORTS_DAILY' | 'IMPORTS_DAILY' | 'ORG_SEATS'

export interface MutationSignUpArgs {
  input: SignUpInput
}

export interface MutationSignInArgs {
  input: SignInInput
}

export interface MutationRefreshSessionArgs {
  input: RefreshSessionInput
}

export interface MutationVerifyEmailArgs {
  input: VerifyEmailInput
}

export interface MutationRequestPasswordResetArgs {
  input: RequestPasswordResetInput
}

export interface MutationResetPasswordArgs {
  input: ResetPasswordInput
}

export interface MutationUpdateProfileArgs {
  input: UpdateProfileInput
}

export interface MutationSignInWithGoogleArgs {
  input: SignInWithGoogleInput
}

export interface MutationOauthExchangeArgs {
  input: OAuthExchangeInput
}

export interface MutationCompleteRegistrationArgs {
  input: CompleteRegistrationInput
}

export interface MutationSetInstitutionalEmailArgs {
  input: SetInstitutionalEmailInput
}

export interface MutationVerifyInstitutionalEmailArgs {
  input: VerifyInstitutionalEmailInput
}

export interface MutationFollowUserArgs {
  input: PersonInput
}

export interface MutationUnfollowUserArgs {
  input: PersonInput
}

export interface MutationRemoveFollowerArgs {
  input: PersonInput
}

export interface MutationBlockUserArgs {
  input: PersonInput
}

export interface MutationUnblockUserArgs {
  input: PersonInput
}

export interface MutationRestrictUserArgs {
  input: PersonInput
}

export interface MutationUnrestrictUserArgs {
  input: PersonInput
}

export interface MutationRequestConnectionArgs {
  input: PersonInput
}

export interface MutationRespondToConnectionRequestArgs {
  input: RespondToConnectionRequestInput
}

export interface MutationWithdrawConnectionRequestArgs {
  input: ConnectionRequestInput
}

export interface MutationRemoveConnectionArgs {
  input: PersonInput
}

export interface MutationUpdateTeacherProfileArgs {
  input: UpdateTeacherProfileInput
}

export interface MutationAcceptTermsArgs {
  input: AcceptTermsInput
}

export interface MutationRequestTeacherVerificationArgs {
  input: RequestTeacherVerificationInput
}

export interface MutationRequestDocumentVerificationArgs {
  input: RequestDocumentVerificationInput
}

export interface MutationApplyToTeachArgs {
  input: ApplyToTeachInput
}

export interface MutationWithdrawVerificationRequestArgs {
  requestId: string
}

export interface MutationReviewVerificationRequestArgs {
  input: ReviewVerificationRequestInput
}

export interface MutationDecideDomainReviewArgs {
  input: DecideDomainReviewInput
}

export interface MutationSetGlobalRoleArgs {
  input: SetGlobalRoleInput
}

/** Authorization Code + PKCE: the code from the provider's redirect and the verifier the client generated */
export interface OAuthExchangeInput {
  provider: OAuthProvider
  code: string
  codeVerifier: string
  redirectUri: string
}

/** Providers exchanged through oauthExchange. Google uses signInWithGoogle (ADR-0007). */
export type OAuthProvider = 'GITHUB' | 'LINKEDIN'

export interface OkPayload {
  ok: boolean
  userErrors: Array<UserError>
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface PendingConnection {
  direction: ConnectionDirection
  requestId: string
}

export interface PersonConnection {
  edges: Array<PersonEdge>
  pageInfo: PageInfo
}

export interface PersonEdge {
  cursor: string
  node: User
  /** Since when (followed, blocked, restricted) */
  since: Date
}

export interface PersonInput {
  userId: string
}

export interface PersonPayload {
  /** The person, as the viewer now stands with them */
  user: User | null
  userErrors: Array<UserError>
}

export interface ProfilePayload {
  profile: StudentProfile | null
  userErrors: Array<UserError>
}

export interface QueryUserByHandleArgs {
  handle: string
}

export interface QueryMyFollowersArgs {
  first?: number | null
  after?: string | null
}

export interface QueryMyFollowingArgs {
  first?: number | null
  after?: string | null
}

export interface QueryVerificationRequestsToReviewArgs {
  first?: number | null
  after?: string | null
}

export interface QueryVerificationDocumentUrlArgs {
  requestId: string
  fileId: string
}

export interface QueryTeachersArgs {
  search: string
}

export interface QueryDomainReviewsArgs {
  status?: DomainReviewStatus | null
}

export interface RefreshSessionInput {
  /** Mobile only; web sends the cookie */
  refreshToken?: string | null
}

/** How the viewer stands with a person */
export interface Relation {
  following: boolean
  followedBy: boolean
  /** The viewer blocked them; being blocked by them is never shown */
  blocked: boolean
  restricted: boolean
  /** Teachers who connected (ADR-0013) */
  connected: boolean
  pendingConnection: PendingConnection | null
  viewerCan: RelationActions
}

/** What the viewer may do about a person, from the same rules the API applies */
export interface RelationActions {
  follow: boolean
  unfollow: boolean
  removeFollower: boolean
  block: boolean
  unblock: boolean
  restrict: boolean
  unrestrict: boolean
  /** Teachers connect with teachers (ADR-0013) */
  requestConnection: boolean
  respondToConnection: boolean
  removeConnection: boolean
}

/** fileIds uploaded with createUploadIntent(purpose: VERIFICATION_DOCUMENT); seen by platform admins only, deleted 30 days after the decision */
export interface RequestDocumentVerificationInput {
  fileIds: Array<string>
  message?: string | null
}

export interface RequestPasswordResetInput {
  email: string
}

export interface RequestTeacherVerificationInput {
  teacherId: string
  message?: string | null
}

export interface ResetPasswordInput {
  token: string
  password: string
}

export interface RespondToConnectionRequestInput {
  requestId: string
  accept: boolean
}

export interface ReviewVerificationRequestInput {
  requestId: string
  approve: boolean
  /** Required when rejecting */
  reason?: string | null
}

export interface Session {
  /** 15-minute RS256 JWT. Web keeps it in memory; mobile in expo-secure-store. */
  accessToken: string
  accessTokenExpiresAt: Date
  /** Mobile only (header X-LVN-Client: mobile). Web receives it as an HttpOnly cookie and this field is null. */
  refreshToken: string | null
  user: User
}

export interface SetGlobalRoleInput {
  userId: string
  role: GlobalRole
}

export interface SetInstitutionalEmailInput {
  email: string
}

export interface SignedUrl {
  url: string
  expiresAt: Date
}

export interface SignInInput {
  email: string
  password: string
}

/** Which sign-in methods this deployment offers */
export interface SignInOptions {
  emailPassword: boolean
  google: boolean
  github: boolean
  linkedin: boolean
}

/** Firebase ID token from a Google sign-in; verified by the API and exchanged for an LVN session (ADR-0007) */
export interface SignInWithGoogleInput {
  idToken: string
}

/** Registration (ADR-0017, ADR-0019): date of birth is required (YYYY-MM-DD). A college or organisation email is
 * optional; it receives a 6-digit code. `acceptedTermsVersion` must be Query.termsVersion. */
export interface SignUpInput {
  email: string
  password: string
  displayName: string
  dateOfBirth: string
  institutionalEmail?: string | null
  acceptedTermsVersion: string
}

/** Department and year are shown to others only if showOnProfile; interests stay private */
export interface StudentProfile {
  department: string | null
  yearOfStudy: YearOfStudy | null
  /** Viewer only. Topics arrive with notes (Phase 2), which will add the resolved `interests`. */
  interestTopicIds: Array<string> | null
  showOnProfile: boolean
}

export interface TeacherProfile {
  headline: string | null
  bio: string | null
  /** In the teacher's order */
  skills: Array<TeacherSkill>
  updatedAt: Date | null
}

export interface TeacherProfilePayload {
  profile: TeacherProfile | null
  userErrors: Array<UserError>
}

export interface TeacherSkill {
  id: string
  kind: TeacherSkillKind
  name: string
  detail: string | null
  source: TeacherSkillSource
}

export interface TeacherSkillInput {
  kind: TeacherSkillKind
  /** At most 120 characters */
  name: string
  /** At most 500 characters */
  detail?: string | null
}

export type TeacherSkillKind = 'SKILL' | 'QUALIFICATION' | 'EXPERIENCE'

export type TeacherSkillSource = 'MANUAL'

/** Where the viewer stands as a teacher (ADR-0073) */
export type TeacherStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'DECLINED'

/** Omitted fields stay as they are; null clears a field */
export interface UpdateProfileInput {
  department?: string | null
  yearOfStudy?: YearOfStudy | null
  interestTopicIds?: Array<string> | null
  showOnProfile?: boolean | null
}

/** Replaces the whole tab: headline (120 characters), bio (2,000) and at most 60 items in this order */
export interface UpdateTeacherProfileInput {
  headline?: string | null
  bio?: string | null
  skills: Array<TeacherSkillInput>
}

/** A person on LVN (§4.1). Fields marked viewer-only are null for anyone else. */
export interface User {
  id: string
  handle: string
  displayName: string
  /** Viewer only */
  email: string | null
  emailVerified: boolean
  /** False until the registration details are given (ADR-0017) */
  registrationComplete: boolean
  /** Verified by institutional email, a teacher, or platform admins (ADR-0019) */
  verified: boolean
  verificationMethod: VerificationMethod | null
  globalRole: GlobalRole
  createdAt: Date
  /** The viewer's own profile; for others only when they show it */
  profile?: StudentProfile | null
  /** Viewer only */
  limits?: Array<Limit> | null
  /** Viewer only: data from the old learnvianotes.in site (ADR-0023) */
  legacyImport?: LegacyImport | null
  /** Viewer only (ADR-0017): the confirmed address, or the one waiting for its code */
  institutionalEmail?: string | null
  /** Viewer only */
  institutionalEmailStatus?: InstitutionalEmailStatus | null
  /** The confirmed college or organisation */
  institution?: Institution | null
  /** Viewer only: a minor without verified consent (§15.2) — no public publishing, no DMs */
  restrictedMinor?: boolean | null
  /** Viewer only: exact counts */
  followerCount?: number | null
  followingCount?: number | null
  /** Everyone: followers as a milestone (ADR-0027) — 1000 for 1,000+, null below 1,000 */
  followerMilestone?: number | null
  /** The viewer's relation to this person; null for anonymous viewers and on one's own profile */
  relation?: Relation | null
  /** The Skills tab, for anyone; null for people who are not teachers */
  teacherProfile?: TeacherProfile | null
  /** The viewer's own: whether they accepted the current version (Query.termsVersion); false means ask again. null for others. */
  termsAccepted?: boolean | null
  /** Viewer only (ADR-0073) */
  teacherStatus?: TeacherStatus | null
}

/** An expected failure of a mutation; `field` is the dotted input path, e.g. ["input", "email"] */
export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
}

export interface VerificationDocument {
  fileId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export type VerificationMethod = 'INSTITUTIONAL_EMAIL' | 'TEACHER' | 'DOCUMENTS'

/** ACCOUNT: have the account verified (ADR-0019). TEACHER_ROLE: an application to teach (ADR-0073) */
export type VerificationPurpose = 'ACCOUNT' | 'TEACHER_ROLE'

/** Shown to the requester, the addressed teacher and platform admins. Documents are listed for platform admins only. */
export interface VerificationRequest {
  id: string
  purpose: VerificationPurpose
  method: VerificationMethod
  /** TEACHER_ROLE: where and what they teach */
  institution: string | null
  subjects: string | null
  status: VerificationRequestStatus
  message: string | null
  createdAt: Date
  decidedAt: Date | null
  reason: string | null
  requester: User
  /** TEACHER method: the teacher asked to vouch */
  teacher: User | null
  /** Platform admins only; open one with verificationDocumentUrl (every view is audited) */
  documents: Array<VerificationDocument>
}

export interface VerificationRequestPayload {
  request: VerificationRequest | null
  userErrors: Array<UserError>
}

export type VerificationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

export interface VerifyEmailInput {
  token: string
}

export interface VerifyInstitutionalEmailInput {
  code: string
}

export type YearOfStudy = 'YEAR_1' | 'YEAR_2' | 'YEAR_3' | 'YEAR_4' | 'YEAR_5' | 'POSTGRADUATE' | 'GRADUATED' | 'SCHOOL' | 'NOT_STUDYING'

// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

export interface AcceptTermsInput {
  /** Query.termsVersion, as shown to the person */
  version: string
}

export interface AccountDeletionPayload {
  /** When the account will be deleted; null once cancelled */
  deletionScheduledFor: Date | null
  userErrors: Array<UserError>
}

export interface AddExternalIdentityInput {
  kind: ExternalIdentityKind
  /** A GitHub user name (or its profile's address), or a page's address */
  value: string
}

/** `from` is inclusive and `to` is exclusive, both aligned to a UTC minute. A refresh within that minute reuses the cached aggregate. */
export interface AdminAiMetrics {
  from: Date
  to: Date
  tasksRun: number
  failures: number
  promptTokens: string
  completionTokens: string
  costMicroUsd: string
  byProvider: Array<AdminAiProviderUsage>
  byModel: Array<AdminAiModelUsage>
  byTask: Array<AdminAiTaskUsage>
}

export interface AdminAiModelUsage {
  provider: string
  model: string
  tasksRun: number
  failures: number
  promptTokens: string
  completionTokens: string
  costMicroUsd: string
}

/** Token sums and cost are decimal strings because they can exceed a GraphQL Int. Cost is millionths of a US dollar, 0 when no call recorded a price. */
export interface AdminAiProviderUsage {
  provider: string
  tasksRun: number
  failures: number
  promptTokens: string
  completionTokens: string
  costMicroUsd: string
}

export interface AdminAiTaskUsage {
  task: string
  tasksRun: number
  failures: number
  promptTokens: string
  completionTokens: string
  costMicroUsd: string
}

/** Notes, the catalogue, and places. Deleted notes, groups and classes are left out. */
export interface AdminContentMetrics {
  notes: number
  publicNotes: number
  subjects: number
  topics: number
  groups: number
  classrooms: number
}

/** Dashboard totals. Cached in each API process for about a minute. No personal data.
 * `from` and `to` bound AI usage only. Omit them for the last 30 days through the current minute.
 * The window can be at most 366 days. */
export interface AdminMetrics {
  generatedAt: Date
  users: AdminUserMetrics
  content: AdminContentMetrics
  ai: AdminAiMetrics
  storage: AdminStorageMetrics
  verification: AdminVerificationMetrics
  moderation: AdminModerationMetrics
}

export interface AdminModerationMetrics {
  openReports: number
  openAppeals: number
}

/** A plan's price and limits. `priceMinor` is minor currency units (paise, cents): 49900 INR MONTH is ₹499 a month.
 * `subscriberCount` is how many accounts are on it. Saving a price does not charge anyone. */
export interface AdminPlan {
  id: string
  code: string
  name: string
  priceMinor: number
  currency: string
  interval: PlanInterval
  features: Array<string>
  active: boolean
  entitlements: Array<AdminPlanEntitlement>
  subscriberCount: number
}

/** One limit on a plan. `limit` is a decimal string, or null for unlimited. */
export interface AdminPlanEntitlement {
  key: LimitKey
  limit: string | null
  appliesToRole: GlobalRole | null
}

export interface AdminPlanEntitlementInput {
  key: LimitKey
  /** A whole number of the unit LimitKey names, or null for unlimited. */
  limit?: string | null
  /** Null means every role. A role-specific row wins over that one. */
  appliesToRole?: GlobalRole | null
}

export interface AdminPlanPayload {
  plan: AdminPlan | null
  userErrors: Array<UserError>
}

/** One application setting. `value` is `true` or `false`, a decimal integer, text, or empty when an integer is cleared.
 * `overridden` is false when no admin has saved a row: `value` is then the environment variable or the built-in default.
 * Categories: auth, verification, uploads, ai, search, accounts. */
export interface AdminSetting {
  key: string
  type: AdminSettingType
  category: string
  description: string
  value: string
  overridden: boolean
  /** When an admin last saved it. Null while the environment or the built-in default is in effect. */
  updatedAt: Date | null
  constraints: AdminSettingConstraints
}

/** What an admin may send for this setting. */
export interface AdminSettingConstraints {
  /** Whole numbers: the smallest value, when the setting is an integer. */
  min: number | null
  /** Whole numbers: the largest value, when the setting is an integer. */
  max: number | null
  /** Text: the longest value, in characters. */
  maxLength: number | null
  /** Text: a regular expression the value must match. */
  pattern: string | null
  /** An integer may be cleared. Send an empty value. Empty means no cap for ai_monthly_budget_micro_usd. */
  nullable: boolean
}

export interface AdminSettingPayload {
  setting: AdminSetting | null
  userErrors: Array<UserError>
}

export type AdminSettingType = 'BOOLEAN' | 'INTEGER' | 'STRING'

/** Bytes are a decimal string. Files are those stored: uploaded, processing, ready or quarantined. */
export interface AdminStorageMetrics {
  bytes: string
  files: number
}

/** People. `active` is distinct accounts with a session that is not revoked and not expired. */
export interface AdminUserMetrics {
  total: number
  newLast7Days: number
  newLast30Days: number
  active: number
}

export interface AdminVerificationMetrics {
  /** Pending college-ID reviews. */
  studentIdQueue: number
  /** Pending verification requests of every purpose, including the college-ID queue. */
  pendingRequests: number
  /** Domains waiting for a decision (ACADEMIC_QUEUED or NEEDS_REVIEW). */
  domainReviews: number
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
  /** True only from signUp, when this email already belongs to an account with no password (for example one created with
   * Google). A link was emailed; verifyEmail with that token attaches the password and does not sign anyone in. No
   * session is returned, and signIn with the new password fails until the link is used. False for every other result,
   * including a normal sign-up and "an account already exists, sign in instead". */
  emailLinkPending: boolean
}

/** Whether Google sign-in can run. The Firebase project id is an environment variable; the switch is AppSetting google_sign_in (ADR-0100). */
export interface AuthSettings {
  /** FIREBASE_PROJECT_ID is set. The id itself is not returned. */
  googleConfigured: boolean
  /** Platform-admin switch (AppSetting google_sign_in, default on). Google is offered only when this is true and googleConfigured is true. */
  googleEnabled: boolean
}

export interface AuthSettingsPayload {
  settings: AuthSettings | null
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

export interface CreateAdminPlanInput {
  /** 2–32 characters: A–Z, digits and underscores, starting with a letter. Stored uppercase. */
  code: string
  name: string
  /** Minor units, 0 to 2000000000. */
  priceMinor: number
  /** ISO 4217, three letters. */
  currency: string
  interval: PlanInterval
  features?: Array<string> | null
  active?: boolean | null
  /** Replaces nothing: these are the plan's limits. Empty means unlimited everywhere. */
  entitlements?: Array<AdminPlanEntitlementInput> | null
}

export interface CreateStudentIdUploadInput {
  /** Shown to the reviewing admin; never part of the storage key */
  fileName: string
  /** image/jpeg, image/png, image/webp or application/pdf */
  mimeType: string
  /** At most 5 MB (5242880) */
  sizeBytes: number
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
export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL' | 'UNAVAILABLE' | 'UNDER_MINIMUM_AGE'

/** A public identifier a teacher claims, and how to prove it is theirs (ADR-0077) */
export interface ExternalIdentity {
  id: string
  kind: ExternalIdentityKind
  /** A GitHub login, or a page's address */
  value: string
  /** What to put where it proves the identifier is the teacher's */
  code: string
  /** Where to put it, in words */
  instructions: string
  /** Proven now; cleared when a monthly re-check no longer finds the proof */
  verified: boolean
  checkedAt: Date | null
  /** When its public data was last imported */
  fetchedAt: Date | null
  /** Why the last check or import did not work */
  lastError: string | null
}

export interface ExternalIdentityIdInput {
  identityId: string
}

export type ExternalIdentityKind = 'GITHUB' | 'WEBSITE' | 'ORCID' | 'OPENALEX'

export interface ExternalIdentityPayload {
  identity: ExternalIdentity | null
  userErrors: Array<UserError>
}

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

export type LimitKey = 'STORAGE_BYTES' | 'AI_TOKENS_DAILY' | 'PDF_PAGES_MONTHLY' | 'GROUPS_OWNED' | 'GROUP_MEMBERS' | 'CLASSROOMS_OWNED' | 'CLASSROOM_MEMBERS' | 'PROJECT_WORKSPACES' | 'EXPORTS_DAILY' | 'IMPORTS_DAILY' | 'ORG_SEATS' | 'NOTES_OWNED' | 'AI_REQUESTS_DAILY'

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

export interface MutationRequestAccountDeletionArgs {
  input: RequestAccountDeletionInput
}

export interface MutationUpdateAdminSettingArgs {
  input: UpdateAdminSettingInput
}

export interface MutationResetAdminSettingArgs {
  key: string
}

export interface MutationCreateAdminPlanArgs {
  input: CreateAdminPlanInput
}

export interface MutationUpdateAdminPlanArgs {
  input: UpdateAdminPlanInput
}

export interface MutationDeleteAdminPlanArgs {
  id: string
}

export interface MutationCreateStudentIdUploadIntentArgs {
  input: CreateStudentIdUploadInput
}

export interface MutationSubmitStudentIdVerificationArgs {
  input: SubmitStudentIdVerificationInput
}

export interface MutationWithdrawStudentIdVerificationArgs {
  requestId: string
}

export interface MutationReviewStudentIdVerificationArgs {
  input: ReviewStudentIdVerificationInput
}

export interface MutationSetStudentIdVerificationEnabledArgs {
  enabled: boolean
}

export interface MutationUpdateProfileArgs {
  input: UpdateProfileInput
}

export interface MutationSetGoogleSignInEnabledArgs {
  input: SetGoogleSignInEnabledInput
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

export interface MutationAddExternalIdentityArgs {
  input: AddExternalIdentityInput
}

export interface MutationCheckExternalIdentityArgs {
  input: ExternalIdentityIdInput
}

export interface MutationRemoveExternalIdentityArgs {
  input: ExternalIdentityIdInput
}

export interface MutationPublishTeacherSkillsArgs {
  input: TeacherSkillIdsInput
}

export interface MutationDiscardTeacherSkillsArgs {
  input: TeacherSkillIdsInput
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

export interface MyPlan {
  plan: PublicPlan
  usage: Array<PlanUsage>
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

export type PlanInterval = 'NONE' | 'MONTH' | 'YEAR'

/** One limit on a plan. `limit` is a decimal string, or null when the plan does not cap it. */
export interface PlanLimit {
  key: LimitKey
  /** Words for the limit, such as "AI asks a day". */
  label: string
  limit: string | null
}

/** How much of one limit the signed-in person has used. `resetsAt` is null for a standing cap. */
export interface PlanUsage {
  key: LimitKey
  label: string
  used: string
  /** Null when the plan does not cap this. */
  limit: string | null
  /** When a daily or monthly counter goes back to zero. Null for a standing cap. */
  resetsAt: Date | null
}

export interface ProfilePayload {
  profile: StudentProfile | null
  userErrors: Array<UserError>
}

/** A plan as a person sees it: price, features and the limits for their role.
 * `priceMinor` is minor currency units. Showing a price does not charge anyone. */
export interface PublicPlan {
  id: string
  code: string
  name: string
  priceMinor: number
  currency: string
  interval: PlanInterval
  features: Array<string>
  /** Limits for the viewer's role. Signed out, these are the student limits. */
  limits: Array<PlanLimit>
  /** True when this is the signed-in viewer's plan. False for every plan when nobody is signed in. */
  current: boolean
}

export interface QueryAdminMetricsArgs {
  from?: Date | null
  to?: Date | null
}

export interface QueryStudentIdVerificationQueueArgs {
  first?: number | null
  after?: string | null
}

export interface QueryStudentIdCardUrlArgs {
  requestId: string
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

export interface RequestAccountDeletionInput {
  /** The account's password; required when the account has one */
  password?: string | null
  /** The word DELETE */
  confirm: string
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

export interface ReviewStudentIdVerificationInput {
  requestId: string
  approve: boolean
  /** Optional. Shown to the student when you reject. */
  reason?: string | null
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

export interface SetGoogleSignInEnabledInput {
  enabled: boolean
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

/** A way this account can sign in. EMAIL is a password; the others are linked provider identities (ADR-0100). */
export type SignInMethod = 'EMAIL' | 'GOOGLE' | 'GITHUB' | 'LINKEDIN'

/** Which sign-in methods this deployment offers. Read this before drawing the buttons. */
export interface SignInOptions {
  emailPassword: boolean
  /** False when FIREBASE_PROJECT_ID is unset, or a platform admin has turned Google sign-in off */
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

/** Skills import for the viewer (ADR-0077) */
export interface SkillsImport {
  /** Whether the viewer may import: a verified teacher, not suspended */
  allowed: boolean
  /** The kinds of identifier this server can read */
  sources: Array<ExternalIdentityKind>
  identities: Array<ExternalIdentity>
}

/** A short-lived upload of one college ID card. PUT the bytes to uploadUrl with exactly these headers within 10 minutes, then call submitStudentIdVerification. Do not call completeUpload. */
export interface StudentIdUpload {
  fileId: string
  uploadUrl: string
  uploadHeaders: Array<StudentIdUploadHeader>
  expiresAt: Date
}

export interface StudentIdUploadHeader {
  name: string
  value: string
}

export interface StudentIdUploadPayload {
  upload: StudentIdUpload | null
  userErrors: Array<UserError>
}

export interface StudentIdVerificationPayload {
  request: StudentIdVerificationRequest | null
  userErrors: Array<UserError>
}

/** The student's own view of a college-ID request. `card` is null except for a platform admin, and null once the card has been deleted. */
export interface StudentIdVerificationRequest {
  id: string
  status: VerificationRequestStatus
  message: string | null
  createdAt: Date
  decidedAt: Date | null
  reason: string | null
  requester: User
  card: VerificationDocument | null
}

/** Platform admins. `updatedAt` is null until someone changes the switch. */
export interface StudentIdVerificationSettings {
  enabled: boolean
  updatedAt: Date | null
}

/** Department and year are shown to others only if showOnProfile; interests stay private */
export interface StudentProfile {
  department: string | null
  yearOfStudy: YearOfStudy | null
  /** Viewer only: the topics they chose */
  interestTopicIds: Array<string> | null
  /** Viewer only: the topics they chose, for Community's For You (ADR-0076); null for a topic that is gone */
  interests: Array<Topic | null> | null
  showOnProfile: boolean
}

export interface SubmitStudentIdVerificationInput {
  /** The fileId from createStudentIdUploadIntent, after the PUT */
  fileId: string
  message?: string | null
}

export interface TeacherProfile {
  headline: string | null
  bio: string | null
  /** Published items in the teacher's order; an imported one only while its identifier is proven */
  skills: Array<TeacherSkill>
  /** The teacher only: imported items waiting for review, newest first; null for anyone else */
  drafts: Array<TeacherSkill> | null
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
  /** Where an imported item came from */
  sourceUrl: string | null
  /** When an imported item was last fetched */
  fetchedAt: Date | null
}

export interface TeacherSkillIdsInput {
  skillIds: Array<string>
}

export interface TeacherSkillInput {
  kind: TeacherSkillKind
  /** At most 120 characters */
  name: string
  /** At most 500 characters */
  detail?: string | null
}

export type TeacherSkillKind = 'SKILL' | 'QUALIFICATION' | 'EXPERIENCE' | 'PROJECT' | 'PUBLICATION'

export type TeacherSkillSource = 'MANUAL' | 'GITHUB' | 'WEBSITE' | 'ORCID' | 'OPENALEX'

/** Where the viewer stands as a teacher (ADR-0073) */
export type TeacherStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'DECLINED'

/** A topic of notes, resolved by notes */
export interface Topic {
  id: string
}

export interface UpdateAdminPlanInput {
  id: string
  name?: string | null
  priceMinor?: number | null
  currency?: string | null
  interval?: PlanInterval | null
  /** Replaces the whole feature list, including with an empty list. */
  features?: Array<string> | null
  active?: boolean | null
  /** Replaces the whole limit list, including with an empty list. Omit to leave the limits. */
  entitlements?: Array<AdminPlanEntitlementInput> | null
}

export interface UpdateAdminSettingInput {
  key: string
  /** The same form as AdminSetting.value. */
  value: string
}

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
  /** Viewer only: when the account will be deleted, if its owner asked (ADR-0088) */
  deletionScheduledFor: Date | null
  /** The viewer's own profile; for others only when they show it */
  profile?: StudentProfile | null
  /** Viewer only */
  limits?: Array<Limit> | null
  /** Viewer only: data from the old learnvianotes.in site (ADR-0023) */
  legacyImport?: LegacyImport | null
  /** Viewer only (ADR-0100): ways this account can sign in. Null for anyone else, so account settings can list them. */
  signInMethods?: Array<SignInMethod> | null
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
  /** True when the proof is one college ID card (ADR-0099). Deleted when the request is decided or withdrawn. */
  collegeIdCard: boolean
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

// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

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

/** Fixed error vocabulary (§6.2) */
export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL'

export type GlobalRole = 'STUDENT' | 'TEACHER' | 'PLATFORM_ADMIN'

export interface Institution {
  name: string
  verified: boolean
}

export type InstitutionalEmailStatus = 'NONE' | 'CODE_SENT' | 'CONFIRMED' | 'PENDING_REVIEW'

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

export interface RefreshSessionInput {
  /** Mobile only; web sends the cookie */
  refreshToken?: string | null
}

export interface RequestPasswordResetInput {
  email: string
}

export interface ResetPasswordInput {
  token: string
  password: string
}

export interface Session {
  /** 15-minute RS256 JWT. Web keeps it in memory; mobile in expo-secure-store. */
  accessToken: string
  accessTokenExpiresAt: Date
  /** Mobile only (header X-LVN-Client: mobile). Web receives it as an HttpOnly cookie and this field is null. */
  refreshToken: string | null
  user: User
}

export interface SetInstitutionalEmailInput {
  email: string
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
  /** Viewer only (ADR-0017): the confirmed address, or the one waiting for its code */
  institutionalEmail: string | null
  /** Viewer only */
  institutionalEmailStatus: InstitutionalEmailStatus | null
  /** The confirmed college or organisation */
  institution: Institution | null
  /** Viewer only: a minor without verified consent (§15.2) — no public publishing, no DMs */
  restrictedMinor: boolean | null
}

/** An expected failure of a mutation; `field` is the dotted input path, e.g. ["input", "email"] */
export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
}

export type VerificationMethod = 'INSTITUTIONAL_EMAIL' | 'TEACHER' | 'DOCUMENTS'

export interface VerifyEmailInput {
  token: string
}

export interface VerifyInstitutionalEmailInput {
  code: string
}

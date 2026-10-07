// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.
/* eslint-disable */

export type GlobalRole = 'STUDENT' | 'TEACHER' | 'PLATFORM_ADMIN'

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
}

export type VerificationMethod = 'INSTITUTIONAL_EMAIL' | 'TEACHER' | 'DOCUMENTS'

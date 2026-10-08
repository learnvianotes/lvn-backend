// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

export interface CreateUploadIntentInput {
  /** Shown to people; never part of the storage key */
  fileName: string
  mimeType: string
  sizeBytes: number
  purpose: FilePurpose
  parentId?: string | null
}

/** Fixed error vocabulary (§6.2) */
export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL'

/** What an upload is for. Phase 1 accepts AVATAR and VERIFICATION_DOCUMENT; note media arrives with notes (Phase 2). */
export type FilePurpose = 'ATTACHMENT' | 'COVER' | 'VOICE_NOTE' | 'AVATAR' | 'IMPORT' | 'EXPORT' | 'VERIFICATION_DOCUMENT'

export interface MutationCreateUploadIntentArgs {
  input: CreateUploadIntentInput
}

export interface MutationCompleteUploadArgs {
  fileId: string
}

export interface OkPayload {
  ok: boolean
  userErrors: Array<UserError>
}

export interface UploadHeader {
  name: string
  value: string
}

/** Upload the bytes with PUT to uploadUrl and exactly these headers within 10 minutes, then call completeUpload. */
export interface UploadIntent {
  fileId: string
  uploadUrl: string
  uploadHeaders: Array<UploadHeader>
  expiresAt: Date
}

export interface UploadIntentPayload {
  intent: UploadIntent | null
  userErrors: Array<UserError>
}

export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
}

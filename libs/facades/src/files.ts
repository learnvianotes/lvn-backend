/**
 * Files (§8) belong to the `notes` context (FileObject). Other contexts attach uploaded files to their own records,
 * obtain short-lived read URLs after their own permission check, and delete files they own the lifecycle of.
 */
export const FILES = Symbol('FILES')

export type FileParentKind = 'NOTE' | 'CARD' | 'GROUP_POST' | 'RESOURCE' | 'AVATAR' | 'VERIFICATION_REQUEST' | 'IMPORT_JOB' | 'DATA_EXPORT'
export type FilePurposeKind = 'ATTACHMENT' | 'COVER' | 'VOICE_NOTE' | 'AVATAR' | 'IMPORT' | 'EXPORT' | 'VERIFICATION_DOCUMENT'

export interface FileSummary {
  id: string
  ownerId: string
  purpose: FilePurposeKind
  originalFileName: string
  mimeType: string
  sizeBytes: number
  status: string
}

export interface Files {
  /**
   * Binds READY files the owner uploaded for `purpose` to a parent record. Throws VALIDATION if any file is missing,
   * not the owner's, not READY, of another purpose or already attached elsewhere.
   */
  attach(fileIds: string[], ownerId: string, purpose: FilePurposeKind, parent: { type: FileParentKind; id: string }): Promise<void>
  describe(fileIds: string[]): Promise<FileSummary[]>
  /** A read URL valid for 15 minutes. The caller has already decided the reader may see it. */
  readUrl(fileId: string): Promise<{ url: string; expiresAt: Date }>
  /** Deletes the bytes and marks the rows DELETED (§8.2: the row stays as a record). */
  delete(fileIds: string[]): Promise<void>
  /**
   * Stores a file the server made (a data export, ADR-0018) as READY, in the restricted bucket when asked; it is deleted
   * after `expiresAt`. Returns its id.
   */
  store(ownerId: string, file: { purpose: FilePurposeKind; parent: { type: FileParentKind; id: string }; fileName: string; mimeType: string; bytes: Uint8Array; restricted: boolean; expiresAt: Date | null }): Promise<string>
  /** Bytes a user's files take up, counted against STORAGE_BYTES (ADR-0024). */
  storageUsed(ownerId: string): Promise<bigint>
}

/**
 * Files (§8) belong to the `notes` context (FileObject). Other contexts attach uploaded files to their own records,
 * obtain short-lived read URLs after their own permission check, and delete files they own the lifecycle of.
 */
export const FILES = Symbol('FILES')

export type FileParentKind = 'NOTE' | 'CARD' | 'GROUP_POST' | 'RESOURCE' | 'AVATAR' | 'VERIFICATION_REQUEST' | 'IMPORT_JOB' | 'DATA_EXPORT' | 'GROUP'
export type FilePurposeKind = 'ATTACHMENT' | 'COVER' | 'VOICE_NOTE' | 'AVATAR' | 'IMPORT' | 'EXPORT' | 'VERIFICATION_DOCUMENT' | 'GROUP_PICTURE' | 'COLLEGE_ID'

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
  /**
   * A read URL valid for 15 minutes, or `ttlSeconds` when the caller needs a shorter link (a college ID card is 5
   * minutes, ADR-0099). The caller has already decided the reader may see it.
   */
  readUrl(fileId: string, opts?: { ttlSeconds?: number }): Promise<{ url: string; expiresAt: Date }>
  /**
   * A presigned PUT for one college ID card into the restricted bucket (ADR-0099). Not gated by UPLOADS_ENABLED and
   * not announced as FileReady, so the media pipeline does not make derivative copies. The caller has already checked
   * the admin setting, the actor and the rate limit.
   */
  createCollegeIdUpload(ownerId: string, input: { fileName: string; mimeType: string; sizeBytes: number }, ip?: string): Promise<{ fileId: string; uploadUrl: string; uploadHeaders: { name: string; value: string }[]; expiresAt: Date }>
  /**
   * Checks the college-ID bytes (they arrived, the size matches, the magic bytes match the declared type) and marks
   * that unused upload READY. Refuses anything that is not this owner's unused college-ID upload.
   */
  finalizeCollegeIdUpload(ownerId: string, fileId: string): Promise<void>
  /**
   * Writes a READY file's bytes to `toPath` (a worker's temp file, ADR-0062): its normalised `audio` or `medium` picture
   * when asked and made (ADR-0041), else the original. The caller has already decided the reader may see it.
   */
  download(fileId: string, toPath: string, variant?: 'audio' | 'medium'): Promise<{ mimeType: string }>
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

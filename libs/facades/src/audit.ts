/**
 * The audit log (§4.5): who changed visibility, shares, roles, memberships and moderation state — never content. Kept by
 * the `users` context (users.AuditLog); other contexts record through this facade.
 */
export const AUDIT = Symbol('AUDIT')

export type AuditJson = string | number | boolean | null | AuditJson[] | { [key: string]: AuditJson | undefined }

export interface AuditEntry {
  actorId: string | null
  /** The actor's email at the time. Filled from the account when omitted. */
  actorEmail?: string | null
  /** e.g. note.visibility, note.share, note.unshare */
  action: string
  targetType: string
  targetId?: string | null
  metadata?: { [key: string]: AuditJson | undefined }
  ip?: string | null
  userAgent?: string | null
}

export interface Audit {
  record(entry: AuditEntry): Promise<void>
}

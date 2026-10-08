/**
 * The audit log (§4.5): who changed visibility, shares, roles, memberships and moderation state — never content. Kept by
 * the `users` context (users.AuditLog); other contexts record through this facade.
 */
export const AUDIT = Symbol('AUDIT')

export interface AuditEntry {
  actorId: string | null
  /** e.g. note.visibility, note.share, note.unshare */
  action: string
  targetType: string
  targetId?: string | null
  metadata?: Record<string, string | number | boolean | null>
}

export interface Audit {
  record(entry: AuditEntry): Promise<void>
}

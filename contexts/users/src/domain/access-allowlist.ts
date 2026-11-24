import type { GlobalRole } from '@lvn/contracts/domain'

/**
 * The system publisher. It has no sign-in. Internal jobs use the account directly and do not pass the allowlist,
 * so removing this address cannot stop publishing.
 */
export const SYSTEM_PUBLISHER_EMAIL = 'publisher@learnvianotes.invalid'

export const INVITE_ONLY_MESSAGE = 'LearnViaNotes beta is invite-only. Ask an admin to add your email.'
/** Contract field path for a blocked sign-in or sign-up. */
export const INVITE_ONLY_FIELD = ['email']

export const ALLOWLIST_NOTE_MAX = 500

export const GUARD_SELF_REMOVE = "You can't remove your own access."
export const GUARD_SELF_DEMOTE = "You can't change your own role."
export const GUARD_LAST_ADMIN_REMOVE = "You can't remove the last platform admin."
export const GUARD_LAST_ADMIN_DEMOTE = "You can't change the role of the last platform admin."

const RANK: Record<GlobalRole, number> = { STUDENT: 0, TEACHER: 1, MANAGER: 2, PLATFORM_ADMIN: 3 }

export function normalizeAllowlistEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isSystemPublisher(email: string): boolean {
  return normalizeAllowlistEmail(email) === SYSTEM_PUBLISHER_EMAIL
}

export function roleRank(role: GlobalRole): number {
  return RANK[role] ?? 0
}

export interface AllowlistGuardInput {
  actorEmail: string
  actorRole: GlobalRole
  entryEmail: string
  entryRole: GlobalRole
  /** The role the entry will have. Null when this call does not change the role. */
  nextRole: GlobalRole | null
  accountRole: GlobalRole | null
  platformAdminEntries: number
  platformAdminAccounts: number
  removing: boolean
}

/** Self-removal, self-demotion, and the last platform admin. */
export function allowlistGuard(input: AllowlistGuardInput): { ok: true } | { ok: false; message: string } {
  const self = normalizeAllowlistEmail(input.actorEmail) === normalizeAllowlistEmail(input.entryEmail)
  if (input.removing && self) return { ok: false, message: GUARD_SELF_REMOVE }
  if (self && input.nextRole && roleRank(input.nextRole) < roleRank(input.actorRole)) {
    return { ok: false, message: GUARD_SELF_DEMOTE }
  }
  const dropsEntry = input.entryRole === 'PLATFORM_ADMIN' && (input.removing || (input.nextRole !== null && input.nextRole !== 'PLATFORM_ADMIN'))
  if (dropsEntry && input.platformAdminEntries <= 1) {
    return { ok: false, message: input.removing ? GUARD_LAST_ADMIN_REMOVE : GUARD_LAST_ADMIN_DEMOTE }
  }
  const dropsAccount = input.accountRole === 'PLATFORM_ADMIN' && (input.removing || (input.nextRole !== null && input.nextRole !== 'PLATFORM_ADMIN'))
  if (dropsAccount && input.platformAdminAccounts <= 1) {
    return { ok: false, message: input.removing ? GUARD_LAST_ADMIN_REMOVE : GUARD_LAST_ADMIN_DEMOTE }
  }
  return { ok: true }
}

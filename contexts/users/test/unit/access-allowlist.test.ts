import { GlobalRole } from '@lvn/contracts/domain'
import {
  ALLOWLIST_NOTE_MAX,
  allowlistGuard,
  GUARD_LAST_ADMIN_DEMOTE,
  GUARD_LAST_ADMIN_REMOVE,
  GUARD_SELF_DEMOTE,
  GUARD_SELF_REMOVE,
  isSystemPublisher,
  normalizeAllowlistEmail,
  SYSTEM_PUBLISHER_EMAIL,
  type AllowlistGuardInput,
} from '../../src/domain/access-allowlist'

const base = (over: Partial<AllowlistGuardInput> = {}): AllowlistGuardInput => ({
  actorEmail: 'admin@example.com',
  actorRole: GlobalRole.PLATFORM_ADMIN,
  entryEmail: 'other@example.com',
  entryRole: GlobalRole.STUDENT,
  nextRole: GlobalRole.TEACHER,
  accountRole: GlobalRole.STUDENT,
  platformAdminEntries: 2,
  platformAdminAccounts: 2,
  removing: false,
  ...over,
})

describe('allowlist email', () => {
  it('matches case-insensitively and recognises the system publisher', () => {
    expect(normalizeAllowlistEmail('  Person@Example.com ')).toBe('person@example.com')
    expect(isSystemPublisher('Publisher@LearnViaNotes.invalid')).toBe(true)
    expect(isSystemPublisher(SYSTEM_PUBLISHER_EMAIL)).toBe(true)
    expect(isSystemPublisher('other@learnvianotes.invalid')).toBe(false)
    expect(ALLOWLIST_NOTE_MAX).toBe(500)
  })
})

describe('allowlist guards', () => {
  it('lets an admin change someone else and edit their own note', () => {
    expect(allowlistGuard(base()).ok).toBe(true)
    expect(allowlistGuard(base({ entryEmail: 'Admin@Example.com', nextRole: null, removing: false })).ok).toBe(true)
  })

  it('refuses removing or demoting yourself', () => {
    expect(allowlistGuard(base({ entryEmail: 'ADMIN@example.com', removing: true }))).toEqual({ ok: false, message: GUARD_SELF_REMOVE })
    expect(allowlistGuard(base({ entryEmail: 'admin@example.com', entryRole: GlobalRole.PLATFORM_ADMIN, nextRole: GlobalRole.TEACHER, accountRole: GlobalRole.PLATFORM_ADMIN, platformAdminEntries: 2, platformAdminAccounts: 2 }))).toEqual({ ok: false, message: GUARD_SELF_DEMOTE })
  })

  it('refuses removing or demoting the last platform admin entry or account', () => {
    expect(allowlistGuard(base({
      entryRole: GlobalRole.PLATFORM_ADMIN,
      accountRole: GlobalRole.PLATFORM_ADMIN,
      nextRole: null,
      removing: true,
      platformAdminEntries: 1,
      platformAdminAccounts: 2,
    }))).toEqual({ ok: false, message: GUARD_LAST_ADMIN_REMOVE })
    expect(allowlistGuard(base({
      entryRole: GlobalRole.STUDENT,
      accountRole: GlobalRole.PLATFORM_ADMIN,
      nextRole: GlobalRole.TEACHER,
      platformAdminEntries: 2,
      platformAdminAccounts: 1,
    }))).toEqual({ ok: false, message: GUARD_LAST_ADMIN_DEMOTE })
    expect(allowlistGuard(base({
      entryRole: GlobalRole.PLATFORM_ADMIN,
      nextRole: GlobalRole.STUDENT,
      accountRole: null,
      platformAdminEntries: 1,
      platformAdminAccounts: 0,
    }))).toEqual({ ok: false, message: GUARD_LAST_ADMIN_DEMOTE })
  })

  it('allows demoting an admin when another platform admin remains', () => {
    expect(allowlistGuard(base({
      entryRole: GlobalRole.PLATFORM_ADMIN,
      accountRole: GlobalRole.PLATFORM_ADMIN,
      nextRole: GlobalRole.TEACHER,
      platformAdminEntries: 2,
      platformAdminAccounts: 2,
    })).ok).toBe(true)
  })
})

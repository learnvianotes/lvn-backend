import { Injectable } from '@nestjs/common'
import type { People, Person, SearchProfile } from '@lvn-backend/facades'
import { $Enums, PrismaService } from '@lvn-backend/prisma-base'
import { methodsFromConsentRows } from '../domain/guardian-consent'
import { ageOf, dayReachingAge, isRestrictedMinor } from '../domain/rules'
import { AGE_FIELDS, atLeastAge, RESTRICTION_CONSENT_SELECT } from './age'
import type { SignInMethod, User } from '../graphql/schema.types'
import { InstitutionalEmailService } from './institutional-email.service'
import { PlatformSettingsStore } from './platform-settings.store'
import { deletionDate, graceDaysForAge } from './account-deletion.service'

/** Age-blocked and admin-blocked accounts are not public and cannot be found by handle or email. */
const PUBLIC_ACCOUNT = { notIn: [$Enums.AccountStatus.AGE_BLOCKED, $Enums.AccountStatus.BLOCKED] }

/** Platform admins never need institution verification. Everyone else does until verifiedAt is set. */
function accountNeedsVerification(globalRole: string, verifiedAt: Date | null): boolean {
  return globalRole !== 'PLATFORM_ADMIN' && verifiedAt === null
}

@Injectable()
export class UsersService implements People {
  constructor(
    private readonly db: PrismaService,
    private readonly institutional: InstitutionalEmailService,
    private readonly settings: PlatformSettingsStore,
  ) {}

  /** People facade: the account a handle or an email names (exact, case-insensitive), never a deleted one. */
  async find(handleOrEmail: string): Promise<Person | null> {
    const q = handleOrEmail.trim().replace(/^@/, '')
    if (!q || q.length > 254) return null
    const u = await this.db.user.findFirst({
      where: { deletedAt: null, accountStatus: PUBLIC_ACCOUNT, OR: [{ handle: { equals: q, mode: 'insensitive' } }, { email: q }] },
      select: { id: true, handle: true, displayName: true, globalRole: true },
    })
    return u ? { id: u.id, handle: u.handle, displayName: u.displayName, globalRole: u.globalRole } : null
  }

  /**
   * People facade, for search (P2e): handles starting with, or names containing, the query. Only people known to be
   * past the digital-consent age are listed — younger people are never discoverable by strangers (§15.2). The age is
   * ADR-0104's: the date of birth, else the declared age counted forward.
   */
  async search(query: string, limit: number, viewerId?: string | null): Promise<Person[]> {
    const q = query.trim().replace(/^@/, '')
    if (q.length < 2) return []
    const hidden = viewerId ? await this.blockedIds(viewerId) : []
    const rows = await this.db.user.findMany({
      where: {
        deletedAt: null,
        accountStatus: PUBLIC_ACCOUNT,
        ...(hidden.length ? { id: { notIn: hidden } } : {}),
        AND: [
          { OR: atLeastAge(this.settings.consentAge()) },
          { OR: [{ handle: { startsWith: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] },
        ],
      },
      select: { id: true, handle: true, displayName: true, globalRole: true },
      orderBy: [{ displayName: 'asc' }],
      take: Math.min(limit, 20),
    })
    return rows.map((u) => ({ id: u.id, handle: u.handle, displayName: u.displayName, globalRole: u.globalRole }))
  }

  /** People facade (ADR-0043): blocked by or blocking `userId`, in either direction. */
  async blockedIds(userId: string): Promise<string[]> {
    const rows = await this.db.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } })
    return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))]
  }

  /** People facade (ADR-0016): either blocked the other. */
  async blockedBetween(a: string, b: string): Promise<boolean> {
    return (await this.db.block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) > 0
  }

  /** People facade (ADR-0044): the teachers `userId` is connected with. */
  async connectionIds(userId: string): Promise<string[]> {
    const rows = await this.db.connection.findMany({ where: { OR: [{ userLowId: userId }, { userHighId: userId }] }, select: { userLowId: true, userHighId: true } })
    return rows.map((r) => (r.userLowId === userId ? r.userHighId : r.userLowId))
  }

  /** People facade (ADR-0044). */
  async connected(a: string, b: string): Promise<boolean> {
    return (await this.db.connection.count({ where: a < b ? { userLowId: a, userHighId: b } : { userLowId: b, userHighId: a } })) > 0
  }

  /** People facade (ADR-0050): display names for push text and emails. */
  async namesOf(ids: string[]): Promise<Record<string, string>> {
    if (!ids.length) return {}
    // A deleted account's name is its tombstone's, "Deleted user" (ADR-0088).
    const rows = await this.db.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, displayName: true } })
    return Object.fromEntries(rows.map((r) => [r.id, r.displayName]))
  }

  /** People facade (ADR-0050): where communication writes to a person. */
  async contactOf(userId: string): Promise<{ email: string; displayName: string; restrictedMinor: boolean } | null> {
    const u = await this.db.user.findFirst({ where: { id: userId, deletedAt: null, accountStatus: PUBLIC_ACCOUNT }, select: { email: true, displayName: true, ...AGE_FIELDS, ...RESTRICTION_CONSENT_SELECT } })
    if (!u) return null
    return { email: u.email, displayName: u.displayName, restrictedMinor: isRestrictedMinor(u, this.settings.consentAge(), methodsFromConsentRows(u), new Date(), this.settings.verificationSettings()) }
  }

  /** People facade (ADR-0069): when the account was made; null for deleted accounts. */
  async joinedAt(userId: string): Promise<Date | null> {
    return (await this.db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { createdAt: true } }))?.createdAt ?? null
  }

  /** People facade (ADR-0049): who the person follows, most recent first. */
  async followingIds(userId: string): Promise<string[]> {
    return (await this.db.follow.findMany({ where: { followerId: userId }, orderBy: { createdAt: 'desc' }, select: { followeeId: true }, take: 2000 })).map((f) => f.followeeId)
  }

  /** People facade (ADR-0071): the notes topics on the person's study profile, for recommendations. */
  async interestTopicIds(userId: string): Promise<string[]> {
    return (await this.db.studentProfile.findUnique({ where: { userId }, select: { interestTopicIds: true } }))?.interestTopicIds ?? []
  }

  /** People facade (ADR-0016, ADR-0047): the first restricts the second. */
  async restricts(restricterId: string, restrictedId: string): Promise<boolean> {
    return (await this.db.restriction.count({ where: { restricterId, restrictedId } })) > 0
  }

  /**
   * People facade (ADR-0055): what people search indexes; `adultFrom` instead of the date of birth or declared age
   * (ADR-0104). Accounts with no known age are left out.
   */
  async searchProfiles(ids: string[]): Promise<SearchProfile[]> {
    if (!ids.length) return []
    const consentAge = this.settings.consentAge()
    const rows = await this.db.user.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        accountStatus: PUBLIC_ACCOUNT,
        OR: [{ dateOfBirth: { not: null } }, { declaredAge: { not: null }, ageDeclaredAt: { not: null } }],
      },
      select: { id: true, handle: true, displayName: true, globalRole: true, ...AGE_FIELDS, teacherProfile: { select: { headline: true, bio: true } } },
    })
    return rows.flatMap((u) => {
      const adultFrom = dayReachingAge(u, consentAge)
      if (!adultFrom) return []
      return [{ id: u.id, handle: u.handle, displayName: u.displayName, globalRole: u.globalRole, headline: u.teacherProfile?.headline ?? null, bio: u.teacherProfile?.bio ?? null, adultFrom }]
    })
  }

  /** People facade (ADR-0055): every account id, in pages, for re-indexing. */
  async personIdsAfter(after: string | null, take: number): Promise<string[]> {
    const rows = await this.db.user.findMany({ where: after ? { id: { gt: after } } : {}, select: { id: true }, orderBy: { id: 'asc' }, take })
    return rows.map((r) => r.id)
  }

  /** Anyone's view of a user: no email, institutional address, verification details or age signal. */
  async publicProfile(userId: string): Promise<User | null> {
    const u = await this.db.user.findFirst({ where: { id: userId, deletedAt: null } })
    if (!u || u.accountStatus === 'AGE_BLOCKED' || u.accountStatus === 'BLOCKED') return null
    const institutional = await this.institutional.statusOf(userId)
    return {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      email: null,
      emailVerified: u.emailVerifiedAt !== null,
      registrationComplete: u.registrationCompletedAt !== null,
      verified: u.verifiedAt !== null,
      viewerNeedsVerification: null,
      verificationMethod: null,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      institutionalEmail: null,
      institutionalEmailStatus: null,
      institution: institutional.institution,
      restrictedMinor: null,
      deletionScheduledFor: null,
      analyticsOptOut: null,
    }
  }

  /**
   * Anyone's view of several users at once (other contexts' references to users, batched per request): the same
   * fields as publicProfile, in two queries. Unknown ids are missing from the result. A deleted account answers as its
   * tombstone, "Deleted user" (ADR-0088), so what it made public keeps an author without a name.
   */
  async publicProfiles(userIds: readonly string[]): Promise<User[]> {
    const ids = [...new Set(userIds)]
    const [users, confirmed] = await Promise.all([
      this.db.user.findMany({ where: { id: { in: ids } } }),
      this.db.institutionalEmail.findMany({
        where: { userId: { in: ids }, replacedAt: null, verifiedAt: { not: null }, organizationId: { not: null } },
        include: { organization: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const institutionOf = new Map<string, string>()
    for (const row of confirmed) if (row.organization && !institutionOf.has(row.userId)) institutionOf.set(row.userId, row.organization.name)
    return users.filter((u) => u.deletedAt !== null || (u.accountStatus !== 'AGE_BLOCKED' && u.accountStatus !== 'BLOCKED')).map((u) => ({
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      email: null,
      emailVerified: u.emailVerifiedAt !== null,
      registrationComplete: u.registrationCompletedAt !== null,
      verified: u.verifiedAt !== null,
      viewerNeedsVerification: null,
      verificationMethod: null,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      institutionalEmail: null,
      institutionalEmailStatus: null,
      institution: institutionOf.has(u.id) ? { name: institutionOf.get(u.id)!, verified: true } : null,
      restrictedMinor: null,
      deletionScheduledFor: null,
      analyticsOptOut: null,
    }))
  }

  /** Viewer only (ADR-0100): EMAIL when a password is set, then each linked provider. Empty if the account is gone. */
  async signInMethods(userId: string): Promise<SignInMethod[]> {
    const u = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { passwordHash: true, oauthAccounts: { select: { provider: true } } },
    })
    if (!u) return []
    const methods: SignInMethod[] = []
    if (u.passwordHash) methods.push('EMAIL')
    for (const provider of ['GOOGLE', 'GITHUB', 'LINKEDIN'] as const) {
      if (u.oauthAccounts.some((a) => a.provider === provider)) methods.push(provider)
    }
    return methods
  }

  /** The viewer's own view of their account, viewer-only fields included; null if it was deleted meanwhile. */
  async viewerProfile(userId: string): Promise<User | null> {
    const u = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: RESTRICTION_CONSENT_SELECT,
    })
    if (!u || u.accountStatus === 'AGE_BLOCKED' || u.accountStatus === 'BLOCKED') return null
    const institutional = await this.institutional.statusOf(userId)
    return {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      email: u.email,
      emailVerified: u.emailVerifiedAt !== null,
      registrationComplete: u.registrationCompletedAt !== null,
      verified: u.verifiedAt !== null,
      viewerNeedsVerification: accountNeedsVerification(u.globalRole, u.verifiedAt),
      verificationMethod: u.verificationMethod,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      institutionalEmail: institutional.email,
      institutionalEmailStatus: institutional.status,
      institution: institutional.institution,
      restrictedMinor: isRestrictedMinor(u, this.settings.consentAge(), methodsFromConsentRows(u), new Date(), this.settings.verificationSettings()),
      deletionScheduledFor: deletionDate(u.deletionRequestedAt, graceDaysForAge(ageOf(u), this.settings.minorPurgeWindowDays())),
      analyticsOptOut: u.analyticsOptOut,
    }
  }
}

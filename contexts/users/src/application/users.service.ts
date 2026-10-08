import { Inject, Injectable } from '@nestjs/common'
import type { People, Person } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { isRestrictedMinor } from '../domain/rules'
import type { User } from '../graphql/schema.types'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { InstitutionalEmailService } from './institutional-email.service'

@Injectable()
export class UsersService implements People {
  constructor(
    private readonly db: PrismaService,
    private readonly institutional: InstitutionalEmailService,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** People facade: the account a handle or an email names (exact, case-insensitive), never a deleted one. */
  async find(handleOrEmail: string): Promise<Person | null> {
    const q = handleOrEmail.trim().replace(/^@/, '')
    if (!q || q.length > 254) return null
    const u = await this.db.user.findFirst({
      where: { deletedAt: null, OR: [{ handle: { equals: q, mode: 'insensitive' } }, { email: q }] },
      select: { id: true, handle: true, displayName: true, globalRole: true },
    })
    return u ? { id: u.id, handle: u.handle, displayName: u.displayName, globalRole: u.globalRole } : null
  }

  /**
   * People facade, for search (P2e): handles starting with, or names containing, the query. Only people known to be
   * past the digital-consent age are listed — younger people are never discoverable by strangers (§15.2).
   */
  async search(query: string, limit: number): Promise<Person[]> {
    const q = query.trim().replace(/^@/, '')
    if (q.length < 2) return []
    const adultsBornBy = new Date()
    adultsBornBy.setUTCFullYear(adultsBornBy.getUTCFullYear() - this.config.digitalConsentAge)
    const rows = await this.db.user.findMany({
      where: { deletedAt: null, dateOfBirth: { lte: adultsBornBy }, OR: [{ handle: { startsWith: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, handle: true, displayName: true, globalRole: true },
      orderBy: [{ displayName: 'asc' }],
      take: Math.min(limit, 20),
    })
    return rows.map((u) => ({ id: u.id, handle: u.handle, displayName: u.displayName, globalRole: u.globalRole }))
  }

  /** Anyone's view of a user: no email, institutional address, verification details or age signal. */
  async publicProfile(userId: string): Promise<User | null> {
    const u = await this.db.user.findFirst({ where: { id: userId, deletedAt: null } })
    if (!u) return null
    const institutional = await this.institutional.statusOf(userId)
    return {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      email: null,
      emailVerified: u.emailVerifiedAt !== null,
      registrationComplete: u.registrationCompletedAt !== null,
      verified: u.verifiedAt !== null,
      verificationMethod: null,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      institutionalEmail: null,
      institutionalEmailStatus: null,
      institution: institutional.institution,
      restrictedMinor: null,
    }
  }

  /**
   * Anyone's view of several users at once (other contexts' references to users, batched per request): the same
   * fields as publicProfile, in two queries. Deleted or unknown ids are missing from the result.
   */
  async publicProfiles(userIds: readonly string[]): Promise<User[]> {
    const ids = [...new Set(userIds)]
    const [users, confirmed] = await Promise.all([
      this.db.user.findMany({ where: { id: { in: ids }, deletedAt: null } }),
      this.db.institutionalEmail.findMany({
        where: { userId: { in: ids }, replacedAt: null, verifiedAt: { not: null }, organizationId: { not: null } },
        include: { organization: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const institutionOf = new Map<string, string>()
    for (const row of confirmed) if (row.organization && !institutionOf.has(row.userId)) institutionOf.set(row.userId, row.organization.name)
    return users.map((u) => ({
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      email: null,
      emailVerified: u.emailVerifiedAt !== null,
      registrationComplete: u.registrationCompletedAt !== null,
      verified: u.verifiedAt !== null,
      verificationMethod: null,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      institutionalEmail: null,
      institutionalEmailStatus: null,
      institution: institutionOf.has(u.id) ? { name: institutionOf.get(u.id)!, verified: true } : null,
      restrictedMinor: null,
    }))
  }

  /** The viewer's own view of their account, viewer-only fields included; null if it was deleted meanwhile. */
  async viewerProfile(userId: string): Promise<User | null> {
    const u = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { consents: { where: { kind: 'GUARDIAN' }, select: { id: true }, take: 1 } },
    })
    if (!u) return null
    const institutional = await this.institutional.statusOf(userId)
    return {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      email: u.email,
      emailVerified: u.emailVerifiedAt !== null,
      registrationComplete: u.registrationCompletedAt !== null,
      verified: u.verifiedAt !== null,
      verificationMethod: u.verificationMethod,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      institutionalEmail: institutional.email,
      institutionalEmailStatus: institutional.status,
      institution: institutional.institution,
      restrictedMinor: isRestrictedMinor(u.dateOfBirth, this.config.digitalConsentAge, u.consents.length > 0),
    }
  }
}

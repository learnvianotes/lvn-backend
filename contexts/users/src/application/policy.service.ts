import { Inject, Injectable } from '@nestjs/common'
import type { Actor, GlobalRole } from '@lvn/contracts/domain'
import type { Policy } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { isRestrictedMinor } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'

/**
 * The single source of Actors for `can()` (§6.1, ADR-0005): role, verification (ADR-0017, ADR-0019), the
 * restricted-minor rule (§15.2) and suspension (ADR-0053). Read from the database every time — permission inputs are
 * never cached (§6.3).
 */
@Injectable()
export class PolicyService implements Policy {
  constructor(
    private readonly db: PrismaService,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  async actor(userId: string): Promise<Actor | null> {
    const u = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, globalRole: true, verifiedAt: true, dateOfBirth: true, suspendedUntil: true, consents: { where: { kind: 'GUARDIAN' }, select: { id: true }, take: 1 } },
    })
    if (!u) return null
    return {
      id: u.id,
      globalRole: u.globalRole as GlobalRole,
      institutionVerified: u.verifiedAt !== null,
      restrictedMinor: isRestrictedMinor(u.dateOfBirth, this.config.digitalConsentAge, u.consents.length > 0),
      suspended: u.suspendedUntil !== null && u.suspendedUntil.getTime() > Date.now(),
    }
  }

  async suspend(userId: string, until: Date, reason: string): Promise<void> {
    await this.db.user.updateMany({ where: { id: userId, deletedAt: null }, data: { suspendedUntil: until, suspensionReason: reason } })
  }

  async lift(userId: string): Promise<void> {
    await this.db.user.updateMany({ where: { id: userId }, data: { suspendedUntil: null, suspensionReason: null } })
  }

  async suspension(userId: string): Promise<{ until: Date; reason: string | null } | null> {
    const u = await this.db.user.findUnique({ where: { id: userId }, select: { suspendedUntil: true, suspensionReason: true } })
    return u?.suspendedUntil && u.suspendedUntil.getTime() > Date.now() ? { until: u.suspendedUntil, reason: u.suspensionReason } : null
  }
}

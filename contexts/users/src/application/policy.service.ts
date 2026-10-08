import { Inject, Injectable } from '@nestjs/common'
import type { Actor, GlobalRole } from '@lvn/contracts/domain'
import type { Policy } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { isRestrictedMinor } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'

/**
 * The single source of Actors for `can()` (§6.1, ADR-0005): role, verification (ADR-0017, ADR-0019) and the
 * restricted-minor rule (§15.2). Read from the database every time — permission inputs are never cached (§6.3).
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
      select: { id: true, globalRole: true, verifiedAt: true, dateOfBirth: true, consents: { where: { kind: 'GUARDIAN' }, select: { id: true }, take: 1 } },
    })
    if (!u) return null
    return {
      id: u.id,
      globalRole: u.globalRole as GlobalRole,
      institutionVerified: u.verifiedAt !== null,
      restrictedMinor: isRestrictedMinor(u.dateOfBirth, this.config.digitalConsentAge, u.consents.length > 0),
    }
  }
}

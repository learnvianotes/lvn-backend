import { Injectable } from '@nestjs/common'
import { unverifiedGatesFromSetting, type Actor, type GlobalRole } from '@lvn/contracts/domain'
import type { Policy } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { methodsFromConsentRows } from '../domain/guardian-consent'
import { isRestrictedMinor } from '../domain/rules'
import { AGE_FIELDS, RESTRICTION_CONSENT_SELECT } from './age'
import { UNVERIFIED_GATED_ACTIONS_SETTING } from '../domain/setting-catalog'
import { PlatformSettingsStore } from './platform-settings.store'

/**
 * The single source of Actors for `can()` (§6.1, ADR-0005): role, verification (ADR-0017, ADR-0019), the
 * restricted-minor rule (§15.2) and suspension (ADR-0053). Read from the database every time — permission inputs are
 * never cached (§6.3).
 */
@Injectable()
export class PolicyService implements Policy {
  constructor(
    private readonly db: PrismaService,
    private readonly settings: PlatformSettingsStore,
  ) {}

  async actor(userId: string): Promise<Actor | null> {
    const u = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        globalRole: true,
        verifiedAt: true,
        ...AGE_FIELDS,
        suspendedUntil: true,
        accountStatus: true,
        ...RESTRICTION_CONSENT_SELECT,
        // A pending application to teach makes a teacher applicant (ADR-0073).
        verificationRequests: { where: { purpose: 'TEACHER_ROLE', status: 'PENDING' }, select: { id: true }, take: 1 },
      },
    })
    if (!u || u.accountStatus === 'AGE_BLOCKED' || u.accountStatus === 'BLOCKED') return null
    return {
      id: u.id,
      globalRole: u.globalRole as GlobalRole,
      // Stored flag only. PLATFORM_ADMIN skips every institution-verification gate inside can(), so a null
      // verifiedAt does not block an admin. Clients read viewer.viewerNeedsVerification for prompts.
      institutionVerified: u.verifiedAt !== null,
      // The age threshold is configuration, cached briefly (ADR-0101). The account itself is read every time.
      restrictedMinor: isRestrictedMinor(u, this.settings.consentAge(), methodsFromConsentRows(u)),
      // A dated suspension ends when its time is up, even before the row is rewritten to ACTIVE.
      suspended: u.accountStatus === 'SUSPENDED'
        ? u.suspendedUntil === null || u.suspendedUntil.getTime() > Date.now()
        : u.suspendedUntil !== null && u.suspendedUntil.getTime() > Date.now(),
      teacherApplicant: u.globalRole === 'STUDENT' && u.verificationRequests.length > 0,
      unverifiedGates: unverifiedGatesFromSetting(this.settings.string(UNVERIFIED_GATED_ACTIONS_SETTING, null)),
    }
  }

  async suspend(userId: string, until: Date, reason: string): Promise<void> {
    await this.db.user.updateMany({
      where: { id: userId, deletedAt: null, accountStatus: { notIn: ['AGE_BLOCKED', 'BLOCKED'] } },
      data: { suspendedUntil: until, suspensionReason: reason, accountStatus: 'SUSPENDED', statusReason: reason },
    })
  }

  async lift(userId: string): Promise<void> {
    await this.db.user.updateMany({
      where: { id: userId, accountStatus: 'SUSPENDED' },
      data: { suspendedUntil: null, suspensionReason: null, accountStatus: 'ACTIVE', statusReason: null },
    })
    await this.db.user.updateMany({ where: { id: userId, accountStatus: { not: 'SUSPENDED' } }, data: { suspendedUntil: null, suspensionReason: null } })
  }

  async suspension(userId: string): Promise<{ until: Date; reason: string | null } | null> {
    const u = await this.db.user.findUnique({ where: { id: userId }, select: { suspendedUntil: true, suspensionReason: true } })
    return u?.suspendedUntil && u.suspendedUntil.getTime() > Date.now() ? { until: u.suspendedUntil, reason: u.suspensionReason } : null
  }
}

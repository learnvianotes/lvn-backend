import { Inject, Injectable } from '@nestjs/common'
import { GlobalRole } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PrismaService } from '@lvn-backend/prisma-base'
import { domainAndParents } from '../domain/email-domains'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AppSettingsService } from './app-settings.service'
import { AuditService } from './audit.service'
import { PolicyService } from './policy.service'

/**
 * Platform-admin tools that the admin app will own later (§15.1, ADR-0017, ADR-0019): the institutional-domain review
 * queue and role grants. Every decision is audited.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly settings: AppSettingsService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** Whether Google sign-in can run here. The project id is an environment variable; the switch is `AppSetting`. */
  async authSettings(adminId: string): Promise<{ googleConfigured: boolean; googleEnabled: boolean }> {
    await this.assertAdmin(adminId)
    return { googleConfigured: !!this.config.firebaseProjectId, googleEnabled: await this.settings.googleSignInEnabled() }
  }

  /** Turns Google sign-in on or off without a deploy. Has no effect until FIREBASE_PROJECT_ID is set. */
  async setGoogleSignInEnabled(adminId: string, enabled: boolean): Promise<{ googleConfigured: boolean; googleEnabled: boolean }> {
    const googleEnabled = await this.settings.setGoogleSignInEnabled(adminId, enabled)
    return { googleConfigured: !!this.config.firebaseProjectId, googleEnabled }
  }

  async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (actor?.globalRole !== GlobalRole.PLATFORM_ADMIN) throw Errors.forbidden()
  }

  async domainReviews(adminId: string, status?: 'ACADEMIC_QUEUED' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED' | null) {
    await this.assertAdmin(adminId)
    return this.db.domainReview.findMany({ where: status ? { status } : { status: { in: ['ACADEMIC_QUEUED', 'NEEDS_REVIEW'] } }, orderBy: [{ requests: 'desc' }, { firstSeenAt: 'asc' }], take: 100 })
  }

  /**
   * Approving a domain verifies every account whose confirmed address is on it (or a sub-domain); rejecting leaves
   * those addresses confirmed but not verifying.
   */
  async decideDomain(adminId: string, rawDomain: string, approve: boolean): Promise<number> {
    await this.assertAdmin(adminId)
    const domain = rawDomain.trim().toLowerCase()
    const review = await this.db.domainReview.findUnique({ where: { domain } })
    if (!review) throw Errors.notFound('This domain is not waiting for review.')
    await this.db.domainReview.update({ where: { domain }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedAt: new Date(), decidedBy: adminId } })
    await this.audit.record({ actorId: adminId, action: approve ? 'domain.approved' : 'domain.rejected', targetType: 'DomainReview', metadata: { domain } })
    if (!approve) return 0

    const confirmed = await this.db.institutionalEmail.findMany({
      where: { verifiedAt: { not: null }, replacedAt: null, user: { verifiedAt: null, deletedAt: null } },
      select: { userId: true, domain: true },
    })
    const users = confirmed.filter((c) => domainAndParents(c.domain).includes(domain)).map((c) => c.userId)
    const now = new Date()
    for (const userId of users) {
      const { count } = await this.db.user.updateMany({ where: { id: userId, verifiedAt: null }, data: { verifiedAt: now, verificationMethod: 'INSTITUTIONAL_EMAIL' } })
      if (count) await this.events.publish('InstitutionVerified', { userId, method: 'INSTITUTIONAL_EMAIL' })
    }
    return users.length
  }

  /** TEACHER is granted by an organisation or by manual review (§5); a faculty email alone is not enough (ADR-0017). */
  async setGlobalRole(adminId: string, userId: string, role: GlobalRole): Promise<void> {
    await this.assertAdmin(adminId)
    if (adminId === userId) throw Errors.forbidden('Ask another platform admin to change your own role.')
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { globalRole: true } })
    if (!user) throw Errors.notFound('User not found.')
    if (user.globalRole === role) return
    await this.db.user.update({ where: { id: userId }, data: { globalRole: role } })
    await this.audit.record({ actorId: adminId, action: 'role.changed', targetType: 'User', targetId: userId, metadata: { from: user.globalRole, to: role } })
    await this.events.publish('RoleChanged', { userId, globalRole: role })
  }
}

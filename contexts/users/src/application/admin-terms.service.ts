import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { kAnonymous, TERMS_VERSION_SETTING, type TermsSource } from '../domain/terms'
import { PolicyService } from './policy.service'
import { TermsVersionProvider } from './terms-version.provider'

export interface AdminTermsStatusView {
  current: string
  source: TermsSource
  publishedVersions: string[]
  /** Null below the k-anonymity threshold (5). */
  acceptedCurrent: number | null
  acceptedOlder: number | null
  lastChange: { actorId: string | null; actorDisplayName: string | null; at: Date; previous: string | null } | null
}

/**
 * ADR-0103: the terms version in effect, where it comes from, and how many accounts have accepted it. Counts only:
 * accounts that are not deleted, by their latest Terms acceptance, the same rule as `viewer.termsAccepted`.
 */
@Injectable()
export class AdminTermsService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly terms: TermsVersionProvider,
  ) {}

  async status(adminId: string): Promise<AdminTermsStatusView> {
    await this.assertAdmin(adminId)
    // From the database, so a save in another API process shows at once.
    const resolved = await this.terms.resolveFresh()
    const [counts, lastChange] = await Promise.all([this.acceptance(resolved.version), this.lastChange()])
    return {
      current: resolved.version,
      source: resolved.source,
      publishedVersions: resolved.published,
      acceptedCurrent: kAnonymous(counts.current),
      acceptedOlder: kAnonymous(counts.older),
      lastChange,
    }
  }

  private async acceptance(version: string): Promise<{ current: number; older: number }> {
    const rows = await this.db.$queryRaw<{ current: number; older: number }[]>`
      SELECT COUNT(*) FILTER (WHERE latest.version = ${version})::int AS current,
             COUNT(*) FILTER (WHERE latest.version <> ${version})::int AS older
      FROM (
        SELECT DISTINCT ON (c."userId") c.version
        FROM users."ConsentRecord" c
        JOIN users."User" u ON u.id = c."userId"
        WHERE c.kind = 'TERMS' AND u."deletedAt" IS NULL
        ORDER BY c."userId", c."acceptedAt" DESC, c.id DESC
      ) latest`
    return { current: Number(rows[0]?.current ?? 0), older: Number(rows[0]?.older ?? 0) }
  }

  /** The latest save or reset of `terms_version` through the admin tools. */
  private async lastChange(): Promise<AdminTermsStatusView['lastChange']> {
    const row = await this.db.auditLog.findFirst({
      where: { targetType: 'AppSetting', action: { in: ['settings.updated', 'settings.reset'] }, metadata: { path: ['key'], equals: TERMS_VERSION_SETTING } },
      orderBy: { createdAt: 'desc' },
    })
    if (!row) return null
    const actor = row.actorId ? await this.db.user.findUnique({ where: { id: row.actorId }, select: { displayName: true, deletedAt: true } }) : null
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {}
    return {
      actorId: row.actorId,
      actorDisplayName: actor && !actor.deletedAt ? actor.displayName : null,
      at: row.createdAt,
      previous: typeof metadata.previous === 'string' ? metadata.previous : null,
    }
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden()
  }
}

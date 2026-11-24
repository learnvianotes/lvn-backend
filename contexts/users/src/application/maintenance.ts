import { Injectable } from '@nestjs/common'
import { AccountDeletionService } from './account-deletion.service'
import { AnalyticsService } from './analytics.service'
import { DailyMetricsService, type RollupReport } from './daily-metrics.service'
import { VerificationService } from './verification.service'

/** Scheduled housekeeping of the users context, run by apps/worker (daily). */
@Injectable()
export class UsersMaintenance {
  constructor(
    private readonly verification: VerificationService,
    private readonly deletion: AccountDeletionService,
    private readonly analytics: AnalyticsService,
    private readonly metrics: DailyMetricsService,
  ) {}

  /** Usage events older than 180 days, error events older than 90 days, and daily metrics older than 730 (ADR-0106). */
  async purgeAnalytics(now = new Date()): Promise<{ errors: number; usage: number; metrics: number }> {
    const [events, metrics] = await Promise.all([this.analytics.purge(now), this.metrics.purge(now)])
    return { ...events, metrics }
  }

  /** ADR-0106, nightly: the admin usage metrics of the `days` days before today (IST), recomputed and stored. */
  rollUpMetrics(days?: number, now = new Date()): Promise<RollupReport> {
    return this.metrics.rollUpRecent(days, now)
  }

  /** ADR-0106: roll up past days `fromDay` to `toDay` (YYYY-MM-DD, IST), e.g. after deploying the rollup. Re-runnable. */
  backfillMetrics(fromDay: string, toDay: string, onChunk?: (report: RollupReport) => void, now = new Date()): Promise<RollupReport> {
    return this.metrics.backfill(fromDay, toDay, now, onChunk)
  }

  /** ADR-0088: accounts past their 14 days are deleted; recent deletions are announced again. */
  deleteAccounts(now = new Date()): Promise<{ deleted: number; announced: number }> {
    return this.deletion.deleteDue(now)
  }

  /** ADR-0019: identity documents are deleted 30 days after the decision. A college ID card left stored after its decision is deleted on the same run (ADR-0099). Returns how many requests were purged. */
  purgeVerificationDocuments(now = new Date()): Promise<number> {
    return this.verification.purgeDecidedDocuments(now)
  }
}

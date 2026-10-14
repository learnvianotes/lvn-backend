import { Injectable } from '@nestjs/common'
import { AccountDeletionService } from './account-deletion.service'
import { VerificationService } from './verification.service'

/** Scheduled housekeeping of the users context, run by apps/worker (daily). */
@Injectable()
export class UsersMaintenance {
  constructor(
    private readonly verification: VerificationService,
    private readonly deletion: AccountDeletionService,
  ) {}

  /** ADR-0088: accounts past their 14 days are deleted; recent deletions are announced again. */
  deleteAccounts(now = new Date()): Promise<{ deleted: number; announced: number }> {
    return this.deletion.deleteDue(now)
  }

  /** ADR-0019: identity documents are deleted 30 days after the decision. Returns how many requests were purged. */
  purgeVerificationDocuments(now = new Date()): Promise<number> {
    return this.verification.purgeDecidedDocuments(now)
  }
}

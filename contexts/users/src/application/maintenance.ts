import { Injectable } from '@nestjs/common'
import { VerificationService } from './verification.service'

/** Scheduled housekeeping of the users context, run by apps/worker (daily). */
@Injectable()
export class UsersMaintenance {
  constructor(private readonly verification: VerificationService) {}

  /** ADR-0019: identity documents are deleted 30 days after the decision. Returns how many requests were purged. */
  purgeVerificationDocuments(now = new Date()): Promise<number> {
    return this.verification.purgeDecidedDocuments(now)
  }
}

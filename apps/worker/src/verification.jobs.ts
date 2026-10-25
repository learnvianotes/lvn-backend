import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { AiGateway } from '@lvn-backend/ai'
import { Queues } from '@lvn-backend/queue'
import { IdCardCheckService, USERS_ID_CHECK_QUEUE } from '@lvn-backend/users'

/**
 * Reads a college ID or proof document after the API enqueues it.
 * The model receives the file bytes and nothing about the account. Failures are logged by name only.
 */
@Injectable()
export class VerificationJobs implements OnApplicationBootstrap {
  private readonly log = new Logger('VerificationJobs')

  constructor(
    private readonly queues: Queues,
    private readonly checks: IdCardCheckService,
    private readonly gateway: AiGateway,
  ) {}

  onApplicationBootstrap(): void {
    this.queues.process(USERS_ID_CHECK_QUEUE, {
      check: async (data) => {
        const requestId = (data as { requestId: string }).requestId
        try {
          await this.checks.run(requestId, {
            extract: async (bytes) => this.gateway.extractIdCard(bytes.toString('base64')),
          })
        } catch (e) {
          this.log.warn(`id-card check failed for ${requestId}: ${(e as Error).name}`)
          throw e
        }
      },
    })
  }
}

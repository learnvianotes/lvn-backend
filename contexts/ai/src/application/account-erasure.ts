import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PrismaService } from '@lvn-backend/prisma-base'

/**
 * A deleted account's part of the ai context (ADR-0088): their AI results and answers go; usage rows lose the person
 * but keep their tokens, so the month's budget still adds up. A public note's study aids (no owner) are the
 * platform's and stay with the note. Idempotent.
 */
@Injectable()
export class AiAccountErasure implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  async erase(userId: string): Promise<void> {
    await this.db.$transaction([
      this.db.noteArtifact.deleteMany({ where: { ownerId: userId } }),
      this.db.aiAnswer.deleteMany({ where: { askerId: userId } }),
      this.db.aiUsage.updateMany({ where: { userId }, data: { userId: null } }),
    ])
  }
}

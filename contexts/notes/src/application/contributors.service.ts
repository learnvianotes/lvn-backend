import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PrismaService } from '@lvn-backend/prisma-base'

/**
 * Who a project workspace's showcase note credits (ADR-0048), kept from core's ProjectContributorsChanged: each event
 * carries the whole list for one note and workspace, so it replaces what was there.
 */
@Injectable()
export class ContributorsService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('ProjectContributorsChanged', async ({ payload }) => {
      const { noteId, groupId, contributors } = payload
      if (!(await this.db.note.count({ where: { id: noteId } }))) return
      await this.db.$transaction([
        this.db.projectContributor.deleteMany({ where: { noteId, groupId } }),
        this.db.projectContributor.createMany({ data: contributors.map((c) => ({ noteId, groupId, userId: c.userId, role: c.role })), skipDuplicates: true }),
      ])
    })
  }

  /** Mentors first, then the team, as stored. */
  async of(noteId: string) {
    return this.db.projectContributor.findMany({ where: { noteId }, orderBy: [{ role: 'desc' }, { userId: 'asc' }], take: 500 })
  }
}

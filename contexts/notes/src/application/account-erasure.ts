import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { FILES, type Files } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { AttachmentsService } from './attachments.service'

/**
 * A deleted account's part of the notes context (ADR-0088). Public, published notes stay: they are contributions,
 * now by "Deleted user" (out of folders, without tags). Every other note goes with its cards, versions, shares, links,
 * chunks and search documents (cascades and the search triggers). Folders, tags, shares with the person, sync answers,
 * imports, highlights, PDF conversions and read markers go, then files no note links to. Idempotent.
 */
@Injectable()
export class NotesAccountErasure implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly attachments: AttachmentsService,
    @Inject(FILES) private readonly files: Files,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  async erase(userId: string): Promise<void> {
    const kept = { visibility: 'PUBLIC' as const, publishedVersionId: { not: null } }
    await this.db.note.updateMany({ where: { ownerId: userId, ...kept }, data: { folderId: null } })
    await this.db.note.deleteMany({ where: { ownerId: userId, NOT: kept } })
    const imports = await this.db.noteImport.findMany({ where: { userId }, select: { fileId: true } })
    await this.db.$transaction([
      this.db.folder.deleteMany({ where: { ownerId: userId } }),
      this.db.tag.deleteMany({ where: { ownerId: userId } }),
      this.db.noteShare.deleteMany({ where: { userId } }),
      this.db.syncOpLog.deleteMany({ where: { userId } }),
      this.db.noteImport.deleteMany({ where: { userId } }),
      this.db.noteHighlight.deleteMany({ where: { createdById: userId } }),
      this.db.pdfConversion.deleteMany({ where: { userId } }),
      this.db.groupMemberRead.deleteMany({ where: { userId } }),
      this.db.classroomMemberRead.deleteMany({ where: { userId } }),
      this.db.projectContributor.deleteMany({ where: { userId } }),
    ])
    if (imports.length) await this.files.delete(imports.map((i) => i.fileId))
    await this.attachments.purgeUnlinked()
  }
}

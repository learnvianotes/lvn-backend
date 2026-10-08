import { Injectable } from '@nestjs/common'
import { NOTE_LIMITS } from '@lvn/contracts/validation'
import { PrismaService } from '@lvn-backend/prisma-base'
import { AttachmentsService } from './attachments.service'

/**
 * Nightly housekeeping of the notes context (§9.1 `housekeeping`), run by apps/worker. Both jobs are idempotent.
 */
@Injectable()
export class NotesMaintenance {
  constructor(
    private readonly db: PrismaService,
    private readonly attachments: AttachmentsService,
  ) {}

  /**
   * §4.3: public notes keep every published version; other notes keep their newest 50 versions. Conflict and
   * pre-restore copies count towards the 50 on every note. The version readers see is never removed.
   */
  async pruneVersions(): Promise<number> {
    return this.db.$executeRaw`
      DELETE FROM "notes"."NoteVersion" v
      USING (
        SELECT v2."id",
               row_number() OVER (PARTITION BY v2."noteId" ORDER BY v2."number" DESC) AS rank,
               n."visibility", n."publishedVersionId"
        FROM "notes"."NoteVersion" v2
        JOIN "notes"."Note" n ON n."id" = v2."noteId"
      ) ranked
      WHERE v."id" = ranked."id"
        AND ranked.rank > ${NOTE_LIMITS.versionsKept}
        AND v."id" IS DISTINCT FROM ranked."publishedVersionId"
        AND NOT (ranked."visibility" = 'PUBLIC' AND v."kind" = 'PUBLISHED')`
  }

  /**
   * §4.5: notes in the trash for 30 days are deleted for good, with their cards, versions, shares and links; then files
   * no note links to any more are deleted (§8.2).
   */
  async emptyTrash(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - NOTE_LIMITS.trashDays * 24 * 3600 * 1000)
    const { count } = await this.db.note.deleteMany({ where: { deletedAt: { lt: cutoff } } })
    await this.attachments.purgeUnlinked()
    return count
  }
}

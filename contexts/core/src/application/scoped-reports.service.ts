import { Inject, Injectable } from '@nestjs/common'
import { Action, can, type ReportEntityType, type ReportReason } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { POLICY, type Policy } from '@lvn-backend/facades'
import { ClassroomsService } from './classrooms.service'
import { CommentsService } from './comments.service'
import { GroupsService } from './groups.service'
import { ModerationService } from './moderation.service'
import { WorkspacesService } from './workspaces.service'

/**
 * Reports on comments, posts, announcements, doubts and groups (ADR-0051). Only what the reporter can see can be
 * reported, never their own, and the report goes to its scope's queue. Notes and accounts go to ModerationService.
 */
@Injectable()
export class ScopedReportsService {
  constructor(
    private readonly moderation: ModerationService,
    private readonly comments: CommentsService,
    private readonly groups: GroupsService,
    private readonly classes: ClassroomsService,
    private readonly workspaces: WorkspacesService,
    @Inject(POLICY) private readonly policy: Policy,
  ) {}

  async report(viewerId: string, input: { entityType: ReportEntityType; entityId: string; reason: ReportReason; details?: string | null }): Promise<void> {
    if (input.entityType === 'NOTE' || input.entityType === 'USER') return this.moderation.report(viewerId, input)
    if (!can(await this.policy.actor(viewerId), Action.CONTENT_REPORT)) throw Errors.forbidden()
    const authorId = await this.seenAuthor(viewerId, input.entityType, input.entityId)
    if (authorId === null) throw Errors.notFound('That is not there any more.')
    if (authorId === viewerId) throw Errors.validation('This is your own.', ['input', 'entityId'])
    const subject = await this.moderation.subject(input.entityType, input.entityId)
    if (!subject) throw Errors.notFound('That is not there any more.')
    await this.moderation.fileReport(viewerId, input, { scope: subject.scope, scopeId: subject.scopeId })
  }

  /** The author of what the viewer reports, when the viewer can see it; null otherwise. */
  private async seenAuthor(viewerId: string, entityType: ReportEntityType, entityId: string): Promise<string | null> {
    switch (entityType) {
      case 'COMMENT': {
        const found = await this.comments.get(viewerId, entityId)
        return found && !found.comment.deletedAt ? found.comment.authorId : null
      }
      case 'GROUP_POST':
        return (await this.groups.getPost(viewerId, entityId))?.authorId ?? null
      case 'CLASSROOM_POST':
        return (await this.classes.postPlace(viewerId, entityId))?.authorId ?? null
      case 'DOUBT':
        return (await this.workspaces.getDoubt(viewerId, entityId))?.doubt.authorId ?? null
      case 'GROUP':
        return (await this.groups.view(viewerId, entityId))?.group.ownerId ?? null
      default:
        return null
    }
  }
}

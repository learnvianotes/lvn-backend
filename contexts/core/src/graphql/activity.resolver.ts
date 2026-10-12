import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { connection } from '@lvn-backend/graphql'
import { ActivityService } from '../application/activity.service'
import { ClassroomsService } from '../application/classrooms.service'
import { GroupsService } from '../application/groups.service'
import { WorkspacesService } from '../application/workspaces.service'
import { moderationFor } from '../application/moderation.service'
import { post } from './groups.resolver'

const userRef = (id: string) => ({ __typename: 'User', id })

/** The activity feed (ADR-0049): each item resolved to the types that render it, for this viewer. */
@Resolver()
@UseGuards(SignedInGuard)
export class ActivityResolver {
  constructor(
    private readonly activity: ActivityService,
    private readonly groups: GroupsService,
    private readonly classes: ClassroomsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Query('activityFeed')
  async activityFeed(@Args('first') first: number | null, @Args('after') after: string | null, @CurrentViewer() viewer: Viewer) {
    const { items, size } = await this.activity.page(viewer.userId, first, after)
    // One view per place on this page, for posts' permissions and the place itself.
    const groupViews = new Map(await Promise.all([...new Set(items.map((i) => i.groupId).filter((g): g is string => !!g))].map(async (id) => [id, await this.groups.view(viewer.userId, id)] as const)))
    const classViews = new Map(await Promise.all([...new Set(items.map((i) => i.classroomId).filter((c): c is string => !!c))].map(async (id) => [id, await this.classes.view(viewer.userId, id)] as const)))
    const nodes = await Promise.all(
      items.map(async (i) => {
        const gv = i.groupId ? groupViews.get(i.groupId) : null
        const cv = i.classroomId ? classViews.get(i.classroomId) : null
        const doubt = i.doubt ? await this.workspaces.getDoubt(viewer.userId, i.doubt.id) : null
        return {
          ...i,
          key: `${i.kind}:${i.groupId ?? i.classroomId}:${i.id}`,
          actor: userRef(i.actorId),
          group: gv ? { ...gv.group, view: gv } : null,
          classroom: cv ? { ...cv.classroom, view: cv } : null,
          post: i.post ? post(i.post, viewer.userId, !!gv?.can.moderate) : null,
          announcement: i.announcement ? { id: i.announcement.id, author: userRef(i.announcement.authorId), body: i.announcement.body, createdAt: i.announcement.createdAt, viewerCanDelete: !!cv?.can.post, ...moderationFor(i.announcement, viewer.userId) } : null,
          doubt: doubt ? { row: doubt.doubt, can: doubt.can } : null,
          note: i.noteId ? { __typename: 'Note', id: i.noteId } : null,
        }
      }),
    )
    return connection(nodes, size, (n) => [n.at.toISOString(), n.id], (n) => n)
  }
}

import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { Errors, withUserErrors } from '@lvn-backend/errors'
import { connection, decodeCursor, pageSize } from '@lvn-backend/graphql'
import { NotificationService, type NotificationRow } from '../notifications/notification.service'
import type { MarkNotificationsReadPayload, MutationMarkNotificationsReadArgs, QueryNotificationsArgs } from './schema.types'

/** At most this many ids in one markNotificationsRead */
const MARK_MAX = 100

@Resolver('Notification')
@UseGuards(SignedInGuard)
export class NotificationsResolver {
  constructor(private readonly notifications: NotificationService) {}

  @Query('notifications')
  async list(@Args() { first, after }: QueryNotificationsArgs, @CurrentViewer() viewer: Viewer) {
    const size = pageSize(first)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const rows = await this.notifications.list(viewer.userId, size, cursor)
    return connection(rows, size, (n) => [n.createdAt.toISOString(), n.id], (n) => n)
  }

  @Query('unreadNotificationCount')
  unreadCount(@CurrentViewer() viewer: Viewer): Promise<number> {
    return this.notifications.unreadCount(viewer.userId)
  }

  @Mutation('markNotificationsRead')
  markRead(@Args() { input }: MutationMarkNotificationsReadArgs, @CurrentViewer() viewer: Viewer): Promise<MarkNotificationsReadPayload> {
    return withUserErrors<MarkNotificationsReadPayload>(
      async () => {
        if (input.all) return { unreadCount: await this.notifications.markRead(viewer.userId, 'all') }
        const ids = input.ids ?? []
        if (!ids.length) throw Errors.validation('Say which notifications to mark, or all of them.', ['ids'])
        if (ids.length > MARK_MAX) throw Errors.validation(`Mark at most ${MARK_MAX} notifications at once, or all of them.`, ['ids'])
        return { unreadCount: await this.notifications.markRead(viewer.userId, ids) }
      },
      { unreadCount: 0 },
    )
  }

  @ResolveField('actor')
  actor(@Parent() n: NotificationRow) {
    return n.actorId ? { __typename: 'User', id: n.actorId } : null
  }

  @ResolveField('note')
  note(@Parent() n: NotificationRow) {
    return n.noteId ? { __typename: 'Note', id: n.noteId } : null
  }

  @ResolveField('group')
  group(@Parent() n: NotificationRow) {
    return n.groupId ? { __typename: 'Group', id: n.groupId } : null
  }

  @ResolveField('classroom')
  classroom(@Parent() n: NotificationRow) {
    return n.classroomId ? { __typename: 'Classroom', id: n.classroomId } : null
  }
}

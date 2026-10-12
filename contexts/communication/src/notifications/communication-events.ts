import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { LiveHub } from '../live/live-hub'
import { NotificationService } from './notification.service'

/**
 * What `communication` does with other contexts' events (ADR-0042). The API and the worker each run this on their own
 * bus: an event is published in exactly one process, so each notification is written once.
 */
@Injectable()
export class CommunicationEvents implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly notifications: NotificationService,
    private readonly live: LiveHub,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('NoteShared', async ({ payload }) => {
      if (payload.target.kind !== 'USER') return
      await this.notifications.notify({ userId: payload.target.userId, category: 'SHARE', path: `/notes/${payload.noteId}`, actorId: payload.sharedBy ?? null, noteId: payload.noteId })
    })
    this.events.subscribe('VerificationRequested', async ({ payload }) => {
      if (payload.method !== 'TEACHER' || !payload.teacherId) return
      await this.notifications.notify({ userId: payload.teacherId, category: 'VERIFICATION', path: '/profile', actorId: payload.userId, data: { kind: 'REQUESTED' } })
    })
    this.events.subscribe('VerificationDecided', async ({ payload }) => {
      // Platform admins who review documents are not named (ADR-0019); a teacher who vouched is.
      const actorId = payload.method === 'TEACHER' ? payload.reviewerId : null
      await this.notifications.notify({ userId: payload.userId, category: 'VERIFICATION', path: '/profile', actorId, data: { kind: 'DECIDED', decision: payload.decision } })
    })
    this.events.subscribe('DataExportReady', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.userId, category: 'DATA_EXPORT', path: '/profile' })
    })
    this.events.subscribe('NotesImportCompleted', async ({ payload }) => {
      const { created, skipped, failed } = payload
      await this.notifications.notify({ userId: payload.userId, category: 'NOTES_IMPORT', path: '/profile', data: { created, skipped, failed } })
    })
    // A new follower (ADR-0043); quiet when the person restricts them, so they cause no notification (ADR-0016).
    this.events.subscribe('UserFollowed', async ({ payload }) => {
      if (payload.quiet) return
      await this.notifications.notify({ userId: payload.followeeId, category: 'FOLLOW', path: `/u/${payload.followerId}`, actorId: payload.followerId })
    })
    // Teacher connections (ADR-0044): the person asked, then the one who asked once accepted; a decline is silent.
    this.events.subscribe('ConnectionRequested', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.toUserId, category: 'CONNECTION', path: `/u/${payload.fromUserId}`, actorId: payload.fromUserId, data: { kind: 'REQUESTED' } })
    })
    this.events.subscribe('ConnectionChanged', async ({ payload }) => {
      if (payload.change !== 'CONNECTED' || !payload.by) return
      const other = payload.userIds.find((id) => id !== payload.by)
      if (other) await this.notifications.notify({ userId: other, category: 'CONNECTION', path: `/u/${payload.by}`, actorId: payload.by, data: { kind: 'ACCEPTED' } })
    })
    // Groups (ADR-0045): the owner and admins are asked; the person who asked hears the answer.
    this.events.subscribe('GroupJoinRequested', async ({ payload }) => {
      for (const reviewer of payload.reviewerIds ?? []) {
        await this.notifications.notify({ userId: reviewer, category: 'JOIN_REQUEST', path: `/groups/${payload.groupId}`, actorId: payload.userId, groupId: payload.groupId })
      }
    })
    this.events.subscribe('JoinRequestReviewed', async ({ payload }) => {
      if (payload.scope.kind !== 'GROUP') return
      await this.notifications.notify({ userId: payload.userId, category: 'JOIN_DECISION', path: `/groups/${payload.scope.groupId}`, groupId: payload.scope.groupId, data: { decision: payload.decision } })
    })
    // Sockets of a revoked session close on every instance.
    this.events.subscribe('SessionRevoked', async ({ payload }) => {
      await this.live.publish(payload.userId, { type: 'revoke', sessionId: payload.sessionId })
    })
    this.events.subscribe('UserDeleted', async ({ payload }) => {
      await this.notifications.forget(payload.userId)
    })
  }
}

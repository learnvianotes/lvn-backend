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
      await this.notifications.notify({ userId: payload.userId, category: 'VERIFICATION', path: '/profile', actorId, data: { kind: 'DECIDED', decision: payload.decision, purpose: payload.purpose ?? 'ACCOUNT' } })
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
      const { scope } = payload
      if (scope.kind === 'GROUP') await this.notifications.notify({ userId: payload.userId, category: 'JOIN_DECISION', path: `/groups/${scope.groupId}`, groupId: scope.groupId, data: { decision: payload.decision } })
      // Who answered is not named: the class's staff answer together (ADR-0046).
      else await this.notifications.notify({ userId: payload.userId, category: 'JOIN_DECISION', path: `/classes/${scope.classroomId}`, classroomId: scope.classroomId, data: { decision: payload.decision } })
    })
    // Classes (ADR-0046): staff are asked; the invited hear of it; every member reads an announcement.
    this.events.subscribe('ClassroomJoinRequested', async ({ payload }) => {
      for (const reviewer of payload.reviewerIds ?? []) {
        await this.notifications.notify({ userId: reviewer, category: 'JOIN_REQUEST', path: `/classes/${payload.classroomId}`, actorId: payload.userId, classroomId: payload.classroomId })
      }
    })
    this.events.subscribe('ClassroomInvited', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.userId, category: 'CLASSROOM_INVITE', path: `/classes/${payload.classroomId}`, actorId: payload.invitedBy, classroomId: payload.classroomId })
    })
    this.events.subscribe('ClassroomPosted', async ({ payload }) => {
      await this.notifications.notifyMany(payload.memberIds, { category: 'CLASSROOM_POST', path: `/classes/${payload.classroomId}`, actorId: payload.authorId, classroomId: payload.classroomId })
    })
    // A revision task of an exam's plan left today (ADR-0070): one reminder, which opens the exam.
    this.events.subscribe('ExamTaskDue', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.userId, category: 'REVISION_REMINDER', path: `/exams/${payload.examId}`, data: { examName: payload.examName, topics: payload.topics.join(', ') } })
    })
    // Rhythm buddies (ADR-0072): an invite, or an invite accepted; the notification opens Rhythm.
    this.events.subscribe('RhythmBuddyChanged', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.userId, category: 'RHYTHM_BUDDY', path: '/rhythm', actorId: payload.otherId, data: { kind: payload.kind } })
    })
    // A resource recommended to the person (ADR-0075), by someone; the notification opens it.
    this.events.subscribe('ResourceRecommended', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.toUserId, category: 'RESOURCE', path: `/resources/${payload.resourceId}`, actorId: payload.fromUserId, data: { kind: 'RECOMMENDED' } })
    })
    // A resource moderators approved or rejected (ADR-0074): the submitter is told, and the notification opens it.
    this.events.subscribe('ResourceDecided', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.submittedById, category: 'RESOURCE', path: `/resources/${payload.resourceId}`, data: { decision: payload.decision } })
    })
    // An achievement (ADR-0080): told in the app, opening the person's achievements; never pushed.
    this.events.subscribe('AchievementEarned', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.userId, category: 'ACHIEVEMENT', path: '/achievements', data: { kind: payload.kind, tier: payload.tier, ...(payload.subjectTitle ? { subject: payload.subjectTitle } : {}) } })
    })
    // A quiz published to a class (ADR-0064): its other members are told, and the notification opens the quiz.
    this.events.subscribe('QuizPublished', async ({ payload }) => {
      if (!payload.classroomId || !payload.memberIds?.length) return
      await this.notifications.notifyMany(payload.memberIds, { category: 'QUIZ_PUBLISHED', path: `/classes/${payload.classroomId}/quizzes/${payload.quizId}`, actorId: payload.authorId ?? null, classroomId: payload.classroomId })
    })
    // Comments (ADR-0047): core works out who is told; the notification opens where the discussion is.
    this.events.subscribe('CommentAdded', async ({ payload }) => {
      const place = payload.place
      if (!place) return
      const where =
        whereOf(place)
      for (const r of payload.recipients ?? []) {
        await this.notifications.notify({ userId: r.userId, category: 'COMMENT', actorId: payload.authorId, data: { kind: r.kind }, ...where })
      }
    })
    // Mentions (ADR-0054): each person named, where they were named.
    this.events.subscribe('PeopleMentioned', async ({ payload }) => {
      const place = payload.place
      const where =
        whereOf(place)
      for (const userId of payload.mentionedIds) {
        await this.notifications.notify({ userId, category: 'MENTION', actorId: payload.authorId, data: { entityType: payload.entityType }, ...where })
      }
    })
    // Project workspaces (ADR-0048): the teacher asked to mentor; mentors hear of doubts, askers of answers.
    this.events.subscribe('MentorInvited', async ({ payload }) => {
      await this.notifications.notify({ userId: payload.teacherId, category: 'MENTOR_INVITE', path: `/groups/${payload.groupId}`, actorId: payload.invitedBy, groupId: payload.groupId })
    })
    const doubtPath = (groupId: string, doubtId: string) => `/groups/${groupId}/doubts/${doubtId}`
    this.events.subscribe('DoubtAsked', async ({ payload }) => {
      for (const mentor of payload.mentorIds ?? []) {
        await this.notifications.notify({ userId: mentor, category: 'DOUBT', path: doubtPath(payload.groupId, payload.doubtId), actorId: payload.askedBy, groupId: payload.groupId, data: { kind: 'ASKED' } })
      }
    })
    this.events.subscribe('DoubtAnswered', async ({ payload }) => {
      if (!payload.askedBy) return
      await this.notifications.notify({ userId: payload.askedBy, category: 'DOUBT', path: doubtPath(payload.groupId, payload.doubtId), actorId: payload.answeredBy, groupId: payload.groupId, data: { kind: 'ANSWERED', byMentor: payload.byMentor } })
    })
    this.events.subscribe('DoubtResolved', async ({ payload }) => {
      if (!payload.askedBy) return
      await this.notifications.notify({ userId: payload.askedBy, category: 'DOUBT', path: doubtPath(payload.groupId, payload.doubtId), actorId: payload.resolvedBy, groupId: payload.groupId, data: { kind: 'RESOLVED' } })
    })
    // Moderation (ADR-0051): the author hears what a moderator decided; the reason is shown with the content, not here.
    this.events.subscribe('ContentModerated', async ({ payload }) => {
      await this.notifications.notify({
        userId: payload.authorId,
        category: 'MODERATION',
        path: payload.path,
        noteId: payload.noteId ?? null,
        groupId: payload.groupId ?? null,
        classroomId: payload.classroomId ?? null,
        data: { kind: payload.kind, entityType: payload.entityType },
      })
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

type Place = { kind: 'NOTE'; noteId: string } | { kind: 'GROUP'; groupId: string } | { kind: 'CLASSROOM'; classroomId: string } | { kind: 'RESOURCE'; resourceId: string }

/** Where a comment or a mention is, as a notification opens it. */
function whereOf(place: Place): { path: string; noteId?: string; groupId?: string; classroomId?: string } {
  switch (place.kind) {
    case 'NOTE':
      return { path: `/notes/${place.noteId}`, noteId: place.noteId }
    case 'GROUP':
      return { path: `/groups/${place.groupId}`, groupId: place.groupId }
    case 'CLASSROOM':
      return { path: `/classes/${place.classroomId}`, classroomId: place.classroomId }
    case 'RESOURCE':
      return { path: `/resources/${place.resourceId}` }
  }
}

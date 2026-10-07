import { z } from 'zod'
import { enumValues, GlobalRole, Visibility } from '../domain/enums'

/**
 * Integration events between bounded contexts (spec §3, §6.1). Both EventBus adapters (in-process and
 * NATS JetStream) publish exactly these payloads. A breaking payload change is a new `version`, never
 * an edit — consumers handle every version they declare.
 */

const uuid = z.uuid()

export const eventEnvelope = <T extends string, V extends number, P extends z.ZodType>(type: T, version: V, payload: P) =>
  z.object({
    id: uuid,
    type: z.literal(type),
    version: z.literal(version),
    occurredAt: z.iso.datetime(),
    /** Request id that caused the event, for tracing (§7.2). */
    correlationId: z.string().optional(),
    payload,
  })

const membership = z.object({ userId: uuid, change: z.enum(['JOINED', 'LEFT', 'ROLE_CHANGED']), role: z.string().optional() })

export const events = {
  // users
  UserRegistered: eventEnvelope('UserRegistered', 1, z.object({ userId: uuid })),
  UserDeleted: eventEnvelope('UserDeleted', 1, z.object({ userId: uuid })),
  RoleChanged: eventEnvelope('RoleChanged', 1, z.object({ userId: uuid, globalRole: z.enum(enumValues(GlobalRole)) })),
  SessionRevoked: eventEnvelope('SessionRevoked', 1, z.object({ userId: uuid, sessionId: uuid, family: z.boolean() })),
  // notes
  NotePublished: eventEnvelope('NotePublished', 1, z.object({ noteId: uuid, versionId: uuid, ownerId: uuid, visibility: z.enum(enumValues(Visibility)) })),
  NoteUnpublished: eventEnvelope('NoteUnpublished', 1, z.object({ noteId: uuid, ownerId: uuid })),
  NoteForked: eventEnvelope('NoteForked', 1, z.object({ noteId: uuid, forkedFromNoteId: uuid, forkedFromVersionId: uuid, ownerId: uuid })),
  NoteShared: eventEnvelope('NoteShared', 1, z.object({ noteId: uuid, target: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('USER'), userId: uuid }),
    z.object({ kind: z.literal('GROUP'), groupId: uuid }),
    z.object({ kind: z.literal('CLASSROOM'), classroomId: uuid }),
  ]) })),
  FileReady: eventEnvelope('FileReady', 1, z.object({ fileId: uuid, ownerId: uuid, mimeType: z.string() })),
  // core
  GroupMembershipChanged: eventEnvelope('GroupMembershipChanged', 1, membership.extend({ groupId: uuid })),
  ClassroomMembershipChanged: eventEnvelope('ClassroomMembershipChanged', 1, membership.extend({ classroomId: uuid })),
  // Membership is by approval (ADR-0009): reviewers are notified of requests, requesters of the decision.
  // An approval is followed by Group/ClassroomMembershipChanged (JOINED).
  GroupJoinRequested: eventEnvelope('GroupJoinRequested', 1, z.object({ requestId: uuid, groupId: uuid, userId: uuid })),
  ClassroomJoinRequested: eventEnvelope('ClassroomJoinRequested', 1, z.object({ requestId: uuid, classroomId: uuid, userId: uuid })),
  JoinRequestReviewed: eventEnvelope('JoinRequestReviewed', 1, z.object({
    requestId: uuid,
    scope: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('GROUP'), groupId: uuid }),
      z.object({ kind: z.literal('CLASSROOM'), classroomId: uuid }),
    ]),
    userId: uuid,
    reviewerId: uuid,
    decision: z.enum(['APPROVED', 'REJECTED']),
  })),
  CommentAdded: eventEnvelope('CommentAdded', 1, z.object({ commentId: uuid, targetType: z.string(), targetId: uuid, authorId: uuid })),
  QuizPublished: eventEnvelope('QuizPublished', 1, z.object({ quizId: uuid, classroomId: uuid.optional() })),
  ContentReported: eventEnvelope('ContentReported', 1, z.object({ reportId: uuid, entityType: z.string(), entityId: uuid })),
  LearningEventRecorded: eventEnvelope('LearningEventRecorded', 1, z.object({ userId: uuid, eventIds: z.array(uuid).min(1) })),
  // ai
  NoteArtifactReady: eventEnvelope('NoteArtifactReady', 1, z.object({ artifactId: uuid, noteId: uuid, versionId: uuid, artifactType: z.string() })),
  ModerationScored: eventEnvelope('ModerationScored', 1, z.object({ entityType: z.string(), entityId: uuid, flagged: z.boolean(), categories: z.array(z.string()) })),
  AiBudgetThreshold: eventEnvelope('AiBudgetThreshold', 1, z.object({ percentUsed: z.number().min(0) })),
  // communication
  NotificationDelivered: eventEnvelope('NotificationDelivered', 1, z.object({ notificationId: uuid, channel: z.enum(['IN_APP', 'PUSH', 'EMAIL']) })),
} as const

export type EventName = keyof typeof events
export type EventOf<N extends EventName> = z.infer<(typeof events)[N]>

/** Validate an incoming event of a known type; throws on a malformed payload. */
export function parseEvent<N extends EventName>(name: N, data: unknown): EventOf<N> {
  return events[name].parse(data) as EventOf<N>
}

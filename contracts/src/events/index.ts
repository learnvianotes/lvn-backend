import { z } from 'zod'
import { BoundedContext, enumValues, GlobalRole, NoteKind, VerificationMethod, Visibility, YearOfStudy } from '../domain/enums'

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
  /** The account became verified (ADR-0017, ADR-0019); organizationId when known. method is optional: additive in v1. */
  InstitutionVerified: eventEnvelope('InstitutionVerified', 1, z.object({
    userId: uuid,
    organizationId: uuid.optional(),
    method: z.enum(enumValues(VerificationMethod)).optional(),
  })),
  // Verification without an institutional email (ADR-0019). Documents never appear in events.
  VerificationRequested: eventEnvelope('VerificationRequested', 1, z.object({
    requestId: uuid,
    userId: uuid,
    method: z.enum(['TEACHER', 'DOCUMENTS']),
    teacherId: uuid.optional(),
  })),
  VerificationDecided: eventEnvelope('VerificationDecided', 1, z.object({
    requestId: uuid,
    userId: uuid,
    method: z.enum(['TEACHER', 'DOCUMENTS']),
    decision: z.enum(['APPROVED', 'REJECTED']),
    reviewerId: uuid,
  })),
  // Data export (ADR-0018): users asks every context for its part, then assembles one archive.
  DataExportRequested: eventEnvelope('DataExportRequested', 1, z.object({ exportId: uuid, userId: uuid })),
  DataExportPartReady: eventEnvelope('DataExportPartReady', 1, z.object({
    exportId: uuid,
    context: z.enum(enumValues(BoundedContext)),
    fileId: uuid,
  })),
  DataExportReady: eventEnvelope('DataExportReady', 1, z.object({ exportId: uuid, userId: uuid, fileId: uuid, expiresAt: z.iso.datetime() })),
  /** A user claimed their old learnvianotes.in data; core and notes import their parts from the snapshot (ADR-0023). */
  LegacyDataClaimed: eventEnvelope('LegacyDataClaimed', 1, z.object({ userId: uuid, legacyUid: z.string().min(1) })),
  LegacyImportPartDone: eventEnvelope('LegacyImportPartDone', 1, z.object({
    userId: uuid,
    context: z.enum(enumValues(BoundedContext)),
    items: z.number().int().min(0),
  })),
  /** Department, year and interests changed (ADR-0026); core keeps a read model for recommendations. */
  ProfileUpdated: eventEnvelope('ProfileUpdated', 1, z.object({
    userId: uuid,
    department: z.string().max(80).optional(),
    yearOfStudy: z.enum(enumValues(YearOfStudy)).optional(),
    interestTopicIds: z.array(uuid).max(50),
  })),
  /** A notes import finished (ADR-0018): counts for the report shown in Settings → Data. */
  NotesImportCompleted: eventEnvelope('NotesImportCompleted', 1, z.object({
    importId: uuid,
    userId: uuid,
    created: z.number().int().min(0),
    skipped: z.number().int().min(0),
    failed: z.number().int().min(0),
  })),
  RoleChanged: eventEnvelope('RoleChanged', 1, z.object({ userId: uuid, globalRole: z.enum(enumValues(GlobalRole)) })),
  SessionRevoked: eventEnvelope('SessionRevoked', 1, z.object({ userId: uuid, sessionId: uuid, family: z.boolean() })),
  // Teacher network (ADR-0013). notes keeps a connections read model for "shared with my connections"; core
  // builds the Following feed; communication notifies.
  UserFollowed: eventEnvelope('UserFollowed', 1, z.object({ followerId: uuid, followeeId: uuid })),
  UserUnfollowed: eventEnvelope('UserUnfollowed', 1, z.object({ followerId: uuid, followeeId: uuid })),
  ConnectionRequested: eventEnvelope('ConnectionRequested', 1, z.object({ requestId: uuid, fromUserId: uuid, toUserId: uuid })),
  ConnectionChanged: eventEnvelope('ConnectionChanged', 1, z.object({
    userIds: z.tuple([uuid, uuid]),
    change: z.enum(['CONNECTED', 'DISCONNECTED']),
  })),
  // Block and restrict (§15.1, ADR-0016). A block ends follows and connections both ways (users emits the
  // matching UserUnfollowed / ConnectionChanged too); notes and core hide the blocked user's content and comments;
  // core holds a restricted user's comments for approval; communication mutes notifications from them.
  UserBlocked: eventEnvelope('UserBlocked', 1, z.object({ blockerId: uuid, blockedId: uuid })),
  UserUnblocked: eventEnvelope('UserUnblocked', 1, z.object({ blockerId: uuid, blockedId: uuid })),
  UserRestricted: eventEnvelope('UserRestricted', 1, z.object({ restricterId: uuid, restrictedId: uuid })),
  UserUnrestricted: eventEnvelope('UserUnrestricted', 1, z.object({ restricterId: uuid, restrictedId: uuid })),
  // notes
  NotePublished: eventEnvelope('NotePublished', 1, z.object({
    noteId: uuid,
    versionId: uuid,
    ownerId: uuid,
    visibility: z.enum(enumValues(Visibility)),
    /** Set when the published note is a fork, so the origin's owner can be told (ADR-0010). Optional: additive in v1. */
    forkedFromNoteId: uuid.optional(),
    /** NOTE, BLOG, POST or PROJECT, for the Following feed (ADR-0014). Optional: additive in v1; absent means NOTE. */
    kind: z.enum(enumValues(NoteKind)).optional(),
  })),
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
  // Project workspaces (ADR-0015).
  MentorInvited: eventEnvelope('MentorInvited', 1, z.object({ groupId: uuid, teacherId: uuid, invitedBy: uuid })),
  DoubtAsked: eventEnvelope('DoubtAsked', 1, z.object({ doubtId: uuid, groupId: uuid, askedBy: uuid })),
  DoubtAnswered: eventEnvelope('DoubtAnswered', 1, z.object({ doubtId: uuid, groupId: uuid, answerId: uuid, answeredBy: uuid, byMentor: z.boolean() })),
  DoubtResolved: eventEnvelope('DoubtResolved', 1, z.object({ doubtId: uuid, groupId: uuid, resolvedBy: uuid })),
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

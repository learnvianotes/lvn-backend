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
    /** ADR-0073: an application for the TEACHER role; ACCOUNT when absent */
    purpose: z.enum(['ACCOUNT', 'TEACHER_ROLE']).optional(),
  })),
  VerificationDecided: eventEnvelope('VerificationDecided', 1, z.object({
    requestId: uuid,
    userId: uuid,
    method: z.enum(['TEACHER', 'DOCUMENTS']),
    decision: z.enum(['APPROVED', 'REJECTED']),
    reviewerId: uuid,
    /** ADR-0073: an application for the TEACHER role; ACCOUNT when absent */
    purpose: z.enum(['ACCOUNT', 'TEACHER_ROLE']).optional(),
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
  /** The user removed (or never wanted) their old-site data: contexts delete what they imported from it (ADR-0023). */
  LegacyDataDeclined: eventEnvelope('LegacyDataDeclined', 1, z.object({ userId: uuid, legacyUid: z.string().min(1) })),
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
  /** What people search finds of someone changed (ADR-0055): name, handle, date of birth, a teacher's headline or bio. */
  PersonChanged: eventEnvelope('PersonChanged', 1, z.object({ userId: uuid })),
  SessionRevoked: eventEnvelope('SessionRevoked', 1, z.object({ userId: uuid, sessionId: uuid, family: z.boolean() })),
  // Teacher network (ADR-0013). notes keeps a connections read model for "shared with my connections"; core
  // builds the Following feed; communication notifies.
  /** quiet: the person followed restricts the follower, so no notification (ADR-0043); optional, additive in v1. */
  UserFollowed: eventEnvelope('UserFollowed', 1, z.object({ followerId: uuid, followeeId: uuid, quiet: z.boolean().optional() })),
  UserUnfollowed: eventEnvelope('UserUnfollowed', 1, z.object({ followerId: uuid, followeeId: uuid, quiet: z.boolean().optional() })),
  ConnectionRequested: eventEnvelope('ConnectionRequested', 1, z.object({ requestId: uuid, fromUserId: uuid, toUserId: uuid })),
  ConnectionChanged: eventEnvelope('ConnectionChanged', 1, z.object({
    userIds: z.tuple([uuid, uuid]),
    change: z.enum(['CONNECTED', 'DISCONNECTED']),
    /** Who caused it (accepted, removed, blocked); optional, additive in v1 (ADR-0044). */
    by: uuid.optional(),
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
  /** sharedBy (the owner, who alone shares) is optional: additive in v1 (ADR-0042). */
  NoteShared: eventEnvelope('NoteShared', 1, z.object({ noteId: uuid, sharedBy: uuid.optional(), target: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('USER'), userId: uuid }),
    z.object({ kind: z.literal('GROUP'), groupId: uuid }),
    z.object({ kind: z.literal('CLASSROOM'), classroomId: uuid }),
  ]) })),
  FileReady: eventEnvelope('FileReady', 1, z.object({ fileId: uuid, ownerId: uuid, mimeType: z.string() })),
  // ADR-0041: ClamAV found something; the file is kept in quarantine and no longer served.
  FileQuarantined: eventEnvelope('FileQuarantined', 1, z.object({ fileId: uuid, ownerId: uuid, signature: z.string().max(200) })),
  // core
  /** A group came to be or went (ADR-0045): notes keeps a read model of groups for notes shared to them. */
  GroupCreated: eventEnvelope('GroupCreated', 1, z.object({ groupId: uuid, ownerId: uuid })),
  GroupDeleted: eventEnvelope('GroupDeleted', 1, z.object({ groupId: uuid })),
  /** Platform moderators put back a group they had removed (an appeal granted, ADR-0053): it is readable again. */
  GroupRestored: eventEnvelope('GroupRestored', 1, z.object({ groupId: uuid })),
  /** Name, description or privacy changed (ADR-0056): search re-indexes the group. */
  GroupUpdated: eventEnvelope('GroupUpdated', 1, z.object({ groupId: uuid })),
  GroupMembershipChanged: eventEnvelope('GroupMembershipChanged', 1, membership.extend({ groupId: uuid })),
  /** A classroom came to be or went (ADR-0046): notes keeps a read model for notes shared to classes. */
  ClassroomCreated: eventEnvelope('ClassroomCreated', 1, z.object({ classroomId: uuid, ownerId: uuid })),
  ClassroomDeleted: eventEnvelope('ClassroomDeleted', 1, z.object({ classroomId: uuid })),
  /** Name or description changed (ADR-0056): search re-indexes the class. */
  ClassroomUpdated: eventEnvelope('ClassroomUpdated', 1, z.object({ classroomId: uuid })),
  /** role: TEACHER, TA or STUDENT (ADR-0046). */
  ClassroomMembershipChanged: eventEnvelope('ClassroomMembershipChanged', 1, membership.extend({ classroomId: uuid })),
  /** Staff invited someone (ADR-0046): the invite is the acceptance given in advance. */
  ClassroomInvited: eventEnvelope('ClassroomInvited', 1, z.object({ inviteId: uuid, classroomId: uuid, userId: uuid, invitedBy: uuid })),
  /** Staff posted an announcement; memberIds are told (at most 1,000 per event). */
  ClassroomPosted: eventEnvelope('ClassroomPosted', 1, z.object({ postId: uuid, classroomId: uuid, authorId: uuid, memberIds: z.array(uuid).max(1000) })),
  // Membership is by approval (ADR-0009): reviewers are notified of requests, requesters of the decision.
  // An approval is followed by Group/ClassroomMembershipChanged (JOINED).
  /** reviewerIds: who answers it (owner and admins), so communication tells them; optional, additive in v1 (ADR-0045). */
  GroupJoinRequested: eventEnvelope('GroupJoinRequested', 1, z.object({ requestId: uuid, groupId: uuid, userId: uuid, reviewerIds: z.array(uuid).max(100).optional() })),
  /** reviewerIds: the class's staff, so communication tells them; optional, additive in v1 (ADR-0046). */
  ClassroomJoinRequested: eventEnvelope('ClassroomJoinRequested', 1, z.object({ requestId: uuid, classroomId: uuid, userId: uuid, reviewerIds: z.array(uuid).max(100).optional() })),
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
  /** mentorIds: who is told (ADR-0048); optional, additive in v1. */
  DoubtAsked: eventEnvelope('DoubtAsked', 1, z.object({ doubtId: uuid, groupId: uuid, askedBy: uuid, mentorIds: z.array(uuid).max(50).optional() })),
  /** askedBy: who is told (ADR-0048); optional, additive in v1. */
  DoubtAnswered: eventEnvelope('DoubtAnswered', 1, z.object({ doubtId: uuid, groupId: uuid, answerId: uuid, answeredBy: uuid, byMentor: z.boolean(), askedBy: uuid.optional() })),
  DoubtResolved: eventEnvelope('DoubtResolved', 1, z.object({ doubtId: uuid, groupId: uuid, resolvedBy: uuid, askedBy: uuid.optional() })),
  /**
   * The people credited on a workspace's showcase note (ADR-0048), whole each time: notes replaces what it had for
   * this note and group. Empty when the showcase is cleared.
   */
  ProjectContributorsChanged: eventEnvelope('ProjectContributorsChanged', 1, z.object({
    noteId: uuid,
    groupId: uuid,
    contributors: z.array(z.object({ userId: uuid, role: z.enum(['CONTRIBUTOR', 'MENTOR']) })).max(2000),
  })),
  /**
   * A comment or reply (ADR-0047). recipients: who is told, worked out by core (the content's owner; for a reply also
   * the parent comment's author; never the author, a restricted person's or across a block). place: where it opens.
   * Both optional, additive in v1.
   */
  CommentAdded: eventEnvelope('CommentAdded', 1, z.object({
    commentId: uuid,
    targetType: z.string(),
    targetId: uuid,
    authorId: uuid,
    recipients: z.array(z.object({ userId: uuid, kind: z.enum(['COMMENT', 'REPLY']) })).max(10).optional(),
    place: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('NOTE'), noteId: uuid }),
      z.object({ kind: z.literal('GROUP'), groupId: uuid }),
      z.object({ kind: z.literal('CLASSROOM'), classroomId: uuid }),
      z.object({ kind: z.literal('RESOURCE'), resourceId: uuid }),
    ]).optional(),
  })),
  /**
   * Staff published a quiz to a class (ADR-0064); memberIds are told (at most 1,000 per event). authorId and memberIds
   * are optional, additive in v1 (ADR-0045).
   */
  // An exam's revision task left in the evening (ADR-0070): the person is reminded once.
  ExamTaskDue: eventEnvelope('ExamTaskDue', 1, z.object({ userId: uuid, examId: uuid, examName: z.string().max(100), topics: z.array(z.string().max(200)).max(20) })),
  // Rhythm buddies (ADR-0072): asked, or accepted; the other person is told.
  RhythmBuddyChanged: eventEnvelope('RhythmBuddyChanged', 1, z.object({ userId: uuid, otherId: uuid, kind: z.enum(['REQUESTED', 'ACCEPTED']) })),
  QuizPublished: eventEnvelope('QuizPublished', 1, z.object({ quizId: uuid, classroomId: uuid.optional(), authorId: uuid.optional(), memberIds: z.array(uuid).max(1000).optional() })),
  ContentReported: eventEnvelope('ContentReported', 1, z.object({ reportId: uuid, entityType: z.string(), entityId: uuid })),
  /**
   * A moderator's decision about someone's comment, post, announcement, doubt, group or account (ADR-0051, ADR-0053),
   * so its author is told: where it was (path, and the group, class or note) and what happened; never the content or
   * the reason. SUSPENDED and, when one is lifted, RESTORED are about the person's account (entityType USER).
   */
  ContentModerated: eventEnvelope('ContentModerated', 1, z.object({
    entityType: z.string(),
    entityId: uuid,
    authorId: uuid,
    kind: z.enum(['HIDDEN', 'REMOVED', 'WARNED', 'RESTORED', 'SUSPENDED']),
    path: z.string().max(512),
    groupId: uuid.optional(),
    classroomId: uuid.optional(),
    noteId: uuid.optional(),
  })),
  /** A resource was submitted, or resubmitted after a rejection: it waits for platform moderators (ADR-0074). */
  ResourceSubmitted: eventEnvelope('ResourceSubmitted', 1, z.object({
    resourceId: uuid,
    submittedById: uuid,
  })),
  /** Moderators approved a resource (or put it back), or rejected (or removed) it with a reason for its submitter. */
  ResourceDecided: eventEnvelope('ResourceDecided', 1, z.object({
    resourceId: uuid,
    submittedById: uuid,
    decision: z.enum(['APPROVED', 'REJECTED']),
    moderatorId: uuid,
  })),
  /** A resource changed in a way search sees (ADR-0075): its state, its words, its saves, or it is gone. */
  ResourceChanged: eventEnvelope('ResourceChanged', 1, z.object({ resourceId: uuid })),
  /** Someone recommended an approved resource to a person (ADR-0075); recommendations to groups and classes are not events. */
  ResourceRecommended: eventEnvelope('ResourceRecommended', 1, z.object({
    resourceId: uuid,
    fromUserId: uuid,
    toUserId: uuid,
  })),
  /** A person reached an achievement tier (ADR-0080): they alone are told, in the app. */
  AchievementEarned: eventEnvelope('AchievementEarned', 1, z.object({
    userId: uuid,
    achievementId: uuid,
    kind: z.enum(['TOPICS_MASTERED', 'QUIZ_MASTER', 'EXAM_READY', 'RHYTHM_WEEKS', 'SUBJECT_CONTRIBUTOR']),
    tier: z.number().int().positive(),
    subjectTitle: z.string().max(200).optional(),
  })),
  /**
   * Someone named people with @handle in a comment or a post (ADR-0054). Only people who can read it and have nothing
   * between them and the author are listed; where it is, never what it says.
   */
  PeopleMentioned: eventEnvelope('PeopleMentioned', 1, z.object({
    entityType: z.enum(['COMMENT', 'GROUP_POST']),
    entityId: uuid,
    authorId: uuid,
    mentionedIds: z.array(uuid).min(1).max(10),
    place: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('NOTE'), noteId: uuid }),
      z.object({ kind: z.literal('GROUP'), groupId: uuid }),
      z.object({ kind: z.literal('CLASSROOM'), classroomId: uuid }),
      z.object({ kind: z.literal('RESOURCE'), resourceId: uuid }),
    ]),
  })),
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

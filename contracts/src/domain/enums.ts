/**
 * Domain enums shared by lvn-backend, lvn-web and lvn-mobile (spec §4, §5, §8, §9, §14).
 * Defined as const objects so they work as runtime values, TypeScript unions and Zod enums.
 */

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as [T[keyof T], ...T[keyof T][]]

export const Visibility = { PRIVATE: 'PRIVATE', SHARED: 'SHARED', PUBLIC: 'PUBLIC' } as const
export type Visibility = (typeof Visibility)[keyof typeof Visibility]

export const GlobalRole = { STUDENT: 'STUDENT', TEACHER: 'TEACHER', PLATFORM_ADMIN: 'PLATFORM_ADMIN' } as const
export type GlobalRole = (typeof GlobalRole)[keyof typeof GlobalRole]

export const GroupRole = { OWNER: 'GROUP_OWNER', ADMIN: 'GROUP_ADMIN', MODERATOR: 'GROUP_MODERATOR', MEMBER: 'GROUP_MEMBER' } as const
export type GroupRole = (typeof GroupRole)[keyof typeof GroupRole]

export const ClassroomRole = { TEACHER: 'CLASSROOM_TEACHER', TA: 'CLASSROOM_TA', STUDENT: 'CLASSROOM_STUDENT' } as const
export type ClassroomRole = (typeof ClassroomRole)[keyof typeof ClassroomRole]

export const OrgRole = { ADMIN: 'ORG_ADMIN' } as const
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole]

/** Note-level grant on a NoteShare row. OWNER is implied by Note.ownerId, never stored as a share. */
export const NoteRole = { OWNER: 'OWNER', EDITOR: 'EDITOR', VIEWER: 'VIEWER' } as const
export type NoteRole = (typeof NoteRole)[keyof typeof NoteRole]

export const CardType = {
  TEXT: 'text', HEADING: 'heading', MARKDOWN: 'markdown', CODE: 'code', IMAGE: 'image', VIDEO: 'video',
  AUDIO: 'audio', FILE: 'file', DIAGRAM: 'diagram', QUOTE: 'quote', CALLOUT: 'callout', CHECKLIST: 'checklist',
  TABLE: 'table', QUESTION: 'question', QUIZ: 'quiz', FLASHCARD: 'flashcard',
} as const
export type CardType = (typeof CardType)[keyof typeof CardType]

export const NoteVersionKind = { PUBLISHED: 'PUBLISHED', CONFLICT: 'CONFLICT' } as const
export type NoteVersionKind = (typeof NoteVersionKind)[keyof typeof NoteVersionKind]

/** A request to join a group or classroom (ADR-0009). */
export const JoinRequestStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED', WITHDRAWN: 'WITHDRAWN' } as const
export type JoinRequestStatus = (typeof JoinRequestStatus)[keyof typeof JoinRequestStatus]

export const GroupPrivacy = { PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' } as const
export type GroupPrivacy = (typeof GroupPrivacy)[keyof typeof GroupPrivacy]

/** How people join a group (ADR-0011). Only a PUBLIC group can be OPEN; a PRIVATE group always uses APPROVAL. */
export const GroupJoinPolicy = { OPEN: 'OPEN', APPROVAL: 'APPROVAL' } as const
export type GroupJoinPolicy = (typeof GroupJoinPolicy)[keyof typeof GroupJoinPolicy]

export const ModerationState = { OK: 'OK', PENDING_REVIEW: 'PENDING_REVIEW', HIDDEN: 'HIDDEN', REMOVED: 'REMOVED' } as const
export type ModerationState = (typeof ModerationState)[keyof typeof ModerationState]

/** GraphQL `extensions.code` values (§6.2). Nothing else reaches clients. */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED', FORBIDDEN: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND', VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT', RATE_LIMITED: 'RATE_LIMITED', INTERNAL: 'INTERNAL',
} as const
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export const AuthProvider = { PASSWORD: 'PASSWORD', GOOGLE: 'GOOGLE', GITHUB: 'GITHUB', LINKEDIN: 'LINKEDIN' } as const
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider]

export const FileStatus = {
  PENDING: 'PENDING', UPLOADED: 'UPLOADED', PROCESSING: 'PROCESSING', READY: 'READY', FAILED: 'FAILED',
  QUARANTINED: 'QUARANTINED', DELETED: 'DELETED',
} as const
export type FileStatus = (typeof FileStatus)[keyof typeof FileStatus]

export const FileParentType = { NOTE: 'NOTE', CARD: 'CARD', GROUP_POST: 'GROUP_POST', RESOURCE: 'RESOURCE', AVATAR: 'AVATAR' } as const
export type FileParentType = (typeof FileParentType)[keyof typeof FileParentType]

export const FilePurpose = { ATTACHMENT: 'ATTACHMENT', COVER: 'COVER', VOICE_NOTE: 'VOICE_NOTE', AVATAR: 'AVATAR', IMPORT: 'IMPORT' } as const
export type FilePurpose = (typeof FilePurpose)[keyof typeof FilePurpose]

/** Upload limits in bytes (§8.1), enforced server-side; clients use them for early feedback only. */
export const UploadLimits = {
  image: 20 * 1024 ** 2,
  audio: 100 * 1024 ** 2,
  video: 500 * 1024 ** 2,
  document: 50 * 1024 ** 2,
  quotaStudent: 5 * 1024 ** 3,
  quotaTeacher: 20 * 1024 ** 3,
} as const

export const NoteArtifactType = {
  SUMMARY: 'SUMMARY', KEY_CONCEPTS: 'KEY_CONCEPTS', QUESTIONS: 'QUESTIONS', QUIZ: 'QUIZ', FLASHCARDS: 'FLASHCARDS',
  EMBEDDINGS: 'EMBEDDINGS', TRANSCRIPT: 'TRANSCRIPT',
} as const
export type NoteArtifactType = (typeof NoteArtifactType)[keyof typeof NoteArtifactType]

export const JobState = { QUEUED: 'QUEUED', RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', DEAD: 'DEAD' } as const
export type JobState = (typeof JobState)[keyof typeof JobState]

/** §14.1 — the only event types clients may send through `trackEvents`. */
export const LearningEventType = {
  NOTE_OPENED: 'NOTE_OPENED', NOTE_CREATED: 'NOTE_CREATED', NOTE_PUBLISHED: 'NOTE_PUBLISHED', NOTE_FORKED: 'NOTE_FORKED',
  CARD_VIEWED: 'CARD_VIEWED', TOPIC_VIEWED: 'TOPIC_VIEWED', VIDEO_STARTED: 'VIDEO_STARTED', VIDEO_COMPLETED: 'VIDEO_COMPLETED',
  QUIZ_STARTED: 'QUIZ_STARTED', QUIZ_COMPLETED: 'QUIZ_COMPLETED', FLASHCARD_REVIEWED: 'FLASHCARD_REVIEWED',
  TIME_SPENT: 'TIME_SPENT', NOTE_SAVED: 'NOTE_SAVED', TOPIC_REVISITED: 'TOPIC_REVISITED', EXAM_CREATED: 'EXAM_CREATED',
  RESOURCE_VIEWED: 'RESOURCE_VIEWED', RESOURCE_SAVED: 'RESOURCE_SAVED', AI_REQUESTED: 'AI_REQUESTED',
  SEARCH_PERFORMED: 'SEARCH_PERFORMED',
} as const
export type LearningEventType = (typeof LearningEventType)[keyof typeof LearningEventType]

export const Platform = { WEB: 'WEB', ANDROID: 'ANDROID', IOS: 'IOS' } as const
export type Platform = (typeof Platform)[keyof typeof Platform]

export const ResourceType = { BOOK: 'BOOK', COURSE: 'COURSE', TOOL: 'TOOL', SOFTWARE: 'SOFTWARE', HARDWARE: 'HARDWARE', OTHER: 'OTHER' } as const
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType]

export const ResourceStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const
export type ResourceStatus = (typeof ResourceStatus)[keyof typeof ResourceStatus]

export const ReportReason = {
  HARASSMENT: 'HARASSMENT', SEXUAL: 'SEXUAL', SELF_HARM: 'SELF_HARM', HATE: 'HATE', SPAM: 'SPAM', COPYRIGHT: 'COPYRIGHT', OTHER: 'OTHER',
} as const
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason]

export const ModerationActionType = { HIDE: 'hide', REMOVE: 'remove', WARN: 'warn', SUSPEND: 'suspend', DISMISS: 'dismiss' } as const
export type ModerationActionType = (typeof ModerationActionType)[keyof typeof ModerationActionType]

export const enumValues = values

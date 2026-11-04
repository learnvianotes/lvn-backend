import type { FilePurposeKind } from './files'

/** Counts for the platform-admin dashboard (ADR-0101, ADR-0105, ADR-0106). No personal data: totals only. */

/**
 * Whole calendar days in one time zone (ADR-0105). `from` is midnight at the start of `fromDay` and `to` midnight after
 * `toDay` (exclusive), both as instants. Days are YYYY-MM-DD.
 */
export interface AdminDayWindow {
  from: Date
  to: Date
  fromDay: string
  toDay: string
  timeZone: string
}

export const NOTES_ADMIN_STATS = Symbol('NOTES_ADMIN_STATS')

/**
 * One count for one day (ADR-0106). `metric` names what is counted and `dimension` is a breakdown key ('' when there
 * is none). Zero counts are left out. The users context keeps these in users.daily_metrics: counts only, never an
 * account id or free text.
 */
export interface AdminDailyCount {
  day: string
  metric: string
  dimension: string
  value: number
}

/** The per-day counts NotesAdminStats.dailyCounts returns (ADR-0106). Days are days of the window's time zone. */
export const NOTES_DAILY_METRICS = {
  /** Notes created that day and not deleted, by visibility now (PUBLIC, UNLISTED, SHARED, PRIVATE). Study pages are left out. */
  notesCreated: 'notes_created',
  /** Scan results (clean, infected, failed, pending) of files people uploaded that day that are still stored; not exports. */
  uploadScans: 'upload_scans',
  /** Direct shares with one person (not the CONNECTIONS fan-out rows). */
  noteShares: 'note_shares',
  /** Shares to a group or class. */
  placeShares: 'place_shares',
  saves: 'saves',
} as const

/** Files people uploaded in a window that are still stored (the upload arrived). Server-made exports are left out. */
export interface NotesUploadStats {
  files: number
  bytes: bigint
  /** `users` is distinct uploaders over the whole window: the small-group rule needs it, so it is never summed from days. */
  byPurpose: { purpose: FilePurposeKind; files: number; bytes: bigint; users: number }[]
}

export interface SubjectActivity {
  subjectId: string
  title: string
  /** Notes created, or saves made, in the window. */
  value: number
  /** Distinct note owners, or savers. */
  users: number
}

export interface NotesAdminStats {
  counts(): Promise<{
    notes: number
    publicNotes: number
    subjects: number
    topics: number
    /** Files that occupy storage. Pending, failed and deleted are left out. */
    storageFiles: number
    storageBytes: bigint
    /** Remote scans that have not finished. */
    pendingScans: number
    /** Remote scans that used up their attempts. */
    failedScans: number
  }>
  /** NOTES_DAILY_METRICS for each day of the window. */
  dailyCounts(window: AdminDayWindow): Promise<AdminDailyCount[]>
  /** Uploads in the window, by purpose with distinct uploaders. */
  uploads(window: AdminDayWindow): Promise<NotesUploadStats>
  /** Per subject: notes created in the window (NOTES) or saves made in it (SAVES). A note counts once per subject. */
  subjectActivity(window: AdminDayWindow, by: 'NOTES' | 'SAVES'): Promise<SubjectActivity[]>
  /** The subject of each learning topic key (`topic:<id>`, `core:<subject>/<topic>`). Unknown keys are left out. */
  subjectsOfTopicKeys(keys: string[]): Promise<{ key: string; subjectId: string; title: string }[]>
  /** Each person's first note (any kind, deleted ones too; not the synced study pages), for these people. */
  firstNotes(userIds: string[]): Promise<{ userId: string; at: Date }[]>
}

export const AI_ADMIN_STATS = Symbol('AI_ADMIN_STATS')

export interface AiUsageSlice {
  provider: string
  model: string
  task: string
  tasks: number
  failures: number
  promptTokens: bigint
  completionTokens: bigint
  costMicroUsd: bigint
}

export interface AiAdminStats {
  /** One row per provider, model and task in `[from, to)`. */
  usage(from: Date, to: Date): Promise<AiUsageSlice[]>
}

export const CORE_ADMIN_STATS = Symbol('CORE_ADMIN_STATS')

/** The per-day counts CoreAdminStats.dailyCounts returns (ADR-0106). */
export const CORE_DAILY_METRICS = {
  /** LearningDay.learningSeconds (focus, reviews, quizzes) on the learner's own day; imported old-site time left out. */
  learningSeconds: 'learning_seconds',
  /** Doubts asked that day and not deleted. */
  doubtsAsked: 'doubts_asked',
  /** Doubts whose first answer from someone other than the asker came that day (doubt and answer not deleted). */
  doubtsAnswered: 'doubts_answered',
  /** The same doubts by milliseconds from asking to that first answer: `dimension` is the duration, `value` the doubts. */
  firstAnswerMs: 'doubt_first_answer_ms',
  doubtsResolved: 'doubts_resolved',
  /** Answers posted that day (answer and doubt not deleted). */
  doubtAnswers: 'doubt_answers',
  /** Class-quiz and shared-quiz attempts submitted. */
  quizAttempts: 'quiz_attempts',
  /** Groups, classes and their posts created that day and not deleted. */
  groups: 'groups_created',
  classrooms: 'classrooms_created',
  groupPosts: 'group_posts',
  classroomPosts: 'classroom_posts',
} as const

export interface CoreAdminStats {
  counts(): Promise<{ openReports: number; openAppeals: number; groups: number; classrooms: number }>
  /** CORE_DAILY_METRICS for each day of the window. Learning is counted on the stored day, fromDay to toDay. */
  dailyCounts(window: AdminDayWindow): Promise<AdminDailyCount[]>
  /** Who recorded learning activity on each day from `fromDay` to `toDay` (inclusive), by the learner's own day. */
  learnerDays(fromDay: string, toDay: string): Promise<{ day: string; userIds: string[] }[]>
  /** The topic keys people spent time on from `fromDay` to `toDay`. */
  learningTopicKeys(fromDay: string, toDay: string): Promise<string[]>
  /** Seconds and distinct people per group of topic keys from `fromDay` to `toDay`. A key belongs to one group. */
  learningByGroup(fromDay: string, toDay: string, groups: { key: string; group: string }[]): Promise<{ group: string; seconds: number; users: number }[]>
  /** Each person's first learning day on or after the day given, for those who have one. */
  firstLearningDays(after: { userId: string; onOrAfter: string }[]): Promise<{ userId: string; day: string }[]>
}

import type { FilePurposeKind } from './files'

/** Counts for the platform-admin dashboard (ADR-0101, ADR-0105). No personal data: totals only. */

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

export interface NotesContentStats {
  /** Notes created in the window that are not deleted, by their visibility now. Synced study pages are left out. */
  notes: { created: number; public: number; unlisted: number; shared: number; private: number }
  /** Files people uploaded in the window (the upload arrived). Server-made exports are left out. */
  uploads: { files: number; bytes: bigint; byPurpose: { purpose: FilePurposeKind; files: number; bytes: bigint; users: number }[] }
  /** Scan results of the files uploaded in the window. `failed` is ERROR or FAILED. */
  scans: { clean: number; infected: number; failed: number; pending: number }
  /** Direct shares with a person, shares to a group or class, and saves, made in the window. */
  sharing: { noteShares: number; placeShares: number; saves: number }
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
  /** Notes created each day of the window (not deleted, not the synced study pages). Days with none are left out. */
  notesPerDay(window: AdminDayWindow): Promise<{ day: string; notes: number }[]>
  /** What was created in the window. */
  content(window: AdminDayWindow): Promise<NotesContentStats>
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

export interface CoreContentStats {
  /**
   * Doubts asked in the window; doubts whose first answer (by someone other than the asker) came in it; doubts resolved
   * in it; answers posted in it; and the median hours from asking to that first answer, for those answered in it.
   */
  doubts: { asked: number; answered: number; resolved: number; answers: number; medianHoursToFirstAnswer: number | null }
  /** Groups, classes and their posts created in the window and not deleted. */
  places: { groups: number; classrooms: number; groupPosts: number; classroomPosts: number }
}

export interface CoreAdminStats {
  counts(): Promise<{ openReports: number; openAppeals: number; groups: number; classrooms: number }>
  /**
   * Per day of the window: learning seconds (LearningDay, by the learner's own day), doubts asked, doubts first
   * answered, and quiz attempts (class and shared quizzes). Days with nothing are left out.
   */
  activityPerDay(window: AdminDayWindow): Promise<{ day: string; learningSeconds: number; doubtsAsked: number; doubtsAnswered: number; quizAttempts: number }[]>
  /** Who recorded learning activity on each day from `fromDay` to `toDay` (inclusive), by the learner's own day. */
  learnerDays(fromDay: string, toDay: string): Promise<{ day: string; userIds: string[] }[]>
  content(window: AdminDayWindow): Promise<CoreContentStats>
  /** The topic keys people spent time on from `fromDay` to `toDay`. */
  learningTopicKeys(fromDay: string, toDay: string): Promise<string[]>
  /** Seconds and distinct people per group of topic keys from `fromDay` to `toDay`. A key belongs to one group. */
  learningByGroup(fromDay: string, toDay: string, groups: { key: string; group: string }[]): Promise<{ group: string; seconds: number; users: number }[]>
  /** Each person's first learning day on or after the day given, for those who have one. */
  firstLearningDays(after: { userId: string; onOrAfter: string }[]): Promise<{ userId: string; day: string }[]>
}

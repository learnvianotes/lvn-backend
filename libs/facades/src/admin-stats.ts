/** Counts for the platform-admin dashboard (ADR-0101). No personal data: totals only. */

export const NOTES_ADMIN_STATS = Symbol('NOTES_ADMIN_STATS')

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

export interface CoreAdminStats {
  counts(): Promise<{ openReports: number; openAppeals: number; groups: number; classrooms: number }>
}

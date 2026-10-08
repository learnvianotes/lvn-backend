import { z } from 'zod'

/**
 * Snapshots of the old learnvianotes.in data (ADR-0023), written once per user by the snapshot job into the
 * restricted bucket and read by the contexts that import their part (users matches accounts, core imports progress,
 * notes imports personal notes). Mirrors the old Firestore layout (old repo schema/firestore.ts, schema version 1).
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const legacyProgress = z.object({
  /** problemId → mark */
  problems: z.record(z.string(), z.enum(['solved', 'revisit'])).default({}),
  /** 'subjectId/topicId' → read to the end */
  topics: z.record(z.string(), z.literal(true)).default({}),
  /** 'subjectId/topicId' → to revisit */
  revisitTopics: z.record(z.string(), z.literal(true)).default({}),
  /** day → items completed */
  studied: z.record(day, z.number()).default({}),
})

export const legacyUserSnapshot = z.object({
  version: z.literal(1),
  uid: z.string().min(1),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  /** Firebase sign-in providers, e.g. "google.com", "password" */
  providers: z.array(z.string()),
  user: z
    .object({
      progress: legacyProgress,
      prefs: z.object({ interests: z.array(z.string()).default([]), dailyGoal: z.number().optional(), subjectOrder: z.array(z.string()).default([]) }).partial().optional(),
    })
    .nullable(),
  /** day → topic key → time studied that day */
  days: z.record(
    day,
    z.object({
      topics: z.record(z.string(), z.object({ title: z.string(), subject: z.string(), sec: z.number().min(0), visits: z.number().min(0), last: z.number() })).default({}),
      focus: z.number().min(0).default(0),
    }),
  ),
  notes: z.array(z.object({ key: z.string(), text: z.string(), updatedAt: z.number() })),
})
export type LegacyUserSnapshot = z.infer<typeof legacyUserSnapshot>

export const legacyIndex = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  users: z.array(z.object({ uid: z.string().min(1), email: z.string().nullable(), emailVerified: z.boolean(), providers: z.array(z.string()) })),
})
export type LegacyIndex = z.infer<typeof legacyIndex>

/** What a returning learner is shown before claiming (skeleton LegacyCounts). */
export interface LegacyCounts {
  notes: number
  completedTopics: number
  markedProblems: number
  studyDays: number
  studyMinutes: number
}

export function countsOf(s: LegacyUserSnapshot): LegacyCounts {
  const seconds = Object.values(s.days).reduce((sum, d) => sum + d.focus + Object.values(d.topics).reduce((t, v) => t + v.sec, 0), 0)
  return {
    notes: s.notes.filter((n) => n.text.trim()).length,
    completedTopics: Object.keys(s.user?.progress.topics ?? {}).length,
    markedProblems: Object.keys(s.user?.progress.problems ?? {}).length,
    studyDays: new Set([...Object.keys(s.days), ...Object.keys(s.user?.progress.studied ?? {})]).size,
    studyMinutes: Math.round(seconds / 60),
  }
}

/** Whether a snapshot holds anything worth offering. */
export const isEmpty = (c: LegacyCounts): boolean => !c.notes && !c.completedTopics && !c.markedProblems && !c.studyDays

import { LimitKey, type LimitKey as LimitKeyName } from './enums'

/** Every limit, in a stable order for plan cards and usage. */
export const LIMIT_KEYS: readonly LimitKeyName[] = Object.values(LimitKey)

/**
 * Words a person sees on a plan card and in the limit error.
 * The message is `You've reached your plan's limit for <label>.`
 */
export const LIMIT_LABELS: Record<LimitKeyName, string> = {
  STORAGE_BYTES: 'storage',
  AI_TOKENS_DAILY: 'AI tokens a day',
  AI_REQUESTS_DAILY: 'AI asks a day',
  PDF_PAGES_MONTHLY: 'PDF pages a month',
  GROUPS_OWNED: 'groups',
  GROUP_MEMBERS: 'group members',
  CLASSROOMS_OWNED: 'classes',
  CLASSROOM_MEMBERS: 'class members',
  PROJECT_WORKSPACES: 'project workspaces',
  EXPORTS_DAILY: 'exports a day',
  IMPORTS_DAILY: 'imports a day',
  ORG_SEATS: 'organisation seats',
  NOTES_OWNED: 'notes',
}

export const PLAN_LIMIT_MESSAGE_PREFIX = "You've reached your plan's limit for "

/** DAY and MONTH counters go back to zero; the rest are standing caps. */
export type LimitPeriod = 'DAY' | 'MONTH'

export const LIMIT_PERIOD: Record<LimitKeyName, LimitPeriod | null> = {
  STORAGE_BYTES: null,
  AI_TOKENS_DAILY: 'DAY',
  AI_REQUESTS_DAILY: 'DAY',
  PDF_PAGES_MONTHLY: 'MONTH',
  GROUPS_OWNED: null,
  GROUP_MEMBERS: null,
  CLASSROOMS_OWNED: null,
  CLASSROOM_MEMBERS: null,
  PROJECT_WORKSPACES: null,
  EXPORTS_DAILY: 'DAY',
  IMPORTS_DAILY: 'DAY',
  ORG_SEATS: null,
  NOTES_OWNED: null,
}

export const limitLabel = (key: LimitKeyName): string => LIMIT_LABELS[key]

export const limitPeriod = (key: LimitKeyName): LimitPeriod | null => LIMIT_PERIOD[key]

export const planLimitMessage = (key: LimitKeyName): string => `${PLAN_LIMIT_MESSAGE_PREFIX}${LIMIT_LABELS[key]}.`

/** Start of the current UTC day. Daily counters (AI, exports, imports) use this window. */
export const startOfUtcDay = (now = new Date()): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

/** Start of the current UTC month. PDF pages use this window. */
export const startOfUtcMonth = (now = new Date()): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

export const nextUtcMidnight = (now = new Date()): Date => new Date(startOfUtcDay(now).getTime() + 86_400_000)

export const nextUtcMonth = (now = new Date()): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

/** Seconds until `when`, at least 1 so a client can show a retry delay. */
export const secondsUntil = (when: Date, now = new Date()): number => Math.max(1, Math.ceil((when.getTime() - now.getTime()) / 1000))

/**
 * True when accepting `adding` more (1 for a new note, group, or request; the file size for storage)
 * would pass the cap. A null limit is unlimited and never exceeds.
 */
export const exceedsPlanLimit = (limit: bigint | null, used: bigint, adding: bigint = 1n): boolean => limit !== null && used + adding > limit

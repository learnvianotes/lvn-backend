import { Injectable } from '@nestjs/common'
import type { NotificationCategory } from '@lvn/contracts/notifications'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'

/** The categories a person can set today; categories of later phases join when they ship (ADR-0050). */
export const SETTABLE: NotificationCategory[] = ['SHARE', 'COMMENT', 'FOLLOW', 'CONNECTION', 'JOIN_REQUEST', 'JOIN_DECISION', 'CLASSROOM_INVITE', 'CLASSROOM_POST', 'QUIZ_PUBLISHED', 'MENTOR_INVITE', 'DOUBT', 'MENTION', 'VERIFICATION', 'DATA_EXPORT', 'NOTES_IMPORT', 'REVISION_REMINDER', 'RHYTHM_BUDDY']
/** Categories that also send email; the weekly digest is a setting of its own. */
export const EMAILED: ReadonlySet<NotificationCategory> = new Set(['CLASSROOM_POST'])
export const DEFAULTS = { quietStart: '22:00', quietEnd: '07:00', timeZone: 'Asia/Kolkata', weeklyDigest: true } as const

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export interface Settings {
  quietStart: string
  quietEnd: string
  timeZone: string
  weeklyDigest: boolean
  categories: { category: NotificationCategory; push: boolean; email: boolean | null }[]
}

/** The time of day in a time zone, as HH:MM. */
export function localTime(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}

/** Inside quiet hours: from start up to end, across midnight when start is later; none when they are equal. */
export function inQuietHours(time: string, start: string, end: string): boolean {
  if (start === end) return false
  return start < end ? time >= start && time < end : time >= start || time < end
}

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Notification preferences (ADR-0050): push per category, email for class announcements and the weekly digest, quiet
 * hours in the person's time zone. Only what differs from the defaults is stored.
 */
@Injectable()
export class PreferencesService {
  constructor(private readonly db: PrismaService) {}

  async settings(userId: string): Promise<Settings> {
    const [row, prefs] = await Promise.all([this.db.notificationSettings.findUnique({ where: { userId } }), this.db.notificationPreference.findMany({ where: { userId } })])
    const pref = new Map(prefs.map((p) => [p.category as NotificationCategory, p]))
    return {
      quietStart: row?.quietStart ?? DEFAULTS.quietStart,
      quietEnd: row?.quietEnd ?? DEFAULTS.quietEnd,
      timeZone: row?.timeZone ?? DEFAULTS.timeZone,
      weeklyDigest: row?.weeklyDigest ?? DEFAULTS.weeklyDigest,
      categories: SETTABLE.map((category) => ({ category, push: pref.get(category)?.push ?? true, email: EMAILED.has(category) ? (pref.get(category)?.email ?? true) : null })),
    }
  }

  async update(userId: string, input: { categories?: { category: NotificationCategory; push?: boolean | null; email?: boolean | null }[] | null; quietStart?: string | null; quietEnd?: string | null; timeZone?: string | null; weeklyDigest?: boolean | null }): Promise<Settings> {
    for (const [field, v] of [['quietStart', input.quietStart], ['quietEnd', input.quietEnd]] as const) {
      if (v != null && !HHMM.test(v)) throw Errors.validation('Use a time like 22:00.', ['input', field])
    }
    if (input.timeZone != null && !validZone(input.timeZone)) throw Errors.validation('Choose a time zone from the list.', ['input', 'timeZone'])
    const settings = { ...(input.quietStart != null ? { quietStart: input.quietStart } : {}), ...(input.quietEnd != null ? { quietEnd: input.quietEnd } : {}), ...(input.timeZone != null ? { timeZone: input.timeZone } : {}), ...(input.weeklyDigest != null ? { weeklyDigest: input.weeklyDigest } : {}) }
    if (Object.keys(settings).length) await this.db.notificationSettings.upsert({ where: { userId }, create: { userId, ...settings }, update: settings })
    for (const c of input.categories ?? []) {
      if (!SETTABLE.includes(c.category)) throw Errors.validation('That kind of notification cannot be set yet.', ['input', 'categories'])
      const data = { ...(c.push != null ? { push: c.push } : {}), ...(c.email != null && EMAILED.has(c.category) ? { email: c.email } : {}) }
      if (Object.keys(data).length) await this.db.notificationPreference.upsert({ where: { userId_category: { userId, category: c.category } }, create: { userId, category: c.category, ...data }, update: data })
    }
    return this.settings(userId)
  }

  /** Push for this category now: on for the category and outside quiet hours. */
  async pushAllowed(userId: string, category: NotificationCategory, at = new Date()): Promise<boolean> {
    const [row, pref] = await Promise.all([this.db.notificationSettings.findUnique({ where: { userId } }), this.db.notificationPreference.findUnique({ where: { userId_category: { userId, category } } })])
    if (pref?.push === false) return false
    const tz = row?.timeZone ?? DEFAULTS.timeZone
    return !inQuietHours(localTime(at, tz), row?.quietStart ?? DEFAULTS.quietStart, row?.quietEnd ?? DEFAULTS.quietEnd)
  }

  async emailAllowed(userId: string, kind: 'CLASSROOM_POST' | 'DIGEST'): Promise<boolean> {
    if (kind === 'DIGEST') return (await this.db.notificationSettings.findUnique({ where: { userId } }))?.weeklyDigest ?? DEFAULTS.weeklyDigest
    return (await this.db.notificationPreference.findUnique({ where: { userId_category: { userId, category: kind } } }))?.email ?? true
  }

  /** One-click unsubscribe (ADR-0050): turns off one kind of email. */
  async stopEmail(userId: string, kind: 'CLASSROOM_POST' | 'DIGEST'): Promise<void> {
    if (kind === 'DIGEST') await this.db.notificationSettings.upsert({ where: { userId }, create: { userId, weeklyDigest: false }, update: { weeklyDigest: false } })
    else await this.db.notificationPreference.upsert({ where: { userId_category: { userId, category: kind } }, create: { userId, category: kind, email: false }, update: { email: false } })
  }
}

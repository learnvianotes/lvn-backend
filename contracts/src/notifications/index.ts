import { z } from 'zod'
import { enumValues } from '../domain/enums'

/**
 * Push notifications (spec §9.3, ADR-0021). Delivered through Firebase Cloud Messaging — Android directly, iOS via
 * APNs — and nothing else of Firebase. The payload carries ids only: the app fetches the content over the API, so
 * permission checks happen on that fetch (§9.2) and no note, comment or message text passes through Google.
 */

export const NotificationCategory = {
  COMMENT: 'COMMENT', SHARE: 'SHARE', CLASSROOM_POST: 'CLASSROOM_POST', QUIZ_PUBLISHED: 'QUIZ_PUBLISHED',
  REVISION_REMINDER: 'REVISION_REMINDER', STREAK_AT_RISK: 'STREAK_AT_RISK', JOIN_REQUEST: 'JOIN_REQUEST',
  JOIN_DECISION: 'JOIN_DECISION', FOLLOW: 'FOLLOW', CONNECTION: 'CONNECTION', MENTOR_INVITE: 'MENTOR_INVITE',
  DOUBT: 'DOUBT', FORK_PUBLISHED: 'FORK_PUBLISHED', VERIFICATION: 'VERIFICATION', DATA_EXPORT: 'DATA_EXPORT',
  NOTES_IMPORT: 'NOTES_IMPORT',
} as const
export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory]

const DEEP_LINK = /^(learnvianotes:\/\/|https:\/\/(sandbox\.)?learnvianotes\.com\/)/

/** The FCM `data` block. Strict: any extra key (for example, smuggled content) is rejected. */
export const pushData = z
  .object({
    notificationId: z.uuid(),
    category: z.enum(enumValues(NotificationCategory)),
    deepLink: z.string().regex(DEEP_LINK, 'must be a learnvianotes:// or learnvianotes.com link'),
  })
  .strict()
export type PushData = z.infer<typeof pushData>

/**
 * The whole message. Title and body are short, generated server-side, and never quote note, comment or message
 * text ("Priya commented on your note", not the comment). Restricted minors get generic text.
 */
export const pushMessage = z
  .object({
    title: z.string().min(1).max(65),
    body: z.string().max(120),
    data: pushData,
  })
  .strict()
export type PushMessage = z.infer<typeof pushMessage>

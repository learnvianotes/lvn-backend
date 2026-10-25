/** Event names the ingest endpoint accepts. Anything else is refused. */

export const USAGE_EVENT_NAMES = ['page_view', 'note_open', 'note_upload', 'search', 'download', 'sign_in'] as const

export type UsageEventName = (typeof USAGE_EVENT_NAMES)[number]

const ALLOWED = new Set<string>(USAGE_EVENT_NAMES)

export const isUsageEventName = (name: string): name is UsageEventName => ALLOWED.has(name)

export const MAX_ANALYTICS_BATCH = 40
export const MAX_ANALYTICS_PROPS_CHARS = 1024
export const USAGE_RETENTION_DAYS = 180
export const ERROR_RETENTION_DAYS = 90

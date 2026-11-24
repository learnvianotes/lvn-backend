import { USAGE_EVENT_LIMITS } from '@lvn/contracts/domain'

/**
 * Event names the ingest endpoint accepts; anything else is refused. The list, the values props may carry and the
 * props rules live in @lvn/contracts (ADR-0107) so web, mobile and the API read one definition.
 */
export { isUsageEventName, USAGE_EVENT_NAMES, type UsageEventName } from '@lvn/contracts/domain'

export const MAX_ANALYTICS_BATCH = USAGE_EVENT_LIMITS.batch
export const USAGE_RETENTION_DAYS = USAGE_EVENT_LIMITS.retentionDays
export const ERROR_RETENTION_DAYS = 90

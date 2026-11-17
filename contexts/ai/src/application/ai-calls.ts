import { Errors } from '@lvn-backend/errors'
import type { RateLimiter } from '@lvn-backend/redis'

/** Per person, checked before the AI gateway. The monthly budget inside the gateway is unchanged. */
export const AI_CALLS_PER_MINUTE = { max: 5, windowSeconds: 60 }
export const AI_CALLS_PER_HOUR = { max: 30, windowSeconds: 60 * 60 }

/**
 * `ai-min` first, so a burst that the minute cap refuses does not also spend the hour.
 * The minute key is `ai-min:${userId}`; the hour key is `ai:${userId}`.
 */
export async function limitAiCalls(limiter: RateLimiter, userId: string): Promise<void> {
  const minute = await limiter.hit(`ai-min:${userId}`, AI_CALLS_PER_MINUTE)
  if (!minute.allowed) throw Errors.rateLimited(minute.retryAfter, `Too many AI requests. Try again in ${minute.retryAfter} seconds.`)
  const hour = await limiter.hit(`ai:${userId}`, AI_CALLS_PER_HOUR)
  if (!hour.allowed) throw Errors.rateLimited(hour.retryAfter, `Too many AI requests this hour. Try again in ${hour.retryAfter} seconds.`)
}

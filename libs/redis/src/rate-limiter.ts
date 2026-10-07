import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS } from './tokens'

export interface Limit {
  /** Attempts allowed in the window */
  max: number
  windowSeconds: number
}

export interface LimitResult {
  allowed: boolean
  /** Seconds until the oldest counted attempt leaves the window (when refused) */
  retryAfter: number
  remaining: number
}

/**
 * Drop attempts older than the window, count, and record this attempt only if it is within the limit — atomically,
 * so concurrent requests cannot slip past it. Returns {allowed, count-or-oldest-score}.
 */
const SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {0, tonumber(oldest[2])}
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return {1, count + 1}
`

/** Sliding-window rate limits in Redis (§7.1). Refused attempts are not counted. */
@Injectable()
export class RateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async hit(key: string, limit: Limit, now = Date.now()): Promise<LimitResult> {
    const windowMs = limit.windowSeconds * 1000
    const [allowed, value] = (await this.redis.eval(SLIDING_WINDOW, 1, `rl:${key}`, now, windowMs, limit.max, `${now}:${randomUUID()}`)) as [number, number]
    if (allowed === 1) return { allowed: true, retryAfter: 0, remaining: limit.max - value }
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((value + windowMs - now) / 1000)), remaining: 0 }
  }

  /** Forgets every attempt for a key (e.g. after a successful sign-in). */
  async reset(key: string): Promise<void> {
    await this.redis.del(`rl:${key}`)
  }
}

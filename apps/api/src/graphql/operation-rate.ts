import type { RequestContext } from '@lvn-backend/auth-guard'
import { ANONYMOUS_OPERATIONS_PER_MINUTE, OPERATIONS_PER_MINUTE } from '@lvn-backend/graphql'
import { clientNetwork, type RateLimiter } from '@lvn-backend/redis'

type Hit = Pick<RateLimiter, 'hit'>

/**
 * Seconds until this GraphQL operation may run, or null when it may.
 *
 * Signed-in callers are `gql:${userId}` at OPERATIONS_PER_MINUTE. Anonymous callers are `gql-ip:${network}` at
 * ANONYMOUS_OPERATIONS_PER_MINUTE (one IPv4, or an IPv6 /64). No address: nothing to key, so the other caps still apply.
 *
 * A signed-in caller's refusal is also a strike (`onRefused`, ADR-0116).
 *
 * Fail open when Redis is down. A Redis outage must not refuse everyone; the edge still stops floods.
 */
export async function graphqlOperationRetryAfter(limiter: Hit, ctx: RequestContext, onRefused?: (ctx: RequestContext) => Promise<void>): Promise<number | null> {
  try {
    if (ctx.viewer) {
      const hit = await limiter.hit(`gql:${ctx.viewer.userId}`, { max: OPERATIONS_PER_MINUTE, windowSeconds: 60 })
      if (!hit.allowed && onRefused) await onRefused(ctx).catch(() => undefined)
      return hit.allowed ? null : hit.retryAfter
    }
    const network = clientNetwork(ctx.req.ip)
    if (!network) return null
    const hit = await limiter.hit(`gql-ip:${network}`, { max: ANONYMOUS_OPERATIONS_PER_MINUTE, windowSeconds: 60 })
    return hit.allowed ? null : hit.retryAfter
  } catch {
    return null
  }
}

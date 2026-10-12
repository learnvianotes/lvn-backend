import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS } from '@lvn-backend/redis'
import { liveEvent, type LiveEvent } from '@lvn/contracts/notifications'

/** What travels on a viewer's channel: an event for their sockets, or the end of one of their sessions. */
export type LiveMessage = { type: 'event'; event: LiveEvent } | { type: 'revoke'; sessionId: string }
export type LiveListener = (message: LiveMessage) => void

const channel = (userId: string) => `live:user:${userId}`

/**
 * Fan-out between processes (§9.2, ADR-0042): one Redis channel per viewer. Anything may publish (the API, the
 * worker); an API instance listens to a viewer's channel only while it holds one of their sockets, on one extra
 * connection, since a Redis connection in subscriber mode can do nothing else.
 */
@Injectable()
export class LiveHub implements OnModuleDestroy {
  private readonly log = new Logger('LiveHub')
  private subscriber?: Redis
  private readonly listeners = new Map<string, Set<LiveListener>>()

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async publish(userId: string, message: LiveMessage): Promise<void> {
    await this.redis.publish(channel(userId), JSON.stringify(message))
  }

  /** Delivers this viewer's messages to `listener` until the returned function is called. */
  async listen(userId: string, listener: LiveListener): Promise<() => Promise<void>> {
    const sub = this.subscriberConnection()
    let set = this.listeners.get(userId)
    if (!set) {
      set = new Set()
      this.listeners.set(userId, set)
      await sub.subscribe(channel(userId))
    }
    set.add(listener)
    const mine = set
    return async () => {
      mine.delete(listener)
      if (mine.size || this.listeners.get(userId) !== mine) return
      this.listeners.delete(userId)
      await sub.unsubscribe(channel(userId)).catch(() => undefined)
    }
  }

  private subscriberConnection(): Redis {
    if (this.subscriber) return this.subscriber
    const sub = this.redis.duplicate()
    sub.on('message', (name: string, raw: string) => {
      const userId = name.slice('live:user:'.length)
      const message = parse(raw)
      if (!message) return this.log.warn(`dropped a malformed message on ${name}`)
      for (const listener of this.listeners.get(userId) ?? []) listener(message)
    })
    sub.on('error', (err: Error) => this.log.error(`subscriber: ${err.message}`))
    this.subscriber = sub
    return sub
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => this.subscriber?.disconnect())
  }
}

function parse(raw: string): LiveMessage | null {
  try {
    const m = JSON.parse(raw) as { type?: unknown; event?: unknown; sessionId?: unknown }
    if (m.type === 'revoke' && typeof m.sessionId === 'string') return { type: 'revoke', sessionId: m.sessionId }
    if (m.type === 'event') {
      const event = liveEvent.safeParse(m.event)
      if (event.success) return { type: 'event', event: event.data }
    }
  } catch {
    // fall through
  }
  return null
}

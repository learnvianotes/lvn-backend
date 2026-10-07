import { randomUUID } from 'node:crypto'
import { Global, Injectable, Logger, Module } from '@nestjs/common'
import { parseEvent, type EventName, type EventOf } from '@lvn/contracts/events'

export const EVENT_BUS = Symbol('EVENT_BUS')

export type Payload<N extends EventName> = EventOf<N>['payload']
export type Handler<N extends EventName> = (event: EventOf<N>) => Promise<void> | void

/**
 * Integration events between contexts (spec §6, §6.5 step 2). Contexts depend on this interface only; the in-process
 * adapter runs today and a NATS JetStream adapter with the same payloads replaces it per extracted context.
 */
export interface EventBus {
  publish<N extends EventName>(type: N, payload: Payload<N>, options?: { correlationId?: string }): Promise<void>
  subscribe<N extends EventName>(type: N, handler: Handler<N>): void
}

/**
 * Validates every event against `@lvn/contracts/events` before delivery and hands it to subscribers after the
 * publisher's call returns, so a slow or failing consumer never fails the publishing request. Failures are logged.
 */
@Injectable()
export class InProcessEventBus implements EventBus {
  private readonly log = new Logger('EventBus')
  private readonly handlers = new Map<EventName, Handler<EventName>[]>()
  private readonly inFlight = new Set<Promise<void>>()

  async publish<N extends EventName>(type: N, payload: Payload<N>, options: { correlationId?: string } = {}): Promise<void> {
    const event = parseEvent(type, {
      id: randomUUID(),
      type,
      version: 1,
      occurredAt: new Date().toISOString(),
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      payload,
    })
    for (const handler of this.handlers.get(type) ?? []) {
      // Next macrotask: the publisher's request finishes first, whatever the handler does.
      const run = new Promise<void>((resolve) => setImmediate(resolve))
        .then(() => (handler as Handler<N>)(event))
        .catch((err: unknown) => this.log.error(`${type} handler failed: ${err instanceof Error ? err.message : String(err)}`))
        .finally(() => this.inFlight.delete(run))
      this.inFlight.add(run)
    }
  }

  subscribe<N extends EventName>(type: N, handler: Handler<N>): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler as Handler<EventName>])
  }

  /** Resolves when every delivery started so far has finished (tests, graceful shutdown). */
  async drain(): Promise<void> {
    while (this.inFlight.size) await Promise.all([...this.inFlight])
  }
}

/** Registered once by each composition root. */
@Global()
@Module({ providers: [InProcessEventBus, { provide: EVENT_BUS, useExisting: InProcessEventBus }], exports: [EVENT_BUS, InProcessEventBus] })
export class EventBusModule {}

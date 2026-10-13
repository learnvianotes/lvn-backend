import { Injectable } from '@nestjs/common'
import type { LiveEventKind } from '@lvn/contracts/notifications'
import type { Live } from '@lvn-backend/facades'
import { LiveHub } from './live-hub'

/** The LIVE facade (ADR-0042, ADR-0060): a kind and an id to a viewer's open sockets, from the API or the worker. */
@Injectable()
export class LiveNotifier implements Live {
  constructor(private readonly hub: LiveHub) {}

  notify(userId: string, kind: LiveEventKind, id: string): Promise<void> {
    return this.hub.publish(userId, { type: 'event', event: { kind, id, at: new Date().toISOString() } })
  }
}

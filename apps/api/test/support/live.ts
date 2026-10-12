import type { AddressInfo } from 'node:net'
import { createClient } from 'graphql-ws'
import WebSocket from 'ws'
import type { LiveEvent } from '@lvn/contracts/notifications'
import type { TestApp } from './app'

/** The app listening on a free port, and its live-update URL (ADR-0042). */
export async function liveUrl(t: TestApp): Promise<string> {
  const server = t.app.getHttpServer() as { address(): AddressInfo | string | null; listening: boolean }
  if (!server.listening) await t.app.listen(0, '127.0.0.1')
  return `ws://127.0.0.1:${(server.address() as AddressInfo).port}/graphql/live`
}

export interface LiveSocket {
  events: LiveEvent[]
  /** Resolves with the first event matching, or rejects after `ms`. */
  next(match?: (e: LiveEvent) => boolean, ms?: number): Promise<LiveEvent>
  /** Resolves with the close code once the server closes the socket, or rejects after `ms`. */
  closed(ms?: number): Promise<number>
  close(): Promise<void>
}

/** A client of the live endpoint subscribed to `live`, without reconnecting, so tests see the server's close codes. */
export async function openLive(url: string, token?: string): Promise<LiveSocket> {
  const events: LiveEvent[] = []
  let closeCode: number | undefined
  const waiters = new Set<() => void>()
  const wake = () => waiters.forEach((w) => w())
  let connected!: () => void
  const ready = new Promise<void>((resolve) => (connected = resolve))
  const client = createClient({
    url,
    webSocketImpl: WebSocket,
    retryAttempts: 0,
    lazy: false,
    connectionParams: token ? { authorization: `Bearer ${token}` } : {},
    on: {
      connected: () => connected(),
      closed: (e) => {
        closeCode = (e as { code: number }).code
        connected()
        wake()
      },
    },
  })
  client.subscribe<{ live: LiveEvent }>({ query: 'subscription { live { kind id at } }' }, {
    next: (r) => {
      if (r.data) events.push(r.data.live)
      wake()
    },
    error: () => wake(),
    complete: () => wake(),
  })
  await ready
  const until = <T>(check: () => T | undefined, ms: number, what: string) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => (waiters.delete(test), reject(new Error(`no ${what} within ${ms} ms`))), ms)
      const test = () => {
        const v = check()
        if (v === undefined) return
        clearTimeout(timer)
        waiters.delete(test)
        resolve(v)
      }
      waiters.add(test)
      test()
    })
  return {
    events,
    next: (match = () => true, ms = 5000) => until(() => events.find(match), ms, 'live event'),
    closed: (ms = 5000) => until(() => closeCode, ms, 'close'),
    close: () => client.dispose() as Promise<void>,
  }
}

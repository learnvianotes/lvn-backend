import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { buildSchema } from 'graphql'
import { useServer } from 'graphql-ws/use/ws'
import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import { AccessTokenVerifier, TOKEN_AUDIENCE } from '@lvn-backend/auth-guard'
import { SessionRevocations } from '@lvn-backend/redis'
import type { LiveEvent } from '@lvn/contracts/notifications'
import { COMMUNICATION_CONFIG, type CommunicationConfig } from '../communication.config'
import { LiveHub } from './live-hub'
import { PushStream } from './stream'

/** Where live updates are served, on the API's own HTTP server (ADR-0042). */
export const LIVE_PATH = '/graphql/live'

/** The whole live schema: one subscription carrying a kind and an id (§9.2). */
export const LIVE_SDL = /* GraphQL */ `
  type Query {
    "Unused: this endpoint serves the live subscription only; everything else is at /graphql"
    ok: Boolean!
  }

  enum LiveEventKind {
    NOTIFICATION
    "An Ask AI answer of the viewer's has more text: refetch aiAnswer(id) (ADR-0060)"
    AI_ANSWER
  }

  "Something changed for the viewer: refetch it through /graphql"
  type LiveEvent {
    kind: LiveEventKind!
    id: String!
    at: String!
  }

  type Subscription {
    live: LiveEvent!
  }
`

/** Closed with this code for a bad, expired or revoked token; clients reconnect with a fresh one. */
export const LIVE_FORBIDDEN = 4403
/** Sockets one viewer may hold on one instance (tabs, devices). */
const SOCKETS_PER_VIEWER = 20

interface Connection {
  userId: string
  sessionId: string
  streams: Set<(event: LiveEvent) => void>
  /** Events that arrived after the handshake but before the first subscription started (at most a few) */
  early: LiveEvent[]
  stop?: () => Promise<void>
  timer?: NodeJS.Timeout
}

/**
 * The graphql-ws endpoint (§9.2, ADR-0042), API only. A socket authenticates with the access token in
 * `connection_init` (never a cookie), lives until that token expires or its session is revoked, and receives the
 * viewer's events from every instance through the LiveHub.
 */
@Injectable()
export class LiveServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Live')
  private readonly verifier: AccessTokenVerifier
  private readonly perViewer = new Map<string, number>()
  private wss?: WebSocketServer
  private dispose?: () => void | Promise<void>

  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly hub: LiveHub,
    private readonly revocations: SessionRevocations,
    @Inject(COMMUNICATION_CONFIG) config: CommunicationConfig,
  ) {
    this.verifier = new AccessTokenVerifier(config.jwtPublicKey, config.jwtIssuer, TOKEN_AUDIENCE)
  }

  onApplicationBootstrap(): void {
    const server = this.adapter.httpAdapter?.getHttpServer() as Server | undefined
    if (!server) return
    this.wss = new WebSocketServer({ server, path: LIVE_PATH, maxPayload: 64 * 1024 })
    const schema = buildSchema(LIVE_SDL)
    const disposable = useServer<Record<string, unknown>, { connection: Connection }>(
      {
        schema,
        roots: {
          query: { ok: true },
          subscription: {
            live: (_args: unknown, context: { connection: Connection }) => {
              const { connection } = context
              const push = (event: LiveEvent) => stream.push({ live: event })
              const stream = new PushStream<{ live: LiveEvent }>(() => connection.streams.delete(push))
              connection.streams.add(push)
              for (const event of connection.early.splice(0)) push(event)
              return stream
            },
          },
        },
        context: (ctx) => ({ connection: ctx.extra.connection }),
        onConnect: async (ctx) => {
          const connection = await this.authenticate(ctx.connectionParams?.authorization, ctx.extra.socket)
          if (!connection) return false
          ;(ctx.extra as { connection?: Connection }).connection = connection
          return true
        },
      },
      this.wss,
      30_000,
    )
    this.dispose = () => disposable.dispose()
  }

  private async authenticate(authorization: unknown, socket: WebSocket): Promise<Connection | null> {
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null
    const result = token ? this.verifier.verify(token) : null
    if (!result?.ok) return null
    const { sub: userId, sid: sessionId, exp } = result.claims
    if (await this.revocations.isRevoked(sessionId)) return null
    const open = this.perViewer.get(userId) ?? 0
    if (open >= SOCKETS_PER_VIEWER) return null
    this.perViewer.set(userId, open + 1)

    const connection: Connection = { userId, sessionId, streams: new Set(), early: [] }
    const close = (reason: string) => socket.readyState === socket.OPEN && socket.close(LIVE_FORBIDDEN, reason)
    connection.timer = setTimeout(() => close('Token expired'), Math.max(0, exp * 1000 - Date.now()))
    socket.once('close', () => {
      clearTimeout(connection.timer)
      const left = (this.perViewer.get(userId) ?? 1) - 1
      if (left > 0) this.perViewer.set(userId, left)
      else this.perViewer.delete(userId)
      void connection.stop?.()
    })
    connection.stop = await this.hub.listen(userId, (message) => {
      if (message.type === 'revoke') {
        if (message.sessionId === sessionId) close('Session ended')
        return
      }
      if (!connection.streams.size) {
        if (connection.early.push(message.event) > 20) connection.early.shift()
        return
      }
      for (const push of connection.streams) push(message.event)
    })
    // The socket may have closed while the listener was being set up.
    if (socket.readyState !== socket.OPEN) void connection.stop()
    return connection
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.wss) return
    for (const client of this.wss.clients) client.close(1001, 'Server going away')
    await this.dispose?.()
    await new Promise<void>((resolve) => this.wss!.close(() => resolve()))
    this.log.log('live updates stopped')
  }
}

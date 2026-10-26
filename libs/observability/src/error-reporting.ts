import * as Sentry from '@sentry/node'
import { logContext } from './log-context'

export interface ErrorReportingOptions {
  service: string
  env: string
  release?: string
  /** Sentry project DSN; reporting is off without it. */
  dsn?: string
  /** Tests replace the network transport. */
  transport?: Parameters<typeof Sentry.init>[0] extends infer O ? (O extends { transport?: infer T } ? T : never) : never
}

const KEPT_HEADERS = new Set(['user-agent', 'x-request-id', 'content-type'])
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BEARER = /bearer\s+\S+/gi
const LONG_SECRET = /[A-Za-z0-9+/_-]{80,}={0,2}/g

/** A backend failure for our own error log. The message is already scrubbed. */
export interface BackendErrorReport {
  userId?: string
  route?: string
  code: string
  message: string
  release?: string
}

type ErrorSink = (event: BackendErrorReport) => void | Promise<void>

let backendErrorSink: ErrorSink | null = null
let configuredRelease: string | undefined

/** The API and the worker register this so unexpected errors are stored even when Sentry is off. */
export function setBackendErrorSink(sink: ErrorSink | null): void {
  backendErrorSink = sink
}

function scrubMessage(value: string): string {
  return value.replace(EMAIL, '[email]').replace(BEARER, 'bearer [redacted]').replace(LONG_SECRET, '[redacted]').replace(/\s+/g, ' ').trim().slice(0, 500)
}

function emitBackendError(event: BackendErrorReport): void {
  const sink = backendErrorSink
  if (!sink) return
  try {
    const result = sink(event)
    if (result && typeof (result as Promise<void>).catch === 'function') void (result as Promise<void>).catch(() => undefined)
  } catch {
    // The error log must not change the request's outcome.
  }
}
/**
 * Default integrations that could carry personal data out: local variable values of the failing frames (a password
 * being hashed, a token being checked), source lines around each frame, and console output.
 */
const DROPPED_INTEGRATIONS = new Set(['LocalVariables', 'LocalVariablesAsync', 'ContextLines', 'Console'])

/**
 * Sentry for unexpected exceptions only (§16.5): no performance tracing (OpenTelemetry does that), no personal data.
 * Events keep the request id, operation, queue and job id as tags, and user.id when the account is known.
 * A failed scan passes the file owner's id. Email, name, cookies, bodies, query strings and most headers are removed.
 *
 * v11 (`@sentry/node` 11): `sendDefaultPii` is gone and an unset `dataCollection` collects personal data.
 * The block below is the v10 `sendDefaultPii: false` baseline, with stack frames and queue payloads off as well.
 * `tracesSampleRate` stays unset (error `sampleRate` is 1) and `enableOpenTelemetrySetup` stays off, so Sentry
 * does not register a tracer provider next to this process's OpenTelemetry SDK.
 */
export function startErrorReporting(options: ErrorReportingOptions): boolean {
  configuredRelease = options.release
  if (!options.dsn) return false
  Sentry.init({
    dsn: options.dsn,
    environment: options.env,
    release: options.release,
    initialScope: { tags: { service: options.service } },
    sampleRate: 1,
    includeLocalVariables: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      graphQL: { document: false, variables: false },
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    integrations: (defaults) => defaults.filter((i) => !DROPPED_INTEGRATIONS.has(i.name)),
    transport: options.transport,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => ({ ...crumb, data: crumb.data?.url ? { url: String(crumb.data.url).split('?')[0] } : undefined }),
  })
  return true
}

/** Reports an unexpected error with the current request or job context. Our own log is written even when Sentry is off. */
export function reportError(error: unknown, tags: Record<string, string | undefined> = {}): void {
  const ctx = logContext.getStore()
  const message = error instanceof Error ? error.message : String(error)
  const userId = tags.userId || ctx?.userId
  const queue = tags.queue || ctx?.queue
  const job = tags.job ?? ''
  emitBackendError({
    userId,
    route: tags.path || ctx?.operation || (queue ? `${queue}/${job}`.replace(/\/$/, '') : undefined),
    code: 'INTERNAL',
    message: scrubMessage(message || 'Unexpected error'),
    release: configuredRelease,
  })
  if (!Sentry.isInitialized()) return
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries({ requestId: ctx?.requestId, operation: ctx?.operation, queue: ctx?.queue, jobId: ctx?.jobId, ...tags })) {
      if (v) scope.setTag(k, v)
    }
    // UUID only. Email and name are stripped again in scrubEvent. A scan job has no request, so the owner is on the tags.
    if (userId) scope.setUser({ id: userId })
    Sentry.captureException(error)
  })
}

/** Sends queued events; call on shutdown. */
export async function flushErrors(timeoutMs = 2000): Promise<void> {
  if (Sentry.isInitialized()) await Sentry.flush(timeoutMs)
}

/** Keeps user.id and drops email, username, ip and name. Request bodies, cookies and query strings go too. */
export function scrubEvent<E extends Sentry.ErrorEvent>(event: E): E {
  const id = typeof event.user?.id === 'string' ? event.user.id : undefined
  if (id) event.user = { id }
  else delete event.user
  if (event.request) {
    delete event.request.cookies
    delete event.request.data
    delete event.request.query_string
    if (event.request.url) event.request.url = event.request.url.split('?')[0]
    if (event.request.headers) {
      event.request.headers = Object.fromEntries(Object.entries(event.request.headers).filter(([k]) => KEPT_HEADERS.has(k.toLowerCase())))
    }
  }
  return event
}

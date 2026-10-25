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
/**
 * Default integrations that could carry personal data out: local variable values of the failing frames (a password
 * being hashed, a token being checked), source lines around each frame, and console output.
 */
const DROPPED_INTEGRATIONS = new Set(['LocalVariables', 'LocalVariablesAsync', 'ContextLines', 'Console'])

/**
 * Sentry for unexpected exceptions only (§16.5): no performance tracing (OpenTelemetry does that), no personal data.
 * Events keep the request id, operation, queue and job id as tags. Cookies, bodies, query strings and most headers
 * are removed. A caller may set the user id (the file owner, when a scan fails); email and address are never kept.
 */
export function startErrorReporting(options: ErrorReportingOptions): boolean {
  if (!options.dsn) return false
  Sentry.init({
    dsn: options.dsn,
    environment: options.env,
    release: options.release,
    initialScope: { tags: { service: options.service } },
    sendDefaultPii: false,
    includeLocalVariables: false,
    integrations: (defaults) => defaults.filter((i) => !DROPPED_INTEGRATIONS.has(i.name)),
    skipOpenTelemetrySetup: true,
    transport: options.transport,
    beforeSend: (event) => scrub(event),
    beforeBreadcrumb: (crumb) => ({ ...crumb, data: crumb.data?.url ? { url: String(crumb.data.url).split('?')[0] } : undefined }),
  })
  return true
}

/** Reports an unexpected error with the current request or job context; does nothing when reporting is off. */
export function reportError(error: unknown, tags: Record<string, string | undefined> = {}): void {
  if (!Sentry.isInitialized()) return
  const ctx = logContext.getStore()
  Sentry.withScope((scope) => {
    if (tags.userId) scope.setUser({ id: tags.userId })
    for (const [k, v] of Object.entries({ requestId: ctx?.requestId, operation: ctx?.operation, queue: ctx?.queue, jobId: ctx?.jobId, ...tags })) {
      if (v) scope.setTag(k, v)
    }
    Sentry.captureException(error)
  })
}

/** Sends queued events; call on shutdown. */
export async function flushErrors(timeoutMs = 2000): Promise<void> {
  if (Sentry.isInitialized()) await Sentry.flush(timeoutMs)
}

function scrub<E extends Sentry.ErrorEvent>(event: E): E {
  if (event.user) {
    const id = event.user.id
    if (typeof id === 'string' && id) event.user = { id }
    else delete event.user
  }
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

import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

/** What every log line written while handling one request or job carries (§16.5: structured logs with request id). */
export interface LogContext {
  requestId?: string
  /** GraphQL operation name, once known. */
  operation?: string
  /** Signed-in account. A UUID only: never an email or a name (§16.5, B7). */
  userId?: string
  queue?: string
  jobId?: string
}

export const logContext = new AsyncLocalStorage<LogContext>()

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/

/** The client's X-Request-Id when well-formed (§7.2), otherwise a new UUID — never an arbitrary string in the logs. */
export function requestIdFrom(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  return value && REQUEST_ID.test(value) ? value : randomUUID()
}

/** Runs `fn` with log context for one background job, so its log lines can be found by queue and job id. */
export function withJobContext<T>(queue: string, jobId: string | undefined, fn: () => Promise<T>): Promise<T> {
  return logContext.run({ queue, jobId }, fn)
}

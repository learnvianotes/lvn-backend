import { trace } from '@opentelemetry/api'
import pino, { type DestinationStream, type Level, type Logger } from 'pino'
import { logContext } from './log-context'

/**
 * Never written to a log (§7.2): credentials, tokens, one-time codes, the date of birth and the age (ADR-0104), wherever they appear one
 * level deep in a logged object, and the request headers that carry them. Request bodies and GraphQL variables are
 * not logged at all; this is the second line of defence.
 */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'authorization',
  'cookie',
  ...['password', 'newPassword', 'refreshToken', 'accessToken', 'idToken', 'token', 'code', 'codeVerifier', 'dateOfBirth', 'age', 'declaredAge', 'secret', 'apiKey'].flatMap((k) => [k, `*.${k}`]),
]

export interface LoggerOptions {
  /** `lvn-api`, `lvn-worker`, … — the `service` label in Loki. */
  service: string
  env: string
  level: Level
  /** Where lines go; stdout (JSON, one object per line) by default. Tests pass a memory stream. */
  destination?: DestinationStream
}

/** The process logger: JSON lines with level names, ISO time, the service and the request or job context. */
export function createLogger({ service, env, level, destination }: LoggerOptions): Logger {
  return pino(
    {
      level,
      base: { service, env },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
      // pino-http binds requestId on its own request logger; everything else gets it from the async context. With
      // OpenTelemetry on, the active trace and span ids link a line to its trace.
      mixin: (_merge, _level, logger) => {
        const ctx = logContext.getStore()
        const span = trace.getActiveSpan()?.spanContext()
        const ids = span && span.traceId !== '00000000000000000000000000000000' ? { traceId: span.traceId, spanId: span.spanId } : {}
        if (!ctx) return ids
        return 'requestId' in logger.bindings() ? { ...ctx, requestId: undefined, ...ids } : { ...ctx, ...ids }
      },
    },
    destination,
  )
}

/**
 * Imported first by main.ts: OpenTelemetry must patch http, express, graphql, pg and ioredis before anything loads
 * them (§16.5). Sentry starts here too, so errors during start-up are reported. Both are off unless
 * OTEL_EXPORTER_OTLP_ENDPOINT / SENTRY_DSN are set.
 */
import { loadApiConfig } from '@lvn-backend/config'
import { startErrorReporting, startTelemetry } from '@lvn-backend/observability'

export const config = loadApiConfig()
const service = 'lvn-api'
export const telemetry = startTelemetry({ service, env: config.APP_ENV, release: config.RELEASE, otlpEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT })
startErrorReporting({ service, env: config.APP_ENV, release: config.RELEASE, dsn: config.SENTRY_DSN })

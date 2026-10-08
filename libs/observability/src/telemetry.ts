import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

export interface TelemetryOptions {
  service: string
  env: string
  /** Image tag or commit SHA; `dev` when unset. */
  release?: string
  /** OTLP/HTTP base URL of the collector (e.g. the ECS sidecar, §16.2); telemetry is off without it. */
  otlpEndpoint?: string
  /** How often metrics are pushed (default 30 s). */
  metricIntervalMs?: number
}

export interface Telemetry {
  enabled: boolean
  /** Flushes pending spans and metrics; call on shutdown. */
  shutdown(): Promise<void>
}

/**
 * OpenTelemetry traces and metrics over OTLP/HTTP (§16.5): incoming HTTP, Express, GraphQL, Postgres (through Prisma's
 * pg adapter), Redis and outgoing fetch. Must run before those modules are first loaded — each app's `instrument.ts`,
 * imported first by its main.ts. What is recorded stays free of personal data: no GraphQL variables or argument values,
 * no SQL parameters, Redis command names without arguments, and health checks are not traced.
 */
export function startTelemetry(options: TelemetryOptions): Telemetry {
  if (!options.otlpEndpoint) return { enabled: false, shutdown: async () => undefined }
  const base = options.otlpEndpoint.replace(/\/+$/, '')
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.service,
      [ATTR_SERVICE_VERSION]: options.release ?? 'dev',
      'deployment.environment.name': options.env,
    }),
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    metricReaders: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter({ url: `${base}/v1/metrics` }), exportIntervalMillis: options.metricIntervalMs ?? 30_000 })],
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => (req.url ?? '').startsWith('/health') }),
      new ExpressInstrumentation(),
      new GraphQLInstrumentation({ allowValues: false, mergeItems: true, ignoreTrivialResolveSpans: true }),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
      new IORedisInstrumentation({ dbStatementSerializer: (command) => command }),
      new UndiciInstrumentation(),
    ],
  })
  sdk.start()
  return { enabled: true, shutdown: () => sdk.shutdown() }
}

import { z } from 'zod'

/**
 * Environment contract for every LVN process (spec §16.1). Each app validates its variables at start-up
 * and exits on a missing or malformed value. The canonical list is docs/architecture/env.md.
 *
 * URLs, origins and hosts never have defaults here: every one comes from the environment (.env files locally,
 * the deploy environment in sandbox and production — ADR-0022).
 */

export const AppEnv = z.enum(['development', 'sandbox', 'production'])
export type AppEnv = z.infer<typeof AppEnv>

const port = z.coerce.number().int().min(1).max(65535)

/** Variables every backend process reads. */
const backendBase = z.object({
  APP_ENV: AppEnv,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.url().refine((u) => u.startsWith('postgres'), 'must be a postgres:// URL'),
  REDIS_URL: z.url().refine((u) => u.startsWith('redis'), 'must be a redis:// URL'),
})

export const apiConfigSchema = backendBase.extend({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: port.default(4000),
  /** Comma-separated origins allowed by CORS. */
  CORS_ORIGINS: z.string().transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
})
export type ApiConfig = z.infer<typeof apiConfigSchema>

export const workerConfigSchema = backendBase.extend({
  WORKER_HEALTH_PORT: port.default(4001),
})
export type WorkerConfig = z.infer<typeof workerConfigSchema>

/** Public (browser-visible) web variables. Server-only web secrets get their own schema in Phase 1. */
export const webConfigSchema = z.object({
  NEXT_PUBLIC_APP_ENV: AppEnv.default('development'),
  /** Canonical web origin, e.g. https://www.learnvianotes.in in production. */
  NEXT_PUBLIC_SITE_URL: z.url(),
})
export type WebConfig = z.infer<typeof webConfigSchema>

export const mobileConfigSchema = z.object({
  EXPO_PUBLIC_APP_ENV: AppEnv,
  /** lvn-web origin, for links into the site. */
  EXPO_PUBLIC_WEB_URL: z.url(),
})
export type MobileConfig = z.infer<typeof mobileConfigSchema>

export class ConfigError extends Error {
  override name = 'ConfigError'
}

/** Parse `env` against `schema`; throws a ConfigError listing every bad variable (never their values). */
export function loadConfig<S extends z.ZodType>(schema: S, env: Record<string, string | undefined>): z.infer<S> {
  const result = schema.safeParse(env)
  if (result.success) return result.data
  const lines = result.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
  throw new ConfigError(`Invalid environment:\n${lines.join('\n')}`)
}

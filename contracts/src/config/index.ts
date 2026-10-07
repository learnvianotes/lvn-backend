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

const flag = z.enum(['true', 'false']).transform((v) => v === 'true')
/** A PEM key in one .env line: real newlines, or `\n` escapes as most secret stores and .env files keep them. */
const pem = (kind: 'PRIVATE' | 'PUBLIC') =>
  z.string().transform((v) => v.replace(/\\n/g, '\n').trim()).refine((v) => v.startsWith(`-----BEGIN ${kind} KEY-----`), `must be a PEM ${kind.toLowerCase()} key (PKCS#8 / SPKI)`)

/**
 * Object storage (§8, ADR-0032). S3_ENDPOINT is set for S3-compatible servers (RustFS locally) and left unset on AWS.
 * Identity documents for verification go to their own bucket with its own key (ADR-0019).
 */
const storage = z.object({
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: flag.default(false),
  S3_BUCKET: z.string().min(3),
  S3_RESTRICTED_BUCKET: z.string().min(3),
})

/** Transactional email (§2): SMTP (Mailpit locally) or Resend. */
const mail = z.object({
  MAIL_FROM: z.string().min(3),
  MAIL_TRANSPORT: z.enum(['smtp', 'resend']),
  SMTP_URL: z.url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
})

const mailTransportConfigured = <T extends { MAIL_TRANSPORT: 'smtp' | 'resend'; SMTP_URL?: string; RESEND_API_KEY?: string }>(c: T, ctx: z.RefinementCtx) => {
  if (c.MAIL_TRANSPORT === 'smtp' && !c.SMTP_URL) ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'required when MAIL_TRANSPORT=smtp' })
  if (c.MAIL_TRANSPORT === 'resend' && !c.RESEND_API_KEY) ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'required when MAIL_TRANSPORT=resend' })
}

/** Sessions and sign-in (§7, ADR-0007). Provider credentials are optional: a provider without them is switched off. */
const auth = z.object({
  /** RS256 key pair for access tokens (§7.1). Development: `pnpm keys:dev` writes a pair to .env.local. */
  JWT_PRIVATE_KEY: pem('PRIVATE'),
  JWT_PUBLIC_KEY: pem('PUBLIC'),
  /** The API's public origin, used as the token issuer. */
  JWT_ISSUER: z.url(),
  /** lvn-web origin, for links in emails (verify, reset) and OAuth redirects. */
  WEB_URL: z.url(),
  /** Secret for HMAC-hashing short codes (institutional email codes), so a database leak does not reveal them. */
  CODE_HMAC_SECRET: z.string().min(32),
  /** k-anonymity range API for the breached-password check (§7.1); unset only in tests. */
  PASSWORD_BREACH_API_URL: z.url().optional(),
  /** Firebase project whose ID tokens signInWithGoogle accepts (ADR-0007). */
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
})

export const apiConfigSchema = backendBase
  .extend({
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: port.default(4000),
    /** Comma-separated origins allowed by CORS. */
    CORS_ORIGINS: z.string().transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  })
  .extend(storage.shape)
  .extend(mail.shape)
  .extend(auth.shape)
  .superRefine(mailTransportConfigured)
export type ApiConfig = z.infer<typeof apiConfigSchema>

export const workerConfigSchema = backendBase
  .extend({
    WORKER_HEALTH_PORT: port.default(4001),
  })
  .extend(storage.shape)
  .extend(mail.shape)
  .superRefine(mailTransportConfigured)
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

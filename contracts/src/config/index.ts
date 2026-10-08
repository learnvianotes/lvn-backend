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
/** An http(s) URL — `host:port` alone would parse as a URL with the host as its scheme. */
const httpUrl = z.url().refine((u) => /^https?:\/\//.test(u), 'must be an http(s) URL')

/** Variables every backend process reads. */
const backendBase = z.object({
  APP_ENV: AppEnv,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.url().refine((u) => u.startsWith('postgres'), 'must be a postgres:// URL'),
  REDIS_URL: z.url().refine((u) => u.startsWith('redis'), 'must be a redis:// URL'),
  /** Image tag or commit SHA of this deployment, reported with traces and errors. */
  RELEASE: z.string().min(1).optional(),
  /** OTLP/HTTP collector base URL (§16.5); OpenTelemetry traces and metrics are off without it. */
  OTEL_EXPORTER_OTLP_ENDPOINT: httpUrl.optional(),
  /** Sentry DSN for unexpected exceptions; error reporting is off without it. */
  SENTRY_DSN: httpUrl.optional(),
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

/**
 * Transactional email (§2): SMTP (Mailpit locally), Amazon SES on AWS (signed with the task role — no key), or Resend.
 */
const mail = z.object({
  MAIL_FROM: z.string().min(3),
  MAIL_TRANSPORT: z.enum(['smtp', 'resend', 'ses']),
  SMTP_URL: z.url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  /** Region of the SES identity that MAIL_FROM uses. */
  SES_REGION: z.string().min(1).optional(),
})

const mailTransportConfigured = <T extends { MAIL_TRANSPORT: 'smtp' | 'resend' | 'ses'; SMTP_URL?: string; RESEND_API_KEY?: string; SES_REGION?: string }>(c: T, ctx: z.RefinementCtx) => {
  if (c.MAIL_TRANSPORT === 'smtp' && !c.SMTP_URL) ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'required when MAIL_TRANSPORT=smtp' })
  if (c.MAIL_TRANSPORT === 'resend' && !c.RESEND_API_KEY) ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'required when MAIL_TRANSPORT=resend' })
  if (c.MAIL_TRANSPORT === 'ses' && !c.SES_REGION) ctx.addIssue({ code: 'custom', path: ['SES_REGION'], message: 'required when MAIL_TRANSPORT=ses' })
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
  /**
   * Age below which an account needs verified guardian or institutional consent, or is a restricted minor (§15.2):
   * 18 under India's DPDP Act (the default for learnvianotes.in), 16 in parts of the EU, at least 13 everywhere.
   */
  DIGITAL_CONSENT_AGE: z.coerce.number().int().min(13).max(21).default(18),
  /** k-anonymity range API for the breached-password check (§7.1); unset only in tests. */
  PASSWORD_BREACH_API_URL: z.url().optional(),
  /** Firebase project whose ID tokens signInWithGoogle accepts (ADR-0007). */
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  /** GitHub's OAuth origin (https://github.com) and REST API (https://api.github.com); from env like every URL. */
  GITHUB_OAUTH_URL: z.url().optional(),
  GITHUB_API_URL: z.url().optional(),
  LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
  /** LinkedIn's OAuth base (https://www.linkedin.com/oauth/v2) and OpenID userinfo API (https://api.linkedin.com/v2). */
  LINKEDIN_OAUTH_URL: z.url().optional(),
  LINKEDIN_API_URL: z.url().optional(),
  /**
   * Comma-separated redirect URIs `oauthExchange` accepts — exactly those registered with GitHub and LinkedIn (the web
   * callback page and the app's deep link). Anything else is refused.
   */
  OAUTH_REDIRECT_URIS: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((u) => u.trim()).filter(Boolean) : [])),
})

/** A provider with credentials needs its endpoints and at least one redirect URI. */
const providersConfigured = (
  c: { GITHUB_CLIENT_ID?: string; GITHUB_OAUTH_URL?: string; GITHUB_API_URL?: string; LINKEDIN_CLIENT_ID?: string; LINKEDIN_OAUTH_URL?: string; LINKEDIN_API_URL?: string; OAUTH_REDIRECT_URIS: string[] },
  ctx: z.RefinementCtx,
) => {
  const need = (cond: boolean, path: string, message: string) => cond || ctx.addIssue({ code: 'custom', path: [path], message })
  if (c.GITHUB_CLIENT_ID) {
    need(!!c.GITHUB_OAUTH_URL, 'GITHUB_OAUTH_URL', 'required when GITHUB_CLIENT_ID is set')
    need(!!c.GITHUB_API_URL, 'GITHUB_API_URL', 'required when GITHUB_CLIENT_ID is set')
  }
  if (c.LINKEDIN_CLIENT_ID) {
    need(!!c.LINKEDIN_OAUTH_URL, 'LINKEDIN_OAUTH_URL', 'required when LINKEDIN_CLIENT_ID is set')
    need(!!c.LINKEDIN_API_URL, 'LINKEDIN_API_URL', 'required when LINKEDIN_CLIENT_ID is set')
  }
  if (c.GITHUB_CLIENT_ID || c.LINKEDIN_CLIENT_ID) need(c.OAUTH_REDIRECT_URIS.length > 0, 'OAUTH_REDIRECT_URIS', 'required when GitHub or LinkedIn sign-in is on')
}

const apiShape = backendBase
  .extend({
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: port.default(4000),
    /** Comma-separated origins allowed by CORS. */
    CORS_ORIGINS: z.string().transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
    /**
     * Proxies in front of the API whose X-Forwarded-For is trusted for the client address (rate limits, §7.1):
     * 0 locally, 1 behind the ALB, 2 behind CloudFront + ALB. Too high lets clients choose their own address.
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  })
  .extend(storage.shape)
  .extend(mail.shape)
  .extend(auth.shape)

export const apiConfigSchema = apiShape.superRefine(mailTransportConfigured).superRefine(providersConfigured)
export type ApiConfig = z.infer<typeof apiConfigSchema>

/**
 * The worker runs the same five contexts as the API (their jobs need the same storage, mail and keys), so it reads
 * the API's variables plus its own. Deployments give both tasks the same environment.
 */
export const workerConfigSchema = apiShape
  .extend({
    WORKER_HEALTH_PORT: port.default(4001),
    /** The old Firebase project read by `legacy:snapshot` (ADR-0023); credentials via GOOGLE_APPLICATION_CREDENTIALS. */
    LEGACY_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  })
  .superRefine(mailTransportConfigured)
  .superRefine(providersConfigured)
export type WorkerConfig = z.infer<typeof workerConfigSchema>

const publicId = z.string().min(1).optional()

/** Public (browser-visible) web variables. Server-only web secrets get their own schema when the web needs one. */
export const webConfigSchema = z.object({
  NEXT_PUBLIC_APP_ENV: AppEnv.default('development'),
  /** Canonical web origin, e.g. https://www.learnvianotes.in in production. */
  NEXT_PUBLIC_SITE_URL: z.url(),
  /** The API's GraphQL gateway. */
  NEXT_PUBLIC_API_URL: z.url(),
  /** /core feedback reports; empty disables sending. */
  NEXT_PUBLIC_FEEDBACK_URL: z.union([z.url(), z.literal('')]).optional(),
  /** Google sign-in through Firebase Authentication (ADR-0007). Public identifiers, not secrets. */
  NEXT_PUBLIC_FIREBASE_API_KEY: publicId,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: publicId,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: publicId,
  NEXT_PUBLIC_FIREBASE_APP_ID: publicId,
  /** GitHub and LinkedIn sign-in (§7.1): public client ids and consent pages. */
  NEXT_PUBLIC_GITHUB_CLIENT_ID: publicId,
  NEXT_PUBLIC_GITHUB_AUTHORIZE_URL: z.url().optional(),
  NEXT_PUBLIC_LINKEDIN_CLIENT_ID: publicId,
  NEXT_PUBLIC_LINKEDIN_AUTHORIZE_URL: z.url().optional(),
  /** Sentry DSN for browser and server errors (§16.5); off without it. A DSN is public by design. */
  NEXT_PUBLIC_SENTRY_DSN: httpUrl.optional(),
})
export type WebConfig = z.infer<typeof webConfigSchema>

export const mobileConfigSchema = z.object({
  EXPO_PUBLIC_APP_ENV: AppEnv,
  /** lvn-web origin, for links into the site. */
  EXPO_PUBLIC_WEB_URL: z.url(),
  /** The API's GraphQL gateway. */
  EXPO_PUBLIC_API_URL: z.url(),
  /** GitHub sign-in (§7.1); LinkedIn does not redirect to app schemes and has no app variable. */
  EXPO_PUBLIC_GITHUB_CLIENT_ID: publicId,
  EXPO_PUBLIC_GITHUB_AUTHORIZE_URL: z.url().optional(),
  /** Sentry DSN for crashes and errors (§16.5); off without it. */
  EXPO_PUBLIC_SENTRY_DSN: httpUrl.optional(),
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

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
const wsUrl = z.url().refine((u) => /^wss?:\/\//.test(u), 'must be a ws(s) URL')

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
   * Push through FCM HTTP v1 (ADR-0021, ADR-0050): the API origin (https://fcm.googleapis.com), Google's OAuth token
   * endpoint (https://oauth2.googleapis.com/token) and the Firebase service account's JSON key. Push is off unless all
   * three are set.
   */
  FCM_API_URL: z.url().optional(),
  GOOGLE_OAUTH_TOKEN_URL: z.url().optional(),
  FCM_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  /**
   * Age below which an account needs verified guardian or institutional consent, or is a restricted minor (§15.2):
   * 18 under India's DPDP Act (the default for learnvianotes.in), 16 in parts of the EU, at least 13 everywhere.
   */
  DIGITAL_CONSENT_AGE: z.coerce.number().int().min(13).max(21).default(18),
  /** ADR-0037: extra `REASON: phrase` lines for the rule-based moderation scorer; the built-in spam phrases apply without it. */
  MODERATION_WORDS_FILE: z.string().min(1).optional(),
  /** The web app's on-demand revalidation endpoint (`<web>/api/revalidate`): public note pages refresh when a note changes. Off without it. */
  WEB_REVALIDATE_URL: httpUrl.optional(),
  /** Shared with the web app's REVALIDATE_SECRET; at least 32 characters. */
  REVALIDATE_SECRET: z.string().min(32).optional(),
  /** ClamAV's clamd for scanning uploads (ADR-0041), `tcp://host:3310`; without it uploads are not scanned (development). */
  CLAMAV_URL: z.string().regex(/^tcp:\/\/[^:/]+:\d+$/, 'Use tcp://host:port').optional(),
  /** k-anonymity range API for the breached-password check (§7.1); unset only in tests. */
  PASSWORD_BREACH_API_URL: z.url().optional(),
  /** Firebase project whose ID tokens signInWithGoogle accepts (ADR-0007). */
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  /** GitHub's OAuth origin (https://github.com) and REST API (https://api.github.com); from env like every URL. */
  GITHUB_OAUTH_URL: z.url().optional(),
  GITHUB_API_URL: z.url().optional(),
  /** Project workspaces (ADR-0048): GitLab's REST API (https://gitlab.com/api/v4) for public repository details. */
  GITLAB_API_URL: z.url().optional(),
  /** Optional: a token with no scopes, for GitHub's higher rate limit on public repository details (ADR-0048). */
  GITHUB_TOKEN: z.string().min(1).optional(),
  /** Resources (ADR-0074): Open Library's API (https://openlibrary.org) for books by ISBN; without it ISBNs are not looked up. */
  OPEN_LIBRARY_URL: z.url().optional(),
  /** Open Library's covers (https://covers.openlibrary.org): a book's cover is copied into storage from here. */
  OPEN_LIBRARY_COVERS_URL: z.url().optional(),
  /**
   * Comma-separated hosts the safe fetcher (ADR-0074) reaches although they are not on the public internet: a test's
   * stand-in server. Never set in production.
   */
  SAFE_FETCH_ALLOW_HOSTS: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean) : [])),
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

/**
 * Search (§11, ADR-0055). SEARCH_PROVIDER chooses who answers; whenever Typesense is configured the worker also keeps
 * its collections, so reads can switch without a rebuild. The key never leaves the server.
 */
const search = z.object({
  SEARCH_PROVIDER: z.enum(['postgres', 'typesense']).default('postgres'),
  /** Typesense's HTTP API, e.g. http://typesense:8108 */
  TYPESENSE_URL: httpUrl.optional(),
  TYPESENSE_API_KEY: z.string().min(16).optional(),
  /** Prefix of every collection and alias name, so environments can share a cluster */
  TYPESENSE_COLLECTION_PREFIX: z.string().regex(/^[a-z0-9_]{0,20}$/, 'lowercase letters, digits and _').default('lvn_'),
  /** A Typesense answer slower than this is dropped and Postgres answers instead */
  SEARCH_TIMEOUT_MS: z.coerce.number().int().min(50).max(10_000).default(800),
  /** Hybrid ranking (§11, ADR-0057): keyword and semantic ranks fused; changes nothing until a semantic source exists */
  SEARCH_HYBRID: flag.default(false),
})

/**
 * AI (§10.1, ADR-0058). Every call goes through the `ai` context's gateway; clients never hold keys. With AI_PROVIDER
 * `none` (the default) AI is off and says so. The task → model table in the database overrides these defaults.
 */
const ai = z.object({
  AI_PROVIDER: z.enum(['none', 'ollama']).default('none'),
  /** Ollama's HTTP API: http://127.0.0.1:11434 on a dev machine, http://10.0.2.2:11434 from the local VM */
  OLLAMA_URL: httpUrl.optional(),
  /** Default models: one for text (and images), one for embeddings */
  AI_CHAT_MODEL: z.string().min(1).optional(),
  AI_EMBED_MODEL: z.string().min(1).optional(),
  /** A provider call slower than this fails (a local model's first call loads it) */
  AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(120_000),
  /** The environment's monthly AI budget in millionths of a dollar; past it the breaker trips. Unset: no cap */
  AI_MONTHLY_BUDGET_MICRO_USD: z.coerce.number().int().min(0).optional(),
  /** Study aids made when a note is published PUBLIC (ADR-0061): five model calls per version, as the platform's work */
  AI_PUBLIC_PIPELINE: flag.default(true),
  /**
   * Encrypts the provider keys platform admins save on the AI providers page (ADR-0065); at least 32 characters.
   * Unset: keys cannot be saved, and connections that need one do not answer. Changing it makes saved keys unreadable
   */
  AI_KEYS_SECRET: z.string().min(32).optional(),
})

/**
 * Product analytics (§14.1, ADR-0067): the worker sends a pseudonymous copy of learning events (type, platform,
 * duration; an HMAC of the user id) to a self-hosted PostHog. Off unless both are set; clients never send analytics.
 */
const analytics = z.object({
  /** e.g. https://posthog.example.org */
  POSTHOG_HOST: httpUrl.optional(),
  /** The PostHog project's API key */
  POSTHOG_API_KEY: z.string().min(1).optional(),
})

const analyticsConfigured = <T extends { POSTHOG_HOST?: string; POSTHOG_API_KEY?: string }>(c: T, ctx: z.RefinementCtx) => {
  if (!!c.POSTHOG_HOST !== !!c.POSTHOG_API_KEY) ctx.addIssue({ code: 'custom', path: [c.POSTHOG_HOST ? 'POSTHOG_API_KEY' : 'POSTHOG_HOST'], message: 'POSTHOG_HOST and POSTHOG_API_KEY go together' })
}

/** The safe fetcher's allow list is for tests and stand-ins: production fetches public addresses only (ADR-0074). */
const safeFetchConfigured = <T extends { APP_ENV: string; SAFE_FETCH_ALLOW_HOSTS: string[] }>(c: T, ctx: z.RefinementCtx) => {
  if (c.APP_ENV === 'production' && c.SAFE_FETCH_ALLOW_HOSTS.length) ctx.addIssue({ code: 'custom', path: ['SAFE_FETCH_ALLOW_HOSTS'], message: 'never set in production' })
}

const aiConfigured = <T extends { AI_PROVIDER: 'none' | 'ollama'; OLLAMA_URL?: string; AI_CHAT_MODEL?: string; AI_EMBED_MODEL?: string }>(c: T, ctx: z.RefinementCtx) => {
  if (c.AI_PROVIDER !== 'ollama') return
  for (const key of ['OLLAMA_URL', 'AI_CHAT_MODEL', 'AI_EMBED_MODEL'] as const) if (!c[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required when AI_PROVIDER=ollama' })
}

const searchConfigured = <T extends { SEARCH_PROVIDER: 'postgres' | 'typesense'; TYPESENSE_URL?: string; TYPESENSE_API_KEY?: string }>(c: T, ctx: z.RefinementCtx) => {
  if (!!c.TYPESENSE_URL !== !!c.TYPESENSE_API_KEY) ctx.addIssue({ code: 'custom', path: [c.TYPESENSE_URL ? 'TYPESENSE_API_KEY' : 'TYPESENSE_URL'], message: 'TYPESENSE_URL and TYPESENSE_API_KEY go together' })
  if (c.SEARCH_PROVIDER === 'typesense' && !c.TYPESENSE_URL) ctx.addIssue({ code: 'custom', path: ['TYPESENSE_URL'], message: 'required when SEARCH_PROVIDER=typesense' })
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
  .extend(search.shape)
  .extend(ai.shape)
  .extend(analytics.shape)

export const apiConfigSchema = apiShape.superRefine(mailTransportConfigured).superRefine(providersConfigured).superRefine(searchConfigured).superRefine(aiConfigured).superRefine(analyticsConfigured).superRefine(safeFetchConfigured)
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
  .superRefine(searchConfigured)
  .superRefine(aiConfigured)
  .superRefine(analyticsConfigured)
  .superRefine(safeFetchConfigured)
export type WorkerConfig = z.infer<typeof workerConfigSchema>

const publicId = z.string().min(1).optional()

/** Public (browser-visible) web variables. Server-only web secrets get their own schema when the web needs one. */
export const webConfigSchema = z.object({
  NEXT_PUBLIC_APP_ENV: AppEnv.default('development'),
  /** Canonical web origin, e.g. https://www.learnvianotes.in in production. */
  NEXT_PUBLIC_SITE_URL: z.url(),
  /** The API's GraphQL gateway. */
  NEXT_PUBLIC_API_URL: z.url(),
  /**
   * Live updates (ADR-0042): the API's graphql-ws endpoint, e.g. wss://api.learnvianotes.in/graphql/live. Derived
   * from NEXT_PUBLIC_API_URL in development when unset; elsewhere unset means no live updates.
   */
  NEXT_PUBLIC_LIVE_URL: wsUrl.optional(),
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
  /** Live updates while the app is open (ADR-0042); as NEXT_PUBLIC_LIVE_URL. */
  EXPO_PUBLIC_LIVE_URL: wsUrl.optional(),
  /** GitHub sign-in (§7.1); LinkedIn does not redirect to app schemes and has no app variable. */
  EXPO_PUBLIC_GITHUB_CLIENT_ID: publicId,
  EXPO_PUBLIC_GITHUB_AUTHORIZE_URL: z.url().optional(),
  /**
   * Google sign-in (ADR-0007): native Google Sign-In for the account, then Firebase for the ID token the API accepts.
   * The Firebase web app's config, and the OAuth client ids the Google provider of that Firebase project created.
   */
  EXPO_PUBLIC_FIREBASE_API_KEY: publicId,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: publicId,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: publicId,
  EXPO_PUBLIC_FIREBASE_APP_ID: publicId,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: publicId,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: publicId,
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

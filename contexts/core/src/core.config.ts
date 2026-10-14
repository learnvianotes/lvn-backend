import type { ApiConfig } from '@lvn/contracts/config'

/** What the core context needs from the API configuration. */
export interface CoreConfig {
  /** Old-site snapshots (ADR-0023): the restricted bucket and the environment prefix */
  legacy: { bucket: string; env: string }
  /** ADR-0037: extra word list for the moderation scorer */
  moderation: { wordsFile: string | null }
  /** ADR-0048: providers' public APIs for workspace repositories; null leaves the card a link */
  repositories: { githubApiUrl: string | null; gitlabApiUrl: string | null; githubToken: string | null }
  /** ADR-0078: the GitHub App for repository activity; null until the owner configures one */
  githubApp: { appId: string; slug: string; privateKey: string; webhookSecret: string; clientId: string; clientSecret: string; webUrl: string; apiUrl: string } | null
  /** ADR-0067: the worker's pseudonymous copy of learning events for PostHog; null: off */
  analytics: { host: string; apiKey: string; pseudonymSecret: string } | null
  /** ADR-0074: Open Library for books by ISBN (null: not looked up), and how the safe fetcher names itself */
  resources: { openLibraryUrl: string | null; openLibraryCoversUrl: string | null; userAgent: string; allowHosts: string[] }
}

export const CORE_CONFIG = Symbol('CORE_CONFIG')

export const coreConfigFrom = (c: ApiConfig): CoreConfig => ({
  legacy: { bucket: c.S3_RESTRICTED_BUCKET, env: c.APP_ENV },
  moderation: { wordsFile: c.MODERATION_WORDS_FILE ?? null },
  repositories: { githubApiUrl: c.GITHUB_API_URL ?? null, gitlabApiUrl: c.GITLAB_API_URL ?? null, githubToken: c.GITHUB_TOKEN ?? null },
  githubApp:
    c.GITHUB_APP_ID && c.GITHUB_APP_SLUG && c.GITHUB_APP_PRIVATE_KEY && c.GITHUB_APP_WEBHOOK_SECRET && c.GITHUB_APP_CLIENT_ID && c.GITHUB_APP_CLIENT_SECRET && c.GITHUB_APP_URL && c.GITHUB_API_URL
      ? {
          appId: c.GITHUB_APP_ID,
          slug: c.GITHUB_APP_SLUG,
          privateKey: c.GITHUB_APP_PRIVATE_KEY,
          webhookSecret: c.GITHUB_APP_WEBHOOK_SECRET,
          clientId: c.GITHUB_APP_CLIENT_ID,
          clientSecret: c.GITHUB_APP_CLIENT_SECRET,
          webUrl: c.GITHUB_APP_URL.replace(/\/$/, ''),
          apiUrl: c.GITHUB_API_URL.replace(/\/$/, ''),
        }
      : null,
  analytics: c.POSTHOG_HOST && c.POSTHOG_API_KEY ? { host: c.POSTHOG_HOST, apiKey: c.POSTHOG_API_KEY, pseudonymSecret: c.CODE_HMAC_SECRET } : null,
  resources: {
    openLibraryUrl: c.OPEN_LIBRARY_URL?.replace(/\/$/, '') ?? null,
    openLibraryCoversUrl: c.OPEN_LIBRARY_COVERS_URL?.replace(/\/$/, '') ?? null,
    userAgent: `LearnViaNotes/1.0 (+${c.WEB_URL})`,
    allowHosts: c.SAFE_FETCH_ALLOW_HOSTS,
  },
})

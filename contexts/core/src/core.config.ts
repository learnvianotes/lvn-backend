import type { ApiConfig } from '@lvn/contracts/config'

/** What the core context needs from the API configuration. */
export interface CoreConfig {
  /** Old-site snapshots (ADR-0023): the restricted bucket and the environment prefix */
  legacy: { bucket: string; env: string }
  /** ADR-0037: extra word list for the moderation scorer */
  moderation: { wordsFile: string | null }
  /** ADR-0048: providers' public APIs for workspace repositories; null leaves the card a link */
  repositories: { githubApiUrl: string | null; gitlabApiUrl: string | null; githubToken: string | null }
  /** ADR-0067: the worker's pseudonymous copy of learning events for PostHog; null: off */
  analytics: { host: string; apiKey: string; pseudonymSecret: string } | null
}

export const CORE_CONFIG = Symbol('CORE_CONFIG')

export const coreConfigFrom = (c: ApiConfig): CoreConfig => ({
  legacy: { bucket: c.S3_RESTRICTED_BUCKET, env: c.APP_ENV },
  moderation: { wordsFile: c.MODERATION_WORDS_FILE ?? null },
  repositories: { githubApiUrl: c.GITHUB_API_URL ?? null, gitlabApiUrl: c.GITLAB_API_URL ?? null, githubToken: c.GITHUB_TOKEN ?? null },
  analytics: c.POSTHOG_HOST && c.POSTHOG_API_KEY ? { host: c.POSTHOG_HOST, apiKey: c.POSTHOG_API_KEY, pseudonymSecret: c.CODE_HMAC_SECRET } : null,
})

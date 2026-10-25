import type { ApiConfig } from '@lvn/contracts/config'
import { TOKEN_AUDIENCE } from '@lvn-backend/auth-guard'

/** What the users context needs from the API configuration; apps/api maps ApiConfig onto it. */
export interface UsersConfig {
  jwtPrivateKey: string
  jwtIssuer: string
  tokenAudience: string
  webUrl: string
  codeHmacSecret: string
  digitalConsentAge: number
  /** ADR-0091: below this age the account is kept as AGE_BLOCKED and cannot sign in (0: everyone may register) */
  accountMinimumAge: number
  /** Fallback contact when no non-deleted PLATFORM_ADMIN exists. SUPPORT_EMAIL, or support@learnvianotes.in when unset. */
  supportEmail: string
  passwordBreachApiUrl?: string
  firebaseProjectId?: string
  github?: { clientId: string; clientSecret: string; oauthUrl: string; apiUrl: string }
  linkedin?: { clientId: string; clientSecret: string; oauthUrl: string; apiUrl: string }
  /** Redirect URIs registered with GitHub and LinkedIn; oauthExchange accepts no other */
  oauthRedirectUris: string[]
  /** Where old-site snapshots are (ADR-0023): the restricted bucket and the environment prefix */
  legacy: { bucket: string; env: string }
  /**
   * ADR-0077: skills import. GitHub's REST API (null: GitHub is not offered) with an optional token for its larger
   * allowance, and how the safe fetcher names itself and which test hosts it may reach.
   */
  skillsImport: { githubApiUrl: string | null; githubToken: string | null; userAgent: string; allowHosts: string[] }
  /**
   * Environment values for settings an admin can override (ADR-0101). Used only while no AppSetting row is saved.
   * Null is a budget with no cap.
   */
  settingFallbacks: {
    uploads_enabled: boolean
    ai_public_pipeline: boolean
    ai_monthly_budget_micro_usd: number | null
    ai_timeout_ms: number
    search_hybrid: boolean
    search_timeout_ms: number
    account_minimum_age: number
    digital_consent_age: number
  }
}

export const USERS_CONFIG = Symbol('USERS_CONFIG')

/** The users context's slice of the process configuration (both composition roots use it). */
export function usersConfigFrom(c: ApiConfig): UsersConfig {
  return {
    jwtPrivateKey: c.JWT_PRIVATE_KEY,
    jwtIssuer: c.JWT_ISSUER,
    tokenAudience: TOKEN_AUDIENCE,
    webUrl: c.WEB_URL,
    codeHmacSecret: c.CODE_HMAC_SECRET,
    digitalConsentAge: c.DIGITAL_CONSENT_AGE,
    accountMinimumAge: c.ACCOUNT_MINIMUM_AGE,
    supportEmail: c.SUPPORT_EMAIL,
    passwordBreachApiUrl: c.PASSWORD_BREACH_API_URL,
    firebaseProjectId: c.FIREBASE_PROJECT_ID,
    github:
      c.GITHUB_CLIENT_ID && c.GITHUB_CLIENT_SECRET && c.GITHUB_OAUTH_URL && c.GITHUB_API_URL
        ? { clientId: c.GITHUB_CLIENT_ID, clientSecret: c.GITHUB_CLIENT_SECRET, oauthUrl: c.GITHUB_OAUTH_URL, apiUrl: c.GITHUB_API_URL }
        : undefined,
    linkedin:
      c.LINKEDIN_CLIENT_ID && c.LINKEDIN_CLIENT_SECRET && c.LINKEDIN_OAUTH_URL && c.LINKEDIN_API_URL
        ? { clientId: c.LINKEDIN_CLIENT_ID, clientSecret: c.LINKEDIN_CLIENT_SECRET, oauthUrl: c.LINKEDIN_OAUTH_URL, apiUrl: c.LINKEDIN_API_URL }
        : undefined,
    oauthRedirectUris: c.OAUTH_REDIRECT_URIS,
    // Old-site snapshots (ADR-0023) live in the restricted bucket under the environment prefix.
    legacy: { bucket: c.S3_RESTRICTED_BUCKET, env: c.APP_ENV },
    skillsImport: { githubApiUrl: c.GITHUB_API_URL ?? null, githubToken: c.GITHUB_TOKEN ?? null, userAgent: `LearnViaNotes/1.0 (+${c.WEB_URL})`, allowHosts: c.SAFE_FETCH_ALLOW_HOSTS },
    settingFallbacks: {
      uploads_enabled: c.UPLOADS_ENABLED,
      ai_public_pipeline: c.AI_PUBLIC_PIPELINE,
      ai_monthly_budget_micro_usd: c.AI_MONTHLY_BUDGET_MICRO_USD ?? null,
      ai_timeout_ms: c.AI_TIMEOUT_MS,
      search_hybrid: c.SEARCH_HYBRID,
      search_timeout_ms: c.SEARCH_TIMEOUT_MS,
      account_minimum_age: c.ACCOUNT_MINIMUM_AGE,
      digital_consent_age: c.DIGITAL_CONSENT_AGE,
    },
  }
}

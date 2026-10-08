# Environment variables

Canonical list (section 16.1). CI fails if code reads a variable that is missing here or from `.env.example`.
Every value is validated with Zod at start-up; a missing or malformed value stops the process.

**Rule (ADR-0022): every URL, origin, host and connection string comes from the environment — never from code, and
never as a default in a schema.** Each repository commits `.env.example` with development values; developers copy it to
`.env` (git-ignored) and override in `.env.local`; CI copies `.env.example` to `.env`; sandbox and production set
variables in the deploy environment. lvn-mobile uses `env/<variant>.env` per build variant (ADR-0008).

## lvn-web

Validated in lvn-web `lib/env.ts` until `@lvn/contracts/config` is published (ADR-0003); the same schema is `webConfigSchema`.

| Variable | Required | Default | Development | Sandbox | Production | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | yes | `development` | `development` | `sandbox` | `production` | Gates indexing (`robots`, `noindex`) and, later, feature defaults |
| `NEXT_PUBLIC_SITE_URL` | yes | — | `http://localhost:3000` | `https://sandbox.learnvianotes.in` | `https://www.learnvianotes.in` | Canonical URLs, sitemap, Open Graph |
| `NEXT_PUBLIC_FEEDBACK_URL` | no | — (sending disabled) | the old site's Apps Script URL | same | same | `/core` help-centre feedback reports (Google Apps Script → Sheet) |
| `NEXT_PUBLIC_APP_VERSION` | no | `package.json` version | — | — | — | Version shown in the `/core` help centre and sent with feedback |
| `NEXT_DIST_DIR` | no | `.next` | — | — | — | Build output folder; Playwright builds to `.next-e2e` so it never clobbers `next dev` |

| `NEXT_PUBLIC_API_URL` | yes | — | `http://localhost:4000/graphql` | `https://api.sandbox.learnvianotes.in/graphql` | `https://api.learnvianotes.in/graphql` | The API's GraphQL gateway |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_APP_ID` | no | — (Google off) | — | project values | project values | Google sign-in through Firebase (ADR-0007); public identifiers, not secrets |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID`, `NEXT_PUBLIC_GITHUB_AUTHORIZE_URL` | no | — (GitHub off) | — | app id, `https://github.com/login/oauth/authorize` | same | GitHub consent page (PKCE) |
| `NEXT_PUBLIC_LINKEDIN_CLIENT_ID`, `NEXT_PUBLIC_LINKEDIN_AUTHORIZE_URL` | no | — (LinkedIn off) | — | app id, `https://www.linkedin.com/oauth/v2/authorization` | same | LinkedIn consent page (PKCE) |

Still to come: `NEXT_PUBLIC_WS_URL` (subscriptions), `NEXT_PUBLIC_SENTRY_DSN`, and `REVALIDATE_SECRET` (server-only, for
the API's on-demand ISR webhook) in the phases that use them.

## lvn-backend

Schemas: `apiConfigSchema` and `workerConfigSchema` in `@lvn/contracts/config`, loaded by `libs/config`. The worker
runs the same contexts as the API, so it reads every API variable as well as its own; give both tasks one environment. Secrets are
never listed with values; sandbox and production read them from AWS Secrets Manager.

| Variable | Process | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| `APP_ENV` | api, worker | yes | — | `development`, `sandbox` or `production` |
| `LOG_LEVEL` | api, worker | no | `info` | `fatal` … `trace` |
| `DATABASE_URL` | api, worker | yes (secret) | — | PostgreSQL 16 connection string; must start with `postgres` |
| `REDIS_URL` | api, worker | yes (secret) | — | Redis 7 connection string |
| `API_HOST` | api | no | `0.0.0.0` | Bind address |
| `API_PORT` | api | no | `4000` | HTTP + WebSocket port |
| `CORS_ORIGINS` | api | yes | — | Comma-separated allow-list (§7.2) |
| `WORKER_HEALTH_PORT` | worker | no | `4001` | `/health/live` for the ECS health check |
| `LEGACY_FIREBASE_PROJECT_ID` | worker | no | — | Old Firebase project read once by `pnpm --filter @lvn-backend/worker legacy:snapshot` (ADR-0023); credentials from `GOOGLE_APPLICATION_CREDENTIALS` (a read-only service account in Secrets Manager) |
| `S3_ENDPOINT` | api, worker | no | — (AWS) | S3-compatible endpoint; `http://localhost:59000` for RustFS locally (ADR-0032); unset on AWS |
| `S3_REGION` | api, worker | yes | — | `us-east-1` locally; `ap-south-1` in India deployments (§15.2) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | api, worker | no (secret) | — | Local credentials; on AWS the task role is used instead |
| `S3_FORCE_PATH_STYLE` | api, worker | no | `false` | `true` for RustFS |
| `S3_BUCKET` | api, worker | yes | — | Uploads and media (§8) |
| `S3_RESTRICTED_BUCKET` | api, worker | yes | — | Identity documents (ADR-0019) and old-site snapshots (ADR-0023), own encryption key, never behind the CDN |
| `MAIL_FROM` | api, worker | yes | — | Sender, e.g. `LearnViaNotes <no-reply@learnvianotes.in>` |
| `MAIL_TRANSPORT` | api, worker | yes | — | `smtp` (Mailpit locally) or `resend` |
| `SMTP_URL` | api, worker | when `smtp` | — | `smtp://localhost:51025` for Mailpit |
| `RESEND_API_KEY` | api, worker | when `resend` (secret) | — | Resend API key |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | api | yes (secret) | — | RS256 key pair for access tokens (§7.1), PEM with `\n` escapes; `pnpm keys:dev` writes a pair to `.env.local` |
| `JWT_ISSUER` | api | yes | — | The API's public origin (`iss` claim) |
| `WEB_URL` | api | yes | — | lvn-web origin for links in emails and OAuth redirects |
| `CODE_HMAC_SECRET` | api | yes (secret, ≥ 32 chars) | — | HMAC key for short codes (institutional email) |
| `DIGITAL_CONSENT_AGE` | api | no | `18` | Below it an account needs guardian or institutional consent or is a restricted minor (§15.2; 18 under DPDP) |
| `PASSWORD_BREACH_API_URL` | api | no | — (check off) | k-anonymity range API, `https://api.pwnedpasswords.com/range` (§7.1) |
| `FIREBASE_PROJECT_ID` | api | no | — (Google off) | Project whose ID tokens `signInWithGoogle` accepts (ADR-0007); no service account needed to verify |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | api | no (secret) | — (GitHub off) | OAuth app for `oauthExchange` |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | api | no (secret) | — (LinkedIn off) | OAuth app for `oauthExchange` |
| `GITHUB_OAUTH_URL`, `GITHUB_API_URL` | api | with GitHub | — | `https://github.com`, `https://api.github.com` |
| `LINKEDIN_OAUTH_URL`, `LINKEDIN_API_URL` | api | with LinkedIn | — | `https://www.linkedin.com/oauth/v2`, `https://api.linkedin.com/v2` |
| `OAUTH_REDIRECT_URIS` | api | with GitHub or LinkedIn | — | Comma-separated redirect URIs registered with the providers; `oauthExchange` refuses any other. Web: `<SITE_URL>/oauth/callback`; app (GitHub only): `<scheme>://oauth/callback` of each variant |

Local services (`pnpm infra:up`, `infra/docker/compose.yaml`) listen on 55432 (Postgres), 56379 (Redis), 59000/59001
(RustFS API/console) and 51025/58025 (Mailpit SMTP/UI) so other projects on the same machine keep the default ports.

Still to come: Sentry variables (Phase 1 hardening) and, in Phase 3, `FCM_SERVICE_ACCOUNT_JSON` (secret) for push
delivery through the FCM HTTP v1 API (ADR-0021).

## lvn-mobile

Schema: `mobileConfigSchema`, mirrored by lvn-mobile `lib/parse-env.ts` until the package is published. Values live
in lvn-mobile `env/<variant>.env` (public, committed) with per-machine overrides in `env/<variant>.local.env`
(git-ignored), applied by its build scripts (ADR-0008).

| Variable | Required | Development | Sandbox (`preview`) | Production | Purpose |
| --- | --- | --- | --- | --- | --- |
| `APP_VARIANT` | build time | `development` | `sandbox` | `production` | App name and bundle id in `app.config.ts` (not readable by app code) |
| `EXPO_PUBLIC_APP_ENV` | yes | `development` | `sandbox` | `production` | Environment badge; later feature defaults |
| `EXPO_PUBLIC_WEB_URL` | yes | `http://100.70.234.41:3000` | `https://sandbox.learnvianotes.in` | `https://www.learnvianotes.in` | Links into lvn-web |
| `EXPO_PUBLIC_API_URL` | yes | `http://100.70.234.41:4000/graphql` | `https://api.sandbox.learnvianotes.in/graphql` | `https://api.learnvianotes.in/graphql` | The API's GraphQL gateway; development builds allow plain HTTP for it |
| `EXPO_PUBLIC_GITHUB_CLIENT_ID` | no | — | — | — | GitHub sign-in in the app; empty hides the button. Redirect URI `<scheme>://oauth/callback` (schemes `learnvianotes-dev`, `learnvianotes-sandbox`, `learnvianotes`) |
| `EXPO_PUBLIC_GITHUB_AUTHORIZE_URL` | with the client id | `https://github.com/login/oauth/authorize` | same | same | GitHub's consent page |

Later in Phase 1 (ADR-0007): `EXPO_PUBLIC_FIREBASE_*` and the Google OAuth client ids used by native Google Sign-In, once
the Firebase project's Android and iOS apps exist. LinkedIn has no app variable: it does not redirect to app schemes.
Phase 3 (ADR-0021): `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICE_INFO_PLIST` — build-time paths to the Firebase config
files used for FCM device tokens.

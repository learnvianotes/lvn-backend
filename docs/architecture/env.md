# Environment variables

Canonical list (section 16.1). CI fails if code reads a variable that is missing here or from `.env.example`.
Every value is validated with Zod at start-up; a missing or malformed value stops the process.

## lvn-web

Validated in lvn-web `lib/env.ts` until `@lvn/contracts/config` is published (ADR-0003); the same schema is `webConfigSchema`.

| Variable | Required | Default | Development | Sandbox | Production | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | yes | `development` | `development` | `sandbox` | `production` | Gates indexing (`robots`, `noindex`) and, later, feature defaults |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3000` | `http://localhost:3000` | `https://sandbox.learnvianotes.com` | `https://learnvianotes.com` | Canonical URLs, sitemap, Open Graph |

Added in Phase 1 (names proposed, owned by `@lvn/contracts/config`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`,
`NEXT_PUBLIC_SENTRY_DSN`, `REVALIDATE_SECRET` (server-only, for the API's on-demand ISR webhook), and for Google
sign-in (ADR-0007) `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
`NEXT_PUBLIC_FIREBASE_APP_ID` (public identifiers, not secrets).

## lvn-backend

Schemas: `apiConfigSchema` and `workerConfigSchema` in `@lvn/contracts/config`, loaded by `libs/config`. Secrets are
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

Phase 1 adds JWT keys, OAuth client ids/secrets (GitHub, LinkedIn), S3/MinIO, mail and Sentry variables here first,
plus `FIREBASE_PROJECT_ID` for verifying Google sign-in ID tokens (ADR-0007; no service account needed to verify).

## lvn-mobile

Schema: `mobileConfigSchema`, mirrored by lvn-mobile `lib/parse-env.ts` until the package is published. Values live
in lvn-mobile `env/<variant>.env` (public, committed) with per-machine overrides in `env/<variant>.local.env`
(git-ignored), applied by its build scripts (ADR-0008).

| Variable | Required | Development | Sandbox (`preview`) | Production | Purpose |
| --- | --- | --- | --- | --- | --- |
| `APP_VARIANT` | build time | `development` | `sandbox` | `production` | App name and bundle id in `app.config.ts` (not readable by app code) |
| `EXPO_PUBLIC_APP_ENV` | yes | `development` | `sandbox` | `production` | Environment badge; later feature defaults |
| `EXPO_PUBLIC_WEB_URL` | yes | `http://100.70.234.41:3000` | `https://sandbox.learnvianotes.com` | `https://learnvianotes.com` | Links into lvn-web |

Phase 1 (ADR-0007): `EXPO_PUBLIC_FIREBASE_*` and the Google OAuth client ids used by native Google Sign-In.

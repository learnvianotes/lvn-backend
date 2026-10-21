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
| `NEXT_PUBLIC_SITE_URL` | yes | — | `http://localhost:3000` | the CloudFront address (ADR-0035) | `https://www.learnvianotes.in` | Canonical URLs, sitemap, Open Graph |
| `NEXT_PUBLIC_FEEDBACK_URL` | no | — (sending disabled) | the old site's Apps Script URL | same | same | `/core` help-centre feedback reports (Google Apps Script → Sheet) |
| `NEXT_PUBLIC_APP_VERSION` | no | `package.json` version | — | — | — | Version shown in the `/core` help centre and sent with feedback |
| `NEXT_DIST_DIR` | no | `.next` | — | — | — | Build output folder; Playwright builds to `.next-e2e` so it never clobbers `next dev` |
| `NEXT_PUBLIC_API_URL` | yes | — | `http://localhost:4000/graphql` | `<CloudFront address>/graphql` | `https://api.learnvianotes.in/graphql` | The API's GraphQL gateway |
| `NEXT_PUBLIC_LIVE_URL` | no | derived from `NEXT_PUBLIC_API_URL` in development; otherwise no live updates | `ws://localhost:4000/graphql/live` | `<CloudFront address, wss>/graphql/live` | `wss://api.learnvianotes.in/graphql/live` | Live updates over graphql-ws (ADR-0042) |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_APP_ID` | no | — (Google off) | — | the test project's (`learnvianotes-test`) | the production project's | Google sign-in through Firebase (ADR-0007); public identifiers, not secrets. A production build must use the production project and any other build must not (lvn-web `config/firebase-projects.json`, ADR-0093) |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID`, `NEXT_PUBLIC_GITHUB_AUTHORIZE_URL` | no | — (GitHub off) | — | app id, `https://github.com/login/oauth/authorize` | same | GitHub consent page (PKCE) |
| `NEXT_PUBLIC_LINKEDIN_CLIENT_ID`, `NEXT_PUBLIC_LINKEDIN_AUTHORIZE_URL` | no | — (LinkedIn off) | — | app id, `https://www.linkedin.com/oauth/v2/authorization` | same | LinkedIn consent page (PKCE) |
| `NEXT_PUBLIC_SENTRY_DSN` | no | — (off) | — | the web project's DSN | same | Browser and server errors (§16.5); a DSN is public by design |
| `NEXT_PUBLIC_STORAGE_ORIGINS` | no | — (any origin) | — | `https://*.s3.<region>.amazonaws.com` | same | Where pre-signed storage URLs point, space-separated; the Content Security Policy's `connect-src` allows only these besides the site, the API and sign-in (ADR-0090) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | no | — (no analytics) | — | optional, a test property | the GA4 property, `G-…` | Google Analytics 4, loaded only after the visitor allows it (ADR-0092) |
| `API_INTERNAL_URL` | no | `NEXT_PUBLIC_API_URL` | — | the API's address inside the VPC | same | Server-only: where server rendering (public note pages, sitemap) calls the API |
| `REVALIDATE_SECRET` | no | — (on-demand refresh off) | — | secret, ≥ 32 characters | same | Server-only: the API's calls to `/api/revalidate` must carry it; the same value as the API's |

Still to come: `NEXT_PUBLIC_WS_URL` (subscriptions) in the phase that uses it.

## lvn-backend

On AWS these are set by Terraform from `infra/terraform/envs/<env>/.env` (ADR-0035): the generated secrets go through
Secrets Manager, the rest into the task definitions; the sandbox's URLs are its CloudFront address.

Schemas: `apiConfigSchema` and `workerConfigSchema` in `@lvn/contracts/config`, loaded by `libs/config`. The worker
runs the same contexts as the API, so it reads every API variable as well as its own; give both tasks one environment. Secrets are
never listed with values; sandbox and production read them from AWS Secrets Manager.

| Variable | Process | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| `APP_ENV` | api, worker | yes | — | `development`, `sandbox` or `production` |
| `LOG_LEVEL` | api, worker | no | `info` | `fatal` … `trace` |
| `RELEASE` | api, worker | no | — (`dev`) | Image tag or commit SHA, reported with traces and errors |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | api, worker | no | — (off) | OTLP/HTTP collector base URL, e.g. the ECS sidecar `http://localhost:4318` (§16.5). The standard `OTEL_*` SDK variables (sampling, batch delay) apply too |
| `SENTRY_DSN` | api, worker | no | — (off) | Sentry project DSN for unexpected exceptions |
| `DATABASE_URL` | api, worker | yes (secret) | — | PostgreSQL 16 connection string; must start with `postgres` |
| `REDIS_URL` | api, worker | yes (secret) | — | Redis 7 connection string |
| `WEB_REVALIDATE_URL` | api, worker | no | — (off) | The web app's `/api/revalidate`: public note pages refresh when a note changes (P2d) and as its study aids are made (worker, ADR-0061) |
| `REVALIDATE_SECRET` | api, worker | no | — | Sent with those calls; at least 32 characters; the same value as the web app's |
| `MODERATION_WORDS_FILE` | api | no | — (built-in spam phrases only) | A file of `REASON: phrase` lines (REASON as in ReportReason, `#` comments) that hold content for review on its way to the public (ADR-0037) |
| `SEARCH_PROVIDER` | api | no | `postgres` | Who answers `search` (ADR-0055): `postgres`, or `typesense` (needs the two below) |
| `TYPESENSE_URL` | api, worker | with `TYPESENSE_API_KEY` | — (no Typesense) | Typesense's HTTP API, e.g. `http://typesense:8108`. When set, the worker keeps the collections whichever provider answers |
| `TYPESENSE_API_KEY` | api, worker | with `TYPESENSE_URL` (secret) | — | Typesense's admin key; it never leaves the server |
| `TYPESENSE_COLLECTION_PREFIX` | api, worker | no | `lvn_` | Prefix of every collection, alias and stop-word set, so environments can share a cluster |
| `SEARCH_TIMEOUT_MS` | api | no | `800` | A Typesense answer slower than this is dropped and Postgres answers instead |
| `SEARCH_HYBRID` | api | no | `false` | Hybrid ranking (ADR-0057): keyword and semantic ranks fused by reciprocal rank fusion. Changes nothing until Phase 5 binds a semantic source |
| `AI_PROVIDER` | api, worker | no | `none` (AI off) | `ollama`: a local model (ADR-0058). Needs the three below. Answers when platform admins have not chosen a connection on /admin/ai (ADR-0065) |
| `OLLAMA_URL` | api, worker | with `ollama` | — | Ollama's HTTP API: `http://127.0.0.1:11434` on a dev machine, `http://10.0.2.2:11434` from the local VM (QEMU's address for the host) |
| `AI_CHAT_MODEL` | api, worker | with `ollama` | — | Default model for text and images (`gemma4`); `ai.AiModelRoute` rows override it per task |
| `AI_EMBED_MODEL` | api, worker | with `ollama` | — | Default embedding model (`embeddinggemma`, 768 dimensions) |
| `AI_TIMEOUT_MS` | api, worker | no | `120000` | A provider call slower than this fails (a local model's first call loads it) |
| `AI_MONTHLY_BUDGET_MICRO_USD` | api, worker | no | — (no cap) | The environment's monthly AI budget in millionths of a dollar: at it, the breaker pauses AI until next month (§10.1) |
| `AI_KEYS_SECRET` | api, worker | no | — (keys cannot be saved) | Encrypts the provider keys platform admins save on the web's AI providers page (AES-256-GCM, ADR-0065); at least 32 characters. Changing it makes saved keys unreadable: enter them again |
| `AI_PUBLIC_PIPELINE` | api, worker | no | `true` | Study aids (summary, key concepts, questions, quiz, flashcards) made when a note is published PUBLIC: five model calls per version, as the platform's work (ADR-0061) |
| `POSTHOG_HOST` | api, worker | with the key | — (off) | A self-hosted PostHog that gets a pseudonymous copy of learning events from the worker (type, platform, duration; an HMAC of the user id), ADR-0067 |
| `POSTHOG_API_KEY` | api, worker | with the host | — (off) | The PostHog project's key |
| `CLAMAV_URL` | worker | no | — (uploads not scanned) | ClamAV's clamd, `tcp://host:3310`: uploads are scanned and infected ones quarantined (ADR-0041) |
| `API_HOST` | api | no | `0.0.0.0` | Bind address |
| `API_PORT` | api | no | `4000` | HTTP + WebSocket port |
| `CORS_ORIGINS` | api | yes | — | Comma-separated allow-list (§7.2) |
| `TRUST_PROXY_HOPS` | api | no | `0` | Proxies in front of the API whose `X-Forwarded-For` is trusted for the client address used by rate limits: `0` locally, `1` behind the ALB, `2` behind CloudFront + ALB. Higher than the real number lets clients choose their address |
| `WORKER_HEALTH_PORT` | worker | no | `4001` | `/health/live` for the ECS health check |
| `LEGACY_FIREBASE_PROJECT_ID` | worker | no | — | Old Firebase project read once by `pnpm --filter @lvn-backend/worker legacy:snapshot` (ADR-0023); credentials from `GOOGLE_APPLICATION_CREDENTIALS` (a read-only service account in Secrets Manager) |
| `S3_ENDPOINT` | api, worker | no | — (AWS) | S3-compatible endpoint; `http://localhost:59000` for RustFS locally (ADR-0032); unset on AWS |
| `S3_REGION` | api, worker | yes | — | `us-east-1` locally; `ap-south-1` in India deployments (§15.2) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | api, worker | no (secret) | — | Local credentials; on AWS the task role is used instead |
| `S3_FORCE_PATH_STYLE` | api, worker | no | `false` | `true` for RustFS |
| `S3_BUCKET` | api, worker | yes | — | Uploads and media (§8) |
| `UPLOADS_ENABLED` | api, worker | no | `false` | People may upload files (ADR-0097). Off, `createUploadIntent` answers UNAVAILABLE and the clients hide every upload control (`Query.uploadsEnabled`); `true` in development and the local environment |
| `S3_RESTRICTED_BUCKET` | api, worker | yes | — | Identity documents (ADR-0019) and old-site snapshots (ADR-0023), own encryption key, never behind the CDN |
| `MAIL_FROM` | api, worker | yes | — | Sender, e.g. `LearnViaNotes <no-reply@learnvianotes.in>` |
| `MAIL_TRANSPORT` | api, worker | yes | — | `smtp` (Mailpit locally), `ses` (AWS, sent with the task role — ADR-0035) or `resend` |
| `SMTP_URL` | api, worker | when `smtp` | — | `smtp://localhost:51025` for Mailpit |
| `RESEND_API_KEY` | api, worker | when `resend` (secret) | — | Resend API key |
| `SES_REGION` | api, worker | when `ses` | — | Region of the SES identity `MAIL_FROM` uses |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | api | yes (secret) | — | RS256 key pair for access tokens (§7.1), PEM with `\n` escapes; `pnpm keys:dev` writes a pair to `.env.local` |
| `JWT_ISSUER` | api | yes | — | The API's public origin (`iss` claim); `https://` makes the web refresh cookie `Secure`, so a development API reached at the machine's LAN/VPN address over HTTP still keeps browser sessions |
| `WEB_URL` | api | yes | — | lvn-web origin for links in emails and OAuth redirects |
| `CODE_HMAC_SECRET` | api | yes (secret, ≥ 32 chars) | — | HMAC key for short codes (institutional email) |
| `DIGITAL_CONSENT_AGE` | api | no | `18` | Below it an account needs guardian or institutional consent or is a restricted minor (§15.2; 18 under DPDP) |
| `ACCOUNT_MINIMUM_AGE` | api | no | `18` | Below it no account is created: sign-up refuses, and a provider account's under-age answer erases it (ADR-0091). `0` lets everyone register (minors restricted by `DIGITAL_CONSENT_AGE`) |
| `PASSWORD_BREACH_API_URL` | api | no | — (check off) | k-anonymity range API, `https://api.pwnedpasswords.com/range` (§7.1) |
| `FIREBASE_PROJECT_ID` | api | no | — (Google off) | Project whose ID tokens `signInWithGoogle` accepts (ADR-0007); no service account needed to verify |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | api | no (secret) | — (GitHub off) | OAuth app for `oauthExchange` |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | api | no (secret) | — (LinkedIn off) | OAuth app for `oauthExchange` |
| `GITHUB_OAUTH_URL`, `GITHUB_API_URL` | api | with GitHub | — | `https://github.com`, `https://api.github.com` |
| `GITLAB_API_URL` | api, worker | no | — (GitLab repositories show the link only) | `https://gitlab.com/api/v4`: public details of a project workspace's GitLab repository (ADR-0048). `GITHUB_API_URL` serves GitHub repositories the same way |
| `OPEN_LIBRARY_URL`, `OPEN_LIBRARY_COVERS_URL` | api | no | — (ISBNs are not looked up) | `https://openlibrary.org`, `https://covers.openlibrary.org`: a book's details and cover by ISBN when someone submits a resource (ADR-0074). No key; requests name LearnViaNotes and its web address |
| `SAFE_FETCH_ALLOW_HOSTS` | api | no | — | Comma-separated hosts the safe fetcher reaches although they are not on the public internet (ADR-0074): a test's stand-in server. **Never in production** |
| `FCM_API_URL`, `GOOGLE_OAUTH_TOKEN_URL` | api, worker | with push | — (push off) | `https://fcm.googleapis.com`, `https://oauth2.googleapis.com/token` (ADR-0050) |
| `FCM_SERVICE_ACCOUNT_JSON` | api, worker | with push (secret) | — (push off) | The Firebase project's service account key, as JSON; only the Cloud Messaging role is needed (ADR-0021) |
| `GITHUB_TOKEN` | api, worker | no (secret) | — | A token with no scopes, for GitHub's higher rate limit on public repository details (ADR-0048) |
| `GITHUB_APP_ID` | api, worker | no | — | The GitHub App's id (ADR-0078); all of `GITHUB_APP_*` or none |
| `GITHUB_APP_SLUG` | api, worker | no | — | The App's slug, for its install link |
| `GITHUB_APP_PRIVATE_KEY` | api, worker | no (secret) | — | The App's private key (PEM, line breaks as `\n`), signing its RS256 JWTs |
| `GITHUB_APP_WEBHOOK_SECRET` | api, worker | no (secret) | — | Checks each delivery's `X-Hub-Signature-256`; at least 16 characters |
| `GITHUB_APP_CLIENT_ID` | api, worker | no | — | The App's OAuth client, to confirm who installed it |
| `GITHUB_APP_CLIENT_SECRET` | api, worker | no (secret) | — | The App's OAuth client secret |
| `GITHUB_APP_URL` | api, worker | no | — | GitHub's web origin (https://github.com): install links and the OAuth code exchange |
| `LINKEDIN_OAUTH_URL`, `LINKEDIN_API_URL` | api | with LinkedIn | — | `https://www.linkedin.com/oauth/v2`, `https://api.linkedin.com/v2` |
| `OAUTH_REDIRECT_URIS` | api | with GitHub or LinkedIn | — | Comma-separated redirect URIs registered with the providers; `oauthExchange` refuses any other. Web: `<SITE_URL>/oauth/callback`; app (GitHub only): `<scheme>://oauth/callback` of each variant |

Local services (`pnpm infra:up`, `infra/docker/compose.yaml`) listen on 55432 (Postgres), 56379 (Redis), 59000/59001
(RustFS API/console) and 51025/58025 (Mailpit SMTP/UI) so other projects on the same machine keep the default ports.

Still to come: Sentry variables (Phase 1 hardening) and, in Phase 3, `FCM_SERVICE_ACCOUNT_JSON` (secret) for push
delivery through the FCM HTTP v1 API (ADR-0021).

### workers/pdf-engine (Python, ADR-0028)

Read by `src/pdf_engine/config.py` at start-up; a missing or malformed value stops it. Its README lists them too.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `REDIS_URL` | yes | — | The API's Redis (BullMQ) |
| `S3_ENDPOINT` | no | AWS | Storage endpoint; inside the network on the local VM (`http://s3:9000`) |
| `S3_REGION` | no | `us-east-1` | |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | no | the task role | |
| `S3_FORCE_PATH_STYLE` | no | `false` | `true` for RustFS |
| `PDF_ENGINE_QUEUE` | no | `notes.pdf-parse` | The jobs it takes |
| `PDF_ENGINE_RESULT_QUEUE` | no | `notes.pdf` | Where it answers |
| `PDF_ENGINE_CONCURRENCY` | no | `1` | PDFs at a time, 1–8 (about 2 GB each) |
| `PDF_ENGINE_OCR_LANGUAGES` | no | `en` | PP-OCR recognisers, comma-separated |

## lvn-mobile

Schema: `mobileConfigSchema`, mirrored by lvn-mobile `lib/parse-env.ts` until the package is published. Values live
in lvn-mobile `env/<variant>.env` (public, committed) with per-machine overrides in `env/<variant>.local.env`
(git-ignored), applied by its build scripts (ADR-0008).

| Variable | Required | Development | Sandbox (`preview`) | Production | Purpose |
| --- | --- | --- | --- | --- | --- |
| `APP_VARIANT` | build time | `development` | `sandbox` | `production` | App name and bundle id in `app.config.ts` (not readable by app code) |
| `EXPO_PUBLIC_APP_ENV` | yes | `development` | `sandbox` | `production` | Environment badge; later feature defaults |
| `EXPO_PUBLIC_WEB_URL` | yes | `http://100.70.234.41:3000` | the CloudFront address, in `env/sandbox.local.env` | `https://www.learnvianotes.in` | Links into lvn-web |
| `EXPO_PUBLIC_API_URL` | yes | `http://100.70.234.41:4000/graphql` | `<CloudFront address>/graphql`, in `env/sandbox.local.env` | `https://api.learnvianotes.in/graphql` | The API's GraphQL gateway; development builds allow plain HTTP for it |
| `EXPO_PUBLIC_LIVE_URL` | no | `ws://100.70.234.41:4000/graphql/live` | `<CloudFront address, wss>/graphql/live`, in `env/sandbox.local.env` | `wss://api.learnvianotes.in/graphql/live` | Live updates while the app is open (ADR-0042); unset means none outside development |
| `EXPO_PUBLIC_GITHUB_CLIENT_ID` | no | — | — | — | GitHub sign-in in the app; empty hides the button. Redirect URI `<scheme>://oauth/callback` (schemes `learnvianotes-dev`, `learnvianotes-sandbox`, `learnvianotes`) |
| `EXPO_PUBLIC_GITHUB_AUTHORIZE_URL` | with the client id | `https://github.com/login/oauth/authorize` | same | same | GitHub's consent page |
| `EXPO_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_APP_ID` | no | — (Google off) | the Firebase web app's config | same | Google sign-in (ADR-0007): Firebase turns the Google account into the ID token the API accepts. Public identifiers |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | with Firebase | the "Web client" OAuth id the Firebase Google provider created | same | same | Audience of the ID token native Google Sign-In returns, so Firebase accepts it |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | for iOS builds | the Firebase iOS app's OAuth client | same | same | Native Google Sign-In on iOS |
| `EXPO_PUBLIC_SENTRY_DSN` | no | — (off) | the mobile project's DSN | same | Crashes and JS errors (§16.5) |

LinkedIn has no app variable: it does not redirect to app schemes.
`GOOGLE_SERVICES_JSON` (build time, not `EXPO_PUBLIC_`): path of the variant's Firebase Android config,
`firebase/<variant>/google-services.json` (git-ignored), applied with the Google Services Gradle plugin 4.5.0 when the
file exists. Phase 3 (ADR-0021) adds `GOOGLE_SERVICE_INFO_PLIST`, its iOS counterpart, with FCM.

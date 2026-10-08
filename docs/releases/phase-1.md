# Phase 1 — Foundation (exit criteria shown on the local environment; Google there and the AWS sandbox run remain)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18. Scope: repositories, configuration, NestJS +
Prisma + Redis + S3, sign-in (email and three providers), registration with date of birth and institutional email,
verification, old-site data, student profile, plan limits, sessions, roles, `PolicyService`, uploads, logging, error
codes, Testcontainers, Docker Compose, Terraform for sandbox, CI, Sentry, OpenTelemetry.

Everything below runs and is tested locally. Until the AWS account exists, the exit criteria were shown on the
**local environment** (ADR-0036): the sandbox's images, generated secrets, migration step and single entrance, on a VM
on the dev machine, deployed with Terraform. The same checks run against the AWS sandbox once it exists.

## Shipped

### lvn-backend

| Area | What | Where |
| --- | --- | --- |
| Composition | Apollo Federation 2 with schema-first SDL per context (ADR-0033); Apollo Gateway composes the subgraphs in-process at `/graphql`; subgraph endpoints private | `libs/graphql`, `apps/api` |
| Data | Prisma 7 (pg adapter), users / notes / core schemas, migrations with the free plan seeded | `prisma/` |
| Sign-in (§7.1) | Email + password (Argon2id, breached-password check), RS256 access tokens, rotating refresh tokens with family revocation on reuse, Redis revocation markers; Google through Firebase (ADR-0007), GitHub and LinkedIn by Authorization Code + PKCE; mobile clients get the refresh token in the body (`X-LVN-Client: mobile`) | `contexts/users`, `libs/auth-guard`, `libs/redis` |
| Registration (ADR-0017) | Date of birth (strict), terms version, restricted minors, institutional email with a 6-digit code and domain review | `contexts/users` |
| Verification (ADR-0019) | By a teacher or by platform-admin document review; documents in the restricted bucket, viewed through audited 15-minute links, purged 30 days after the decision | `contexts/users`, `apps/worker` |
| Uploads (§8) | FileObject row first, pre-signed PUT, magic-byte check, plan storage quota | `contexts/notes`, `libs/storage` |
| Profile, limits, old site | Student profile (ADR-0026), plan entitlements (ADR-0024), old-site snapshot and claim with `coreProgress` (ADR-0023) | `contexts/users`, `contexts/core` |
| Abuse limits | Depth 8 / complexity 1000 (VALIDATION, HTTP 400), list caps, per-account sign-in limit, per-network failed sign-in limit (IPv6 by /64), `TRUST_PROXY_HOPS` | `libs/graphql`, `contexts/users` |
| Observability (§16.5) | JSON logs with request id, operation, queue/job, redaction; OpenTelemetry traces and metrics over OTLP; Sentry for unexpected errors only, scrubbed; flush on SIGTERM; readiness checks Postgres, Redis and the schema version | `libs/observability`, `apps/*/src/instrument.ts`, `apps/api/src/health` |
| Security suite (§17.1) | Students A and B, Teacher T, an admin; every mutation fuzzed for role escalation; URL lifetimes and re-checks; upload abuse; query limits; brute force and credential stuffing; refresh reuse; viewer-only fields. Later channels are `it.todo` | `apps/api/test/security` |
| Packaging and infra | One image for API, worker and migrations; a domain-free Terraform sandbox from one `.env` (CloudFront → internal ALB, ECS, RDS, Redis, S3 + KMS, generated secrets, SES) and a deploy script (ADR-0035) | `infra/docker`, `infra/terraform`, `infra/scripts` |
| Local environment (ADR-0036) | A Debian VM under QEMU/KVM with Docker and Terraform inside; `envs/local` deploys the same images with PostgreSQL 16 + pgvector, Redis 7, RustFS, Mailpit, a migration step and a Caddy entrance (`/graphql`, `/health/*` → API); `deploy-local.sh`; `pnpm smoke <url>` for any environment | `infra/local-vm`, `infra/terraform/envs/local`, `scripts/smoke.mjs` |
| CI | Build, lint, typecheck, boundaries, schema and env checks, all tests (Testcontainers), migrations on empty Postgres + drift, image build, Terraform validate, gitleaks, audit; security suite on relevant PRs and nightly | `.github/workflows` |
| Contracts | `@lvn/contracts` 0.9.0 → 0.13.0 (config for all three apps, events, notifications) | `contracts/`, `docs/api-changes/` |

### lvn-web

Sign-in, sign-up (with date of birth and college email), registration details for provider accounts, email and code
verification, password reset, GitHub/LinkedIn/Google buttons when configured, an account page (verification, college
email, study details, old-site data); `/core` unchanged from the old site. Sentry when a DSN is set, a container image,
and a CI contract check against the API schema. The landing page and sign-in pages put Continue with Google first,
in the night-sky look of the app; `tests/e2e/live.spec.ts` drives a deployed environment with nothing mocked.

### lvn-mobile

Sign-in and sign-up against the API with tokens in expo-secure-store, refresh before expiry, offline-tolerant restore,
registration details, the college-email code, password-reset request, the account tab and sign-out; Google sign-in
(native Google Sign-In → Firebase → the API) and GitHub (PKCE) when configured, with a Google-first welcome screen;
per-variant URL schemes; Sentry when a DSN is set; a CI contract check.

## Test evidence (2026-10-08, local)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck, boundaries | clean | clean | clean |
| Unit / integration / e2e | 337 passing + 10 todo across 15 packages; API 126 (incl. security 24 + 10 todo) | 60 unit (Vitest) | 79 (Jest: unit + the real routes against a fake API) |
| Browser / device E2E | — | 55/55 Playwright, axe clean on sign-in and sign-up | 5/5 Maestro flows on the `lvn_pixel_7` emulator (Android 36) against the dev API: smoke, sign-up with the college-email code read from Mailpit, sign-out, wrong password, sign-in, restart, Home, tabs, create sheet |
| Contract | `graphql:check`, `env:check` (41 variables) | codegen + typecheck against the current schema | same |
| Migrations | applied to an empty database, no drift from `schema.prisma` | — | — |
| Containers | image built; `migrate deploy`, API ready and answering, worker healthy, both exit 0 on SIGTERM | image built (589 MB); pages 200, exits 0 on SIGTERM | APK built locally, no Expo account |
| Telemetry | built API exports HTTP, GraphQL, Postgres and Redis spans to a stand-in collector, without variables; Sentry events carry the request id and nothing personal | Sentry scrubbing unit-tested | Sentry gate and scrubbing unit-tested |
| Infra | `terraform fmt -check`, `validate` (AWS provider 6.68) | — | — |
| Workflows | actionlint clean | actionlint clean | actionlint clean |

Bugs the new suites found and fixed in this phase: GraphQL answered a missing variable with INTERNAL / 500; the
standard introspection query was refused by the depth limit even in development; Sentry's defaults would have sent
local variables and source lines; trailing spaces from autocomplete made emails invalid on mobile; an empty Docker
build argument failed the web build; credential stuffing across accounts was not rate-limited.

### On the local environment (2026-10-08)

lvn-backend `190b379`, lvn-web `fbead1a`, deployed with `infra/scripts/deploy-local.sh` from clean trees to
`http://100.70.234.41:8080` (the dev machine's Tailscale address; S3 endpoint on `:8081`).

| Check | Result |
| --- | --- |
| Deploy | Terraform 1.16.5 in the VM: 8 containers healthy; the migration ran as its own step before api and worker started on the new image; a second deploy replaced only the apps |
| `pnpm smoke` | 11/11: ready (database, Redis, schema), web on the same origin, email sign-up as the app, rotating refresh, sign-in as the web (HttpOnly cookie, no token in the body), wrong password refused, avatar and identity document through pre-signed PUTs into both buckets, sign-up email in Mailpit |
| Playwright, live (lvn-web) | 4/4 (desktop and phone): landing card → email sign-up → profile, session restored from the cookie after a reload, sign-out, sign-in; Continue with Google offered |
| Maestro (lvn-mobile) | 5/5 on the `lvn_pixel_7` emulator, development build pointed at the environment: smoke, auth (sign-up with the college-email code from the environment's Mailpit, sign-out, wrong password, sign-in, restart), create sheet, home, tabs |
| Restart | `vm.sh stop` / `up`: SSH in 7 s, every container back by itself, data kept |
| Footprint | about 0.7 GB of the VM's 6 GB; 4.9 GB of 40 GB disk |

## Exit criteria (§18)

Owner decisions of 2026-10-08: sign-in at launch shows **email and Google**; GitHub and LinkedIn stay in the code,
switched off until configured, for later. The sandbox needs **no domain** and is configured from one `.env`
(ADR-0035). The owner creates the Sentry organisation and publishes the repositories.

- [ ] **Web and mobile sign in with email and Google** — email: done on both in dev and on the local environment
  (Playwright live 4/4, Maestro 5/5). Google: done for real in dev on the owner's phone (native Google Sign-In →
  Firebase → API) and on the web (Firebase popup); offered on the local environment, which accepts the same tokens,
  and waiting for one tap by the owner there (below). AWS sandbox: when the account exists.
- [x] **Migration deploys** — on the local environment, as its own step on every new image (`deploy-local.sh`); in CI
  on an empty database. AWS sandbox: `deploy.sh` runs the migrate task.
- [x] **File upload round-trips** — on the local environment through its published S3 endpoint, into both buckets
  (`pnpm smoke`). AWS sandbox: the same command against its URL.
- [x] **Security suite scaffold passes.**

On AWS the same three checks are `infra/scripts/deploy.sh sandbox`, `pnpm smoke <public_url>` and the live specs.

## Needed from the owner

- **Google on the local environment (one tap each):** on the web, add `100.70.234.41` to Firebase → Authentication →
  Settings → Authorized domains, open `http://100.70.234.41:8080` and Continue with Google; on the phone, a development
  build pointed at the environment (`EXPO_PUBLIC_API_URL=http://100.70.234.41:8080/graphql` in
  `env/development.local.env`) and Continue with Google.

- **AWS:** an account with an administrator CLI profile on the deploying machine (AWS CLI v2, Terraform ≥ 1.9, Docker,
  `jq`), and a sender email address for SES. Everything else is created by `infra/terraform/bootstrap.sh` and
  `infra/scripts/deploy.sh` from `infra/terraform/envs/sandbox/.env` (`infra/terraform/README.md`).
- **Firebase:** Google enabled; the web app's config; Android apps with the signing key's SHA-1; the Web client ID
  (lvn-mobile `docs/architecture/mobile-addendum.md` → Sign-in). Then the CloudFront host in Authentication →
  Authorized domains.
- Sentry organisation and publishing: done by the owner.

## Known gaps carried forward

- A deploy workflow in GitHub Actions (the script runs locally; CI needs an OIDC role).
- WAF rules; the OpenTelemetry collector and its backends.
- Lighthouse CI on public routes (§16.4) — with the public note page (Phase 2).
- Maestro and Playwright against sandbox on `main` (§16.4) — with sandbox.
- Android App Links / iOS universal links: emailed links open the web meanwhile.
- Mobile Sentry symbolication (Sentry Expo plugin and token).
- The backend image is 1.2 GB (all production dependencies); slim it with per-app `pnpm deploy`.

GraphQL schema: `contracts/graphql/schema.graphql` as of `@lvn/contracts` 0.14.0.

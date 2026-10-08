# Phase 1 — Foundation (code complete; exit criteria open)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18. Scope: repositories, configuration, NestJS +
Prisma + Redis + S3, sign-in (email and three providers), registration with date of birth and institutional email,
verification, old-site data, student profile, plan limits, sessions, roles, `PolicyService`, uploads, logging, error
codes, Testcontainers, Docker Compose, Terraform for sandbox, CI, Sentry, OpenTelemetry.

Everything below runs and is tested locally. The phase cannot close until it runs in sandbox, which needs the AWS
account and the provider credentials listed under "Exit criteria".

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
| Packaging and infra | One image for API, worker and migrations; Terraform for the sandbox (VPC, RDS, Redis, S3 + KMS, Secrets Manager, ECS, ALB) | `infra/docker`, `infra/terraform` |
| CI | Build, lint, typecheck, boundaries, schema and env checks, all tests (Testcontainers), migrations on empty Postgres + drift, image build, Terraform validate, gitleaks, audit; security suite on relevant PRs and nightly | `.github/workflows` |
| Contracts | `@lvn/contracts` 0.9.0 → 0.13.0 (config for all three apps, events, notifications) | `contracts/`, `docs/api-changes/` |

### lvn-web

Sign-in, sign-up (with date of birth and college email), registration details for provider accounts, email and code
verification, password reset, GitHub/LinkedIn/Google buttons when configured, an account page (verification, college
email, study details, old-site data); `/core` unchanged from the old site. Sentry when a DSN is set, a container image,
and a CI contract check against the API schema.

### lvn-mobile

Sign-in and sign-up against the API with tokens in expo-secure-store, refresh before expiry, offline-tolerant restore,
registration details, the college-email code, password-reset request, the account tab and sign-out; GitHub sign-in
(PKCE) when configured; per-variant URL schemes; Sentry when a DSN is set; a CI contract check.

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

## Exit criteria (§18)

- [ ] **Web and mobile sign in on all providers in dev and sandbox.** Email + password: done in dev on both. Google:
  needs the Firebase project's web config, and its Android/iOS apps for mobile. GitHub: needs the OAuth apps (one per
  environment, redirect URIs in `docs/architecture/env.md`). LinkedIn: web only until app links exist — LinkedIn does
  not redirect to app schemes. Sandbox: needs the AWS account.
- [ ] **Migration deploys** — to sandbox. Locally and in the CI job: done.
- [ ] **File upload round-trips** — in sandbox. Locally against S3-compatible RustFS: done.
- [x] **Security suite scaffold passes.**

## Needed from the owner

AWS sandbox account (and later production), a Resend account and sending domain, GitHub and LinkedIn OAuth apps,
the Firebase project's web/Android/iOS apps, a Sentry organisation, and publishing the three repositories to the
`learnvianotes` organisation (CI has only run locally).

## Known gaps carried forward

- Deploy workflow (ECR push, migrate task, service update) — with the AWS account and a GitHub OIDC role.
- CloudFront, WAF, Route 53; the OpenTelemetry collector and its backends.
- Lighthouse CI on public routes (§16.4) — with the public note page (Phase 2).
- Maestro and Playwright against sandbox on `main` (§16.4) — with sandbox.
- Android App Links / iOS universal links: emailed links open the web meanwhile.
- Mobile Sentry symbolication (Sentry Expo plugin and token).
- The backend image is 1.2 GB (all production dependencies); slim it with per-app `pnpm deploy`.

GraphQL schema: `contracts/graphql/schema.graphql` as of `@lvn/contracts` 0.13.0.

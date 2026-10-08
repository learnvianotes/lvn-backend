# lvn-backend

LearnViaNotes backend: a NestJS modular monolith of five bounded contexts, built so each context can be extracted
into its own service (spec §3, §6). Also publishes **`@learnvianotes/contracts`** — imported everywhere as
`@lvn/contracts` (ADR-0031) — the package web and mobile build against.

**Start here:** [docs/architecture/lvn-architecture-v2.md](docs/architecture/lvn-architecture-v2.md) — the single
source of truth for all three repositories. Status: [Phase 0](docs/releases/phase-0.md).

## Layout

```text
apps/api          composition root: HTTP (+ GraphQL from Phase 1), health probes
apps/worker       composition root: background jobs (BullMQ from Phase 1), health port
contexts/<name>   users · notes · core · ai · communication — one future microservice each; see each README
libs/config       validated configuration (business-free)
libs/observability  JSON logs with request ids and redaction; OpenTelemetry and Sentry start-up
contracts         @lvn/contracts: domain enums, permission matrix, config + event schemas, GraphQL schema
prisma            one database, one Postgres schema per context
docs              architecture, ADRs, API changes, runbooks, release notes
```

Rules that keep extraction cheap (enforced): contexts never import each other (`pnpm boundaries`), no foreign keys
across Postgres schemas, configuration only through `libs/config`, contracts import nothing from this repo.

## Develop

Requires Node 22 and pnpm 10.

```bash
pnpm install
cp .env.example .env           # every URL and port; personal overrides go in .env.local
pnpm keys:dev                  # JWT key pair + code secret → .env.local
pnpm infra:up                  # Postgres 16 + pgvector, Redis 7, RustFS (S3), Mailpit — infra/docker/compose.yaml
pnpm db:migrate                # apply prisma/migrations
pnpm build
pnpm dev                       # GraphQL gateway on :4000/graphql, worker health on :4001
pnpm lint && pnpm typecheck && pnpm test && pnpm boundaries
```

Emails the API sends locally are at http://localhost:58025 (Mailpit); stored files at http://localhost:59001 (RustFS).

The worker (`apps/worker`) runs the contexts' BullMQ jobs (e.g. the daily purge of decided verification documents,
ADR-0019) and one-off commands:

```bash
pnpm --filter @lvn-backend/worker legacy:snapshot   # copy the old site's data into the restricted bucket (ADR-0023)
```
Docker must be running for the integration and e2e tests: they start their own containers (Testcontainers).

## Logs

Both apps write one JSON object per line to stdout (pino): `level`, ISO `time`, `service` (`lvn-api`, `lvn-worker`),
`env`, `msg`, and — on every line written while handling a request or job — `requestId` (from a well-formed
`X-Request-Id`, otherwise generated, and echoed in the response), the GraphQL `operation`, or `queue` and `jobId`.
The API writes one access-log line per request (method, path without query string, status, `durationMs`; health checks
are skipped). Request bodies, GraphQL variables and query strings are never logged, and credentials, tokens, codes and
dates of birth are redacted wherever they appear. `LOG_LEVEL` sets the level; pipe through `npx pino-pretty` to read
them locally.

Traces and metrics (OpenTelemetry over OTLP/HTTP) start when `OTEL_EXPORTER_OTLP_ENDPOINT` is set: incoming HTTP,
GraphQL, Postgres, Redis and outgoing fetch, without variables, SQL parameters or Redis arguments; log lines inside a
trace carry its `traceId`. Unexpected exceptions go to Sentry when `SENTRY_DSN` is set — tagged with the request id,
operation, queue and job, and stripped of cookies, bodies, headers, local variables and source lines. Each app's
`src/instrument.ts` starts both before anything else loads; on SIGTERM the app closes, then flushes them.

## GraphQL

One public endpoint, `/graphql`: Apollo Gateway composing each context's federation subgraph in-process (§6,
ADR-0033). A context's schema is SDL in `contexts/<ctx>/src/graphql/*.graphql`; its TypeScript types are generated
(`schema.types.ts`, by the context's build); `pnpm graphql:export` writes the composed `contracts/graphql/schema.graphql`
(client codegen input) and `supergraph.graphql`, and CI fails if they are stale (`pnpm graphql:check`).

## Tests

Every package keeps its tests in `test/`, never in `src/` (Jest, `testMatch: <rootDir>/test/**/*.test.ts`):

| Folder | What | Runs against |
| --- | --- | --- |
| `test/unit/` | domain rules, `PolicyService`, validators, job handlers, contracts | nothing external |
| `test/integration/` | GraphQL resolvers, auth and upload flows, queue → worker (from Phase 1) | Testcontainers Postgres / Redis / MinIO |
| `test/e2e/` | a composed app over HTTP (`apps/api`) | the app in-process |

`contracts/` holds 80 % line coverage and 100 % branch coverage on `src/domain/permissions.ts` (spec §17).
The security suite of spec §17.1 lands in `apps/api/test/security/` with Phase 1.

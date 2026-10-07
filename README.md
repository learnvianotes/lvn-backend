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
cp .env.example .env.local
pnpm build
pnpm dev                       # api on :4000, worker health on :4001
pnpm lint && pnpm typecheck && pnpm test && pnpm boundaries
DATABASE_URL=postgresql://x:y@localhost/lvn pnpm prisma:validate
```

Postgres, Redis, MinIO and Typesense via Docker Compose arrive in Phase 1 (`infra/docker/`).

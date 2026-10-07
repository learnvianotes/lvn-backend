# Phase 0 — Architecture (in progress)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18

## Shipped

### lvn-backend (this repository)

| Item | Where |
| --- | --- |
| Spec, existing-state inventory, ERD, env reference | `docs/architecture/` |
| ADR-0001 … ADR-0006 | `docs/adr/` |
| pnpm + Turborepo workspace; api + worker composition roots; five empty context packages; `libs/config` | `apps/`, `contexts/`, `libs/` |
| Permission matrix + domain enums in `@lvn/contracts/domain` | `contracts/src/domain/` |
| Config schemas (api, worker, web, mobile) and event schemas | `contracts/src/config/`, `contracts/src/events/` |
| GraphQL schema skeleton (SDL draft for sign-off) | `contracts/graphql/schema-skeleton.graphql` |
| Prisma: five Postgres schemas, extensions, no models | `prisma/schema.prisma`, `prisma.config.ts` |
| Context boundary rules | `.dependency-cruiser.cjs` |
| CI (build, lint, typecheck, test, boundaries, Prisma validate, gitleaks, audit), contracts publish on tag | `.github/workflows/` |

### lvn-web (branch `platform/v2-rewrite`)

Next.js 15 skeleton per §12.1, landing page, existing study content at `/core` (ADR-0002), redirects from old URLs,
old service worker removal, Playwright + axe, CI. Details in lvn-web `docs/architecture/web-addendum.md`.

## Test evidence (2026-10-08, local)

| Check | lvn-backend | lvn-web |
| --- | --- | --- |
| Build | 9/9 packages | 805 static pages, 106 kB first-load JS |
| Lint, typecheck | clean | clean |
| Unit / integration | 30 tests (contracts 27, api health 2, worker 1); `permissions.ts` 100 % branches | 7 unit tests |
| E2E | — | 12/12 Playwright (desktop + Pixel 7), axe: 0 serious/critical |
| Boundaries | clean; a deliberate cross-context import (package name and relative path) fails | — |
| Prisma validate | valid | — |
| `pnpm audit --prod --audit-level high` | no known vulnerabilities | no known vulnerabilities |
| Smoke | api `/health/live` 200 with Helmet headers; worker health 200; bad env exits 1 listing every bad variable | — |

## Exit criteria still open

- [ ] lvn-mobile created (Expo, three EAS profiles), CI green.
- [ ] ADR-0005 (three permission interpretations) and ADR-0006 (package scope) decided.
- [ ] Spec inconsistencies in `existing-state.md` resolved.
- [ ] Backend, Web and Mobile agents sign off on the spec, ERD, permission matrix and GraphQL skeleton.
- [ ] Decision on existing Firebase users' data (existing-state.md → Cut-over).
- [ ] Repositories pushed to GitHub and CI observed green there (only run locally so far).

GraphQL schema version: skeleton draft, unversioned.

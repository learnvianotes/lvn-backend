# Phase 0 — Architecture (in progress)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18

## Shipped

### lvn-backend (this repository)

| Item | Where |
| --- | --- |
| Spec, existing-state inventory, ERD, env reference | `docs/architecture/` |
| ADR-0001 … ADR-0031 (0005 permission decisions, 0006 package scope, 0007 Firebase for Google sign-in only, 0008 local mobile builds, 0009 membership by approval, 0010 fork publishing and credit, 0011 group join policy, 0012 teacher Skills tab, 0013 teacher follows and connections, 0014 students follow teachers and teacher publications, 0015 student projects and project workspaces, 0016 student follows, block and restrict, 0017 registration with birth date and institutional email, 0018 data export and notes import, 0019 verification without institutional email, 0020 teachers follow students, 0021 push via FCM, 0022 learnvianotes.in and URLs from .env, 0023 old-site data, 0024 plans and limits, 0025 read aloud, AI tasks and PDF engine, 0026 student profile, 0027 milestones, 0028 PDF engine technology, 0029 mobile UI kit, 0030 Rhythm instead of streaks, 0031 GitHub organisation and package name) | `docs/adr/` |
| UI reference: brand tokens, screen → phase map, open design questions | `docs/design/ui-reference.md` |
| Spec errata E1–E10 applied (owner-approved) | `docs/architecture/lvn-architecture-v2.md` |
| pnpm + Turborepo workspace; api + worker composition roots; five empty context packages; `libs/config` | `apps/`, `contexts/`, `libs/` |
| Permission matrix + domain enums in `@lvn/contracts/domain` | `contracts/src/domain/` |
| Config schemas (api, worker, web, mobile) and event schemas | `contracts/src/config/`, `contracts/src/events/` |
| GraphQL schema skeleton (SDL draft for sign-off) | `contracts/graphql/schema-skeleton.graphql` |
| Prisma: five Postgres schemas, extensions, no models | `prisma/schema.prisma`, `prisma.config.ts` |
| Context boundary rules | `.dependency-cruiser.cjs` |
| CI (build, lint, typecheck, test, boundaries, Prisma validate, gitleaks, audit), contracts publish on tag | `.github/workflows/` |

### lvn-web

Next.js 15 skeleton per §12.1, landing page, existing study content at `/core` (ADR-0002), redirects from old URLs,
old service worker removal, Playwright + axe, CI. Details in lvn-web `docs/architecture/web-addendum.md`.

### lvn-mobile

Expo SDK 57 app with Expo Router, three side-by-side build variants built locally without an Expo account
(ADR-0008), a start screen in the brand palette, validated config, Maestro smoke flow and CI that builds the sandbox APK. Details in lvn-mobile `docs/architecture/mobile-addendum.md`.

## Test evidence (2026-10-08, local)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Build | 9/9 packages | 805 static pages, 106 kB first-load JS | JS bundles exported (Android 3.4 MB, iOS 3 MB); local release APK built with Gradle, no Expo account: `com.learnvianotes.dev`, 42 MB arm64, 2 min 53 s |
| Lint, typecheck | clean | clean | clean |
| Unit / integration | 80 tests (contracts 77, api health 2, worker 1); `permissions.ts` 100 % branches | 7 unit tests | 3 tests |
| E2E | — | 12/12 Playwright (desktop + Pixel 7), axe: 0 serious/critical (re-run after the palette change) | Maestro flow written; not run (no emulator image on the dev machine, no phone attached) |
| Health checks | boundaries clean, a deliberate cross-context import fails; Prisma valid | — | expo-doctor 21/21 |
| `pnpm audit --prod --audit-level high` | no known vulnerabilities | no known vulnerabilities | 2 build-tool highs with no fix, ignored and documented |
| Smoke | api `/health/live` 200 with Helmet headers; worker health 200; bad env exits 1 listing every bad variable | — | each variant resolves its own name and bundle id; an unknown variant fails |

## Exit criteria still open

- [ ] Install the local APK on a phone and run the Maestro flow.
- [ ] Design questions in `docs/design/ui-reference.md` decided (follows, events, branch/year, read-aloud, translate, weekly goal).
- [ ] Backend, Web and Mobile agents sign off on the spec, ERD, permission matrix and GraphQL skeleton.
- [ ] Decision on existing Firebase users' data (existing-state.md → Cut-over).
- [ ] Repositories published to the `learnvianotes` GitHub organisation and CI observed green there (only run locally so far).

GraphQL schema version: skeleton draft, unversioned.

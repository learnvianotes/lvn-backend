# Phase 9 — Hardening (plan)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18 Phase 9. The phase covers:

- a security audit (external if possible), k6 load, query analysis and an index review;
- reviews of Redis and the S3 policies;
- offline chaos tests, an accessibility audit, and a review of error and empty states;
- runbooks, on-call, and a restore drill.

The exit criteria are "SLOs met for 7 days in sandbox under load; audit findings closed". The SLOs (§16.4) are:

- API availability 99.9 %;
- API p95 < 300 ms;
- job success 99.5 %;
- public note TTFB < 500 ms.

The owner has deferred AWS. As in every phase, the **local environment** (ADR-0036) stands in for the sandbox. This
plan says where it cannot: a seven-day window and an external audit.

## What this phase starts from (inventory, 2026-10-14)

- **Gaps carried from Phase 7**, each a §16 requirement or a security finding in its own right:
  - **Account deletion** is not built. §8.4 asks for a 14-day grace period, then a hard delete of personal data and
    "Deleted user" on public contributions, with `UserDeleted` consumed by `notes`, `core` and `ai`.
  - The `housekeeping` queue's `delete-accounts` and `orphan-s3` jobs (§9.2) do not exist.
  - **Covers copied from links** are not virus-scanned, and **unattached covers** have no sweeper.
- **Redis** on the local environment runs with no `maxmemory-policy` and no persistence. BullMQ requires
  `noeviction`: an evicted job key loses the job silently (BullMQ "Going to production"). The AWS module's
  ElastiCache uses the default parameter group, which evicts (`volatile-lru`); this was flagged in the AWS guide.
- **Runbooks:** only `moderation.md` exists. §16.5 lists the rest as needed before real users: restore from backup,
  rotate secrets, drain a queue, roll back a release, take a note offline (done), and respond to a leakage report.
- **Dependency advisories** are accepted rather than fixed in two repos: lvn-backend has one high, lvn-mobile two. Each
  needs a recorded reason or an upgrade.
- **Performance** has been measured only per feature: search p95 in Phase 4, and Lighthouse on public notes in Phase
  2. There has been no load test of the whole API, and no review of the slowest queries.

## Research it rests on

- **Load:** k6 with `thresholds` (`http_req_duration p(95)<300`, `http_req_failed rate<0.001`) fails a run on a
  breached SLO. A ramping-VUs scenario to 500 users follows §17's target. Grafana k6 docs: thresholds and scenarios.
- **Queries:** `pg_stat_statements` gives the top queries by total time; `EXPLAIN (ANALYZE, BUFFERS)` shows each one's
  plan. A sequential scan on a large table, or a sort without an index, is the usual finding. PostgreSQL docs, F.32.
- **Security scanning:**
  - OWASP ZAP's baseline (passive) and API scans run as containers against a deployed app. They report missing
    headers, cookie flags, information leaks and injection candidates.
  - gitleaks scans every commit for secrets.
  - GraphQL-specific checks (introspection, depth, complexity, batching and aliases) follow OWASP's GraphQL Cheat
    Sheet.
- **Accessibility:** axe-core (`@axe-core/playwright`) checks WCAG 2.2 A/AA rules on each web route. On the phone,
  accessibility labels, roles and 44 × 44 touch targets are checked in the component tests. Deque axe-core rules; WCAG
  2.2.
- **Redis for queues:** BullMQ docs, "Going to production": set `maxmemory-policy noeviction`; turn on AOF
  (`appendfsync everysec`) so a restart does not lose queued jobs.
- **S3:** turn on Block Public Access for every bucket; give the app only the actions it uses; pre-signed URLs at most
  15 minutes (§17.1); CORS limited to the web origins. AWS S3 security best practices.
- **Restore drill:** a backup counts only once it has been restored and the app has run against the copy. The
  drill: `pg_dump -Fc` and a copy of the buckets, restored into a fresh environment, then smoke tested.

## Slices

| Slice | What | Done when |
| --- | --- | --- |
| **P9a Account deletion and housekeeping** | `requestAccountDeletion` (re-authenticated, 14-day grace, cancellable by signing in) and `cancelAccountDeletion`. Then `UserDeleted`: each context deletes its personal data or makes it anonymous. Private notes, files, AI artifacts, learning events, sessions and device tokens go. Public notes, comments and posts stay as "Deleted user". Groups pass to another admin, or close when none is left. Search and RAG drop the person. The `housekeeping` queue gets `delete-accounts` (nightly) and `orphan-s3` (unattached uploads and covers older than a day). Covers fetched from links are scanned like uploads. Web and phone: Delete account in settings, with what happens spelled out | An API e2e follows a person from request through grace and purge in every context. The security suite shows nothing of theirs is readable afterwards. Lifecycle checks it on the local environment |
| **P9b Security audit** | Scans of the local environment: ZAP baseline and API (GraphQL); gitleaks over all three repositories' history. A review of headers (CSP, HSTS, frame-ancestors, referrer policy), cookies, CORS, GraphQL limits (introspection off outside dev, depth, complexity, aliases and batching), rate limits, the upload checks and the accepted advisories. The full §17.1 suite runs. Every finding is fixed or recorded with a reason | No high or medium ZAP finding left open; gitleaks clean; each accepted advisory has a reason; ADR for any rule changed |
| **P9c Performance** | k6 scenarios against the local environment: Home, opening a note, search, writing a card, the community feed and a public note page, ramping to 500 virtual users. `pg_stat_statements` top 20 with `EXPLAIN`, indexes added in a migration where a plan needs one. Lighthouse on Home, a note and a public note. The phone's cold start on the owner's Samsung (`am start -W`) | k6 thresholds pass (p95 < 300 ms, errors < 0.1 %); no top query scans a large table sequentially; public note TTFB < 500 ms; numbers recorded |
| **P9d Data and operations** | Redis: `noeviction`, AOF `everysec` and a memory cap on the local environment, with a parameter group in the AWS module. S3: Block Public Access, the app's policy narrowed, pre-sign TTL and CORS checked. Backups: a nightly `pg_dump` and bucket copy job on the local environment. Restore drill into a fresh database and buckets, then smoke. Runbooks: restore, rotate secrets, drain a queue, roll back a release, leakage report. On-call: what alerts, the SLO burn-rate rules, who answers | Restore drill passes smoke and lifecycle against the restored copy; runbooks reviewed; Redis and S3 settings checked by a script |
| **P9e Resilience and states** | Chaos on the local environment while tests run: restart the API, worker, Redis and Postgres in turn, and drop the phone's network mid-edit and mid-upload. Check that nothing is lost and everything recovers (queues retried, sync caught up, uploads resumable or clearly failed). A sweep of loading, empty, error and offline states on every web route and phone screen. An accessibility audit: axe on every web route, and labels, roles and targets on the phone | Chaos script passes with no lost note or job; axe has no serious or critical violation; every screen has its four states |
| **P9f Exit** | A soak on the local environment: a steady k6 load for hours, measuring the four SLOs from Prometheus and the logs. Release notes | SLOs met for the soak window. The spec's seven days in the sandbox wait for the AWS sandbox, which the owner has deferred; recorded as such. Audit findings closed |

## Needed from the owner (not blocking)

- **An external security audit or penetration test.** The spec says "external if possible". This phase's audit is
  internal (scans and review).
- **AWS** is still deferred. The seven-day SLO window, real backups (RDS snapshots, S3 versioning) and on-call paging
  wait for it.
- **On-call:** who is paged, and how (phone or email).

## Progress

| Slice | State | Evidence |
| --- | --- | --- |

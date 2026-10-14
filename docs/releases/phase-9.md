# Phase 9 — Hardening (closed on the local environment; AWS still deferred by the owner)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18 Phase 9, §16.4–16.6, §17. Plan:
[phase-9.md](../plans/phase-9.md), with the research it rests on.

Scope:
- the gaps carried from Phase 7: account deletion, and the housekeeping it needs;
- a security audit (internal: scans and review), load, the slowest queries;
- Redis and storage settings, monitoring with SLO alerts, backups and a restore drill, runbooks and on-call;
- chaos on the running stack, the loading, empty, error and offline states of every screen, and accessibility.

Everything below runs and is tested on the dev machine and on the **local environment** (ADR-0036), the stand-in for
the AWS sandbox, which the owner has deferred. The spec's exit asks for SLOs met for seven days in the sandbox under
load; that waits for AWS (see Known gaps).

## Shipped

### lvn-backend

| Slice | What | ADR |
| --- | --- | --- |
| P9a Account deletion and housekeeping | `requestAccountDeletion` with the password (when the account has one) and the word DELETE: other devices signed out, an email with the date. `cancelAccountDeletion` any time in the 14 days. The nightly `delete-accounts` job then erases the account in every context: private notes, files, learning, AI artifacts, sessions, device tokens and more go; public notes, posts and comments stay by "Deleted user"; an owned group passes to its longest-standing admin, a taught class to another teacher, or they close. The deletion is announced again for seven nights, and every eraser is idempotent. `purge-orphan-files` deletes uploads and covers never attached; files the server stores itself are virus-scanned like uploads | 0088 |
| P9b Security | A per-person limit of 600 GraphQL operations a minute, counted in Redis across API instances (429 with `Retry-After`; requests pass when Redis cannot answer). An AWS WAF on CloudFront: a per-address flood rule on `/graphql` and AWS's Common and Known Bad Inputs rules. Reader links last 15 minutes and the readers renew them. Identity documents are no longer readable cross-origin. gitleaks findings reviewed and recorded. `scripts/settings-check.mjs` reads the settings back from a deployed environment | 0090 |
| P9c Performance | `pg_stat_statements` on the local Postgres (the AWS module already had it), read with the on-call runbook's queries. `scripts/load/k6-learners.js`: 500 learners on Home, notes, search, writing, the community feed and public note pages, with the SLOs as thresholds | — |
| P9d Data and operations | Redis keeps every key: `noeviction`, the append-only file synced every second, 512 MB, a volume; on AWS a parameter group and 7 daily snapshots. Queue metrics (`lvn.queue.jobs`, `lvn.queue.backlog`) and a heartbeat every service reports (`lvn.up`). On the local environment: an OpenTelemetry Collector, Prometheus with the SLO recording rules and burn-rate alerts, Alertmanager emailing (Mailpit here), Grafana at `/grafana`. A nightly backup from a systemd timer, and a restore drill into a separate copy. The worker's CLI gives operators queue commands. Runbooks: restore, rotate secrets, drain a queue, roll back, leakage report, on-call | 0089 |
| P9e Resilience and states | `scripts/chaos-check.mjs`: each service restarted in turn while a writer saves notes the way the phone does; a queued job outlives a Redis restart. The lifecycle check follows an account deletion through the nightly job | — |
| P9f Exit | The soak and its SLO readout; this note | — |

Contracts 0.58.0 (P9a) and 0.59.0 (the web's storage origins). No migration: the account's `deletionRequestedAt`
already existed. New worker jobs: `delete-accounts` (03:20 UTC) and `purge-orphan-files` (03:40 UTC).

### lvn-web

- **Delete your account** on the account page: the password and DELETE, then the date it goes; on every signed-in page
  until then, a banner with Keep my account.
- **A Content Security Policy** on every page (ADR-0090): scripts from the site and Google sign-in only, connections
  only to the site, the API, storage, sign-in and Sentry, no plugins, no framing.
- **The PDF reader** loads by range and renews its link when it expires.
- **Every page says when it is loading or failed**, with Try again, before any empty or "not found" text. A page says
  "not found" only when the API said so.
- The Skills editor and Interests show no form until what is saved has loaded.

### lvn-mobile

- **Settings → Delete your account**, and a banner above the tabs with Keep my account.
- **The PDF reader** renews its link when it expires.
- **Every screen says when it is loading or failed**, with Try again; an **offline strip** under the status bar on
  every signed-in screen; Home pulls to refresh; Review says when its cards are from the last sync.
- Skills and a resource's edit form appear only once what is saved has loaded.

## Bugs found and fixed

Found on the way, each fixed and covered by a test or a check:

- **Data at risk:**
  - The Skills editor (web and phone) and Interests (web) showed an empty form when their load failed; saving it would
    have wiped the teacher's profile or the person's topics. The phone's resource edit form had the same flaw. None
    shows a form now until what is saved has loaded (P9e).
  - Identity documents were readable cross-origin like any file; only the files bucket allows reads from anywhere now.
- **Found by ZAP:** a `subscription` sent over HTTP made the gateway's query planner fail with a 500; it is refused with
  400 now (live updates are at `/graphql/live`).
- **Found by k6 and `pg_stat_statements`:** "notes I own or may edit" was `ownerId = $1 OR EXISTS (share)`, which kept
  Postgres from the owner index. Under load `notes.Note` was read by sequential scan 16,452 times (40 million rows).
  Study cards and the phone's sync read owned and shared notes by index now.
- **Found by axe:** Home's weekly goal line had a contrast of 3.8:1; it meets 4.5:1 now.
- **Screens that misled:** about 30 screens on each app went blank, or said "not found" or "nothing here", when a
  request had failed. The web's notification settings spun forever, and both apps showed the teaching application form
  again to someone whose application was waiting, when its load failed.
- **Operations:**
  - The VM has no cron, so the nightly backup could not be scheduled; it runs from a systemd timer.
  - The `TargetDown` alert watched `target_info`, which never arrives through the collector, so it would have paged for
    healthy services; it watches a heartbeat every service reports (`lvn.up`).
  - The drain-a-queue runbook's commands did not work (`bullmq` not resolvable from `/app`, `redis-cli` without the
    password, an old metric name). The worker's CLI has queue commands now, and the runbook uses them. The on-call
    runbook named the wrong rules path and Grafana address.
- **Tests:**
  - The role fuzz test calls every mutation four times as one student, about 600 operations in under a minute; the new
    limit refused the next test. Each round starts with a fresh count.
  - The live learning-events test ran its fake clock before the note had opened, so the reading time was under 5 s on
    a slow load; it waits for the editor now.
  - The expired-link reader test gave the note's file card a different link from `noteFile`; Apollo keeps one file
    for both, as the API does.
  - The k6 setup published notes from unverified accounts, which the API refuses; the public pages read are the
    environment's own.
  - The first two-hour soak kept the tokens made at sign-up, which expire after 15 minutes: from then on the signed-in
    requests were refused, quickly, so its latency was not evidence. Each virtual user now signs in when it starts and
    every 12 minutes, and the soak was run again.

## Security audit

Internal: scans of the local environment and a review against §17.1. Every finding was fixed or accepted with its reason.

| Check | Result |
| --- | --- |
| gitleaks, the full history of all three repositories | No secret. Eight matches reviewed and recorded in each repository's `.gitleaksignore`: made-up keys in tests, Terraform references to generated keys, HashiCorp's public signing-key fingerprint, truncated PEM headers in a config test, and the retired site's Firebase web key (a public identifier, removed by the rewrite) |
| ZAP baseline (passive) of the web | 0 failures. Medium, accepted (ADR-0090): `unsafe-inline` for scripts and styles, as cached pages cannot carry a nonce; `https:` for images and media, which come by pre-signed URL. Medium, false positive: "Java source code disclosure" matched the words "class to {name}" in the page's translations. Medium: "ZAP is out of date" is about the scanner. Informational: comments in bundles, cache headers, `next` reflected into an attribute (React escapes it, and only same-site paths are followed) |
| ZAP API scan, GraphQL from the schema (about 6,900 operations, passive) | One server error, a subscription over HTTP: fixed (400). ZAP's active scan of every generated operation hung after the import; the active checks are the security suite's (below) |
| Security suite (§17.1), API | 67 tests + 1 todo: every mutation fuzzed by role; depth and complexity limits, with every alias counted; batched operations refused; list caps; authorization across contexts, sign-in and sign-up abuse, the per-person rate limit, uploads, and a subscription over HTTP |
| Settings check on the deployed environment | 10/10: the CSP refuses framing, plugins and a changed base and lists where pages may connect; HSTS, nosniff, referrer policy, no `X-Powered-By`; introspection off; upload links at most 15 minutes; unsigned storage reads and listings refused; Redis `noeviction`, AOF every second, 512 MB; the 601st operation in a minute refused with 429 |
| Dependency advisories (`pnpm audit --prod --audit-level high`) | Clean in all three, with three accepted, each with its reason: deepmerge-ts inside Prisma 7's CLI config (fixed in Prisma 8), node-forge in Expo's CLI (no fix published: 1.4.0 is the latest), braces in Metro (no fix published: 3.0.3 is the latest). None reaches a running app |

## Test evidence (2026-10-14)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck | clean; dependency boundaries clean | clean | clean (`expo lint`) |
| Unit / integration / e2e | 992 passing + 1 todo across 19 packages: API 495 + 1 todo (security 67 + 1 todo), contracts 180, notes 51, ai 45 (and 23 live tests against the real model, run on their own), users 41, safe-fetch 40, core 38, storage 19, communication 15, and the libraries | 116 unit (Vitest) | 337 (Jest: unit and components) |
| Browser / device E2E | — | Playwright 483 on desktop and phone (mocked API; 97 skipped: the live specs, the accessibility sweep, and /core's while it is off) | Maestro on the VM (below) |
| `pnpm audit --prod --audit-level high` | clean (one advisory ignored with its reason) | clean | clean (two advisories ignored with their reasons) |
| Contract | `graphql:check`; `env:check` (77 variables) | codegen against the current schema; the contracts copy synced | the contracts copy synced |
| Migrations | none in this phase | — | — |

### On the local environment (2026-10-14)

Deployed with `infra/scripts/deploy-local.sh` to `http://100.70.234.41:8080`:
- `lvn-backend:136a3d9f7984` (api, worker; deployed with this note still a draft, so its tag says `dirty`);
- `lvn-web:04641c12ace4`;
- `lvn-pdf-engine:35833b87f347`.

| Check | Result |
| --- | --- |
| `pnpm smoke` | 13/13 |
| `pnpm lifecycle` | 110/110. Phase 9 adds an account deletion: H asks with the password and DELETE (14 days); the 14 days wound back and the nightly job run with the worker's CLI; H's private note gone, the public one by "Deleted user", H unable to sign in |
| Playwright, live | 67 passed + 1 skipped (Google is off on the VM), on desktop and phone |
| Accessibility sweep (axe, WCAG 2.2 A and AA) | Every route signed out and as a new learner, desktop and phone: no serious or critical violation, and no request refused by the Content Security Policy |
| `scripts/settings-check.mjs` | 10/10 |
| `scripts/chaos-check.mjs` | 11/11: each API instance back in 7 s, the worker 6 s, Redis 3 s, Postgres 3 s, the web 6 s, the writer saving again each time; 263 notes acknowledged, none missing, 4 attempts retried; an export queued with the worker stopped ran after a Redis restart |
| Backup and restore drill | Backup in 5 s. Restored into a copy in 15 s: 127 tables matching (4,180 users, 1,859 notes), 943 files, an API on the copy answering |
| Monitoring | Prometheus scrapes the collector; `http_server_request_duration_seconds`, `lvn_queue_backlog`, `lvn_queue_jobs_total` and `lvn_up` arrive; the SLO recording rules evaluate (`promtool`: 16 rules); Grafana at `/grafana`; no alert fired during the soak |
| k6, 500 learners (2 min ramp, 5 min hold) | API p95 34.8 ms; 0 errors in 85,972 API requests; public note TTFB p95 4.9 ms |
| Soak, 150 learners for 2 hours | API p95 21.5 ms (k6) and 23.2 ms (Prometheus, server side); availability 100 % (no 5xx; 0 of 474,555 API requests failed); jobs 294 completed, 0 failed; public note TTFB p95 4.8 ms; all 565,426 k6 checks passed; no alert fired. Maestro ran its 36 flows during it |
| ZAP | Baseline 0 failures; API scan 0 failures and no server error after the fix (112 passed) |
| Maestro | 36/36 on this build (33 min), while the soak ran |
| Lighthouse | Public note 91 phone / 100 desktop; Home 90 / 100; accessibility 100 on all four |
| Cold start on the owner's Samsung (`am start -W`, 5 runs) | Median 905 ms (809–1313) on this build; 869 ms before it |

The Phase 9 build is installed on the owner's phone.

## Exit criteria (§18)

- [x] **Audit findings closed.** Every finding of gitleaks, ZAP (baseline and API), axe, the settings check and the
  query review is fixed or accepted with its reason (Security audit, above), and every accepted dependency advisory has
  its reason.
- [ ] **SLOs met for 7 days in the sandbox under load.** Not yet: the sandbox waits for AWS, which the owner has
  deferred. On the local environment the four SLOs were met throughout a two-hour soak with 150 learners
  (availability 100 %, API p95 23 ms, jobs 100 %, public note TTFB p95 4.8 ms) and a five-minute run with 500 learners
  (API p95 35 ms). The seven days are the first thing to run when AWS starts.

## Known gaps

- **The seven-day SLO window in the sandbox** waits for AWS, which the owner has deferred. The local environment ran
  a two-hour soak instead (above). One VM on the dev machine is not the sandbox's scale or network.
- **The audit is internal.** An external audit or penetration test is for the owner to commission.
- **ZAP's active scan of the GraphQL API** hung after importing about 6,900 operations; the API was scanned passively,
  and the active checks are the security suite's. A scanner built for GraphQL (or an external tester) would add to it.
- **`unsafe-inline` scripts and styles** remain in the Content Security Policy while pages are cached (ISR); nonces
  would mean giving them up.
- **The WAF's per-address limit** (10,000 requests to `/graphql` in 5 minutes) is about 60–80 very active users behind
  one address at the load test's pace. A college behind one NAT could meet it. Raise
  `api_requests_per_address_per_5_minutes`, or measure real campus traffic, before launch.
- **The load ceiling** of the local environment was not sought: at 500 learners the API answered 9 times faster than
  the SLO. A stepped test would find it.
- **Paging** goes to Mailpit on the local environment; on AWS it needs the owner's on-call address and an SNS or email
  channel.
- **The WAF and ElastiCache settings** are in Terraform and validated, but untested against AWS until it starts.
- **The offline strip** trusts Android's view of the network; on a network whose connectivity check fails, it may show
  while the app still reaches the API.
- Carried over: achievements are checked by a worker job a little after events; a ring of verified accounts can trade
  a few points within the weekly and daily caps; contests need admins to write questions.

## Needed from the owner (not blocking)

- **An external security audit or penetration test.** The spec says "external if possible"; this phase's is internal.
- **AWS** is still deferred: the seven-day SLO window in the sandbox, RDS snapshots and S3 versioning as backups, the
  WAF, and paging wait for it.
- **On-call:** who is paged, and how (`ALERT_EMAIL`; until then alerts go to Mailpit).

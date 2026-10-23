# ADR-0096: Launch on Lightsail — one VM per environment running the Compose stack, Cloudflare R2 and Resend

- Status: Accepted (owner decision, 2026-10-22: "Option A"; infrastructure facts from the Infra Lead)
- Date: 2026-10-22
- Deciders: Backend, Web agents; owner; Infra Lead
- Spec sections: §16.1 (environments), §16.2 (deployment topology), §16.4 (CI/CD), §2 (S3, SES); supersedes ADR-0035
  and ADR-0066; amends ADR-0089 and ADR-0093
- Retired code: AWS Terraform (`infra/terraform/{modules,envs/sandbox,envs/emulated,bootstrap}`),
  `infra/scripts/deploy.sh` and `aws-stand-in.sh`, `docs/runbooks/aws-deployment.md`. They are in git history at
  `c568538`, if AWS is ever wanted again.

## Context

§16.2 pins ECS Fargate behind CloudFront and an ALB, with RDS, ElastiCache and S3, and the repositories carried that
pipeline (Terraform modules, ECR, SSM image parameters, ECS migrate tasks, an OIDC deploy role). It never ran: the AWS
accounts were deferred. As sized it would cost roughly US$110–160 a month for one sandbox.

The owner chose "Option A" for the launch of the rewrite:

- one Lightsail VM per environment in Mumbai, running the stack the local environment already runs (ADR-0036);
- Cloudflare R2 for files and backups;
- Resend for email.

The facts:

- **Beta** (formerly "test"): `beta.learnvianotes.in`, VM `13.204.214.142`.
  - 2 GB RAM and 2 GB swap, Ubuntu 24.04, Docker 29 with the compose plugin.
  - Ports 22, 80 and 443 only; SSH by key only.
  - Deploys sign in as `deploy@<host>` (in the docker group); the stack lives in `/opt/lvn`.
- **Production** will be another 2 GB VM, with the same compose file. It has no host for now: its server was deleted on
  2026-10-22 and will be brought back.

## Decision

**The stack** (`infra/lightsail/compose.yaml`), on each VM:

- PostgreSQL 16 with pgvector;
- Redis 7: no eviction, append-only;
- a one-off `migrate` with the new backend image, before the api and worker start;
- the API and the worker (one backend image);
- lvn-web's standalone Next.js server;
- Caddy.

Every service has a `mem_limit`, and Postgres, Redis and Node are tuned inside it. The steady caps add up to 1.6 GB of
the 2 GB; `docs/runbooks/lightsail.md` has the budget.

Left out:

- ClamAV, the PDF engine and video work: uploads are off (ADR-0097);
- Typesense: search runs on Postgres (`SEARCH_PROVIDER=postgres`, ADR-0055);
- the monitoring stack of ADR-0089: no room, and Grafana Cloud or an uptime check can take its place.

**TLS:**

- Caddy's automatic HTTPS: Let's Encrypt certificates for every host in `LVN_SITE_HOSTS`, renewed by Caddy.
- Hosts other than the canonical one (`LVN_PUBLIC_URL`) redirect to it, e.g. `learnvianotes.in` → `www.learnvianotes.in`.
- `/graphql` (with its WebSocket), `/health/*` and `/webhooks/*` go to the API; the rest to the web. One origin, as
  CloudFront gave the sandbox (ADR-0035) and the local entrance gives today.

**Files on R2:**

- `S3_ENDPOINT` is the account's R2 endpoint, with `S3_REGION=auto` and path-style URLs.
- Pre-signed URLs point there, so the web's Content Security Policy takes `NEXT_PUBLIC_STORAGE_ORIGINS` from the same
  endpoint (`LVN_R2_ENDPOINT`), not from AWS's S3 hosts.
- Backups: `lvn.sh backup` runs `pg_dump` daily at 03:00 IST and sends it to the environment's R2 backup bucket. The
  bucket's lifecycle rule keeps 30 days.

**Email:** `MAIL_TRANSPORT=resend`, from a domain verified in Resend.

**Images and deploys.**

- GitHub Actions builds the images and pushes them to GHCR:
  - lvn-backend: `ghcr.io/learnvianotes/lvn-backend:<sha>`, built once per commit;
  - lvn-web: `ghcr.io/learnvianotes/lvn-web:<env>-<sha>`, built per environment, because `NEXT_PUBLIC_*` is compiled in.
- Each repository's `.github/workflows/deploy.yml` then SSHes to the VM:
  - lvn-backend's `infra/lightsail/deploy.sh` installs the compose file, the Caddyfile and `lvn.sh` in `/opt/lvn`, and
    writes the settings from the GitHub environment's secrets and variables (`env/*.env`, mode 600);
  - lvn-web's deploy sets only its image.
- Both end with `lvn.sh up`: `docker compose pull && docker compose up -d`, then a readiness check. Every service must be
  healthy, the migration must have exited 0, and the site must answer `/health/ready` over HTTPS through Caddy. The
  deploy job checks the same URL from outside. Any failure exits non-zero and fails the job. (The AWS `deploy.sh` and
  `deploy-local.sh` printed "Ready" whatever the answer; `deploy-local.sh` now fails too.)

**Releases (ADR-0093 kept):**

| Push | Environment | GitHub environment |
| --- | --- | --- |
| `release/**` branch | beta | `beta` |
| `v*` tag | production | `production`, with a required reviewer |

- `deploy.sh` refuses any other ref, whoever runs it.
- No AWS credentials, OIDC role, ECR, SSM or ECS remain anywhere.
- The old app's Firebase deploy workflow on `release/college-launch` loses its triggers (lvn-web, ADR-0093's note
  there), so no `v*` tag and no `release/**` push can start it. No `v*` tag can start the AWS pipeline either: the
  workflows that a tag runs are the ones in its commit, and every commit from now on has only the Lightsail ones.
- Older commits still hold the AWS workflow. Tag only release commits; the production environment's reviewer is the
  last check.

**Secrets:**

- The stack's own secrets: the database and Redis passwords, the JWT keys, the HMAC, revalidation and sealing secrets.
  `infra/lightsail/new-secrets.sh` makes them on an operator's machine.
- They are kept as GitHub environment secrets, so a rebuilt VM gets the same ones.
- The VM holds them only in `/opt/lvn/env`.

## Consequences

- One small VM per environment costs a few dollars a month instead of about a hundred. It has no high availability:
  - a VM failure means restoring from the R2 backup onto a new VM;
  - deploys restart containers in place (seconds of errors), with no rolling update.
- The sandbox name stays for the app's settings: beta runs `APP_ENV=sandbox` (noindex, test Firebase project). The
  GitHub environment and the host are "beta".
- Scaling up is a bigger Lightsail plan with the same compose file and larger `mem_limit`s. Moving to managed services
  later is a new ADR. The retired modules can be its starting point.
- The local environment (ADR-0036) stays as the lab: Terraform on a VM with ClamAV, Typesense, RustFS and the
  monitoring stack.
- Runbooks: `docs/runbooks/lightsail.md` (first deploy, every deploy, rollback, backups, restore, memory, what Infra
  provisions); `roll-back.md`, `restore.md` and `rotate-secrets.md` point to it.

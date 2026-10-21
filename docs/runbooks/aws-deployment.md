# Deploying LearnViaNotes to AWS: sizes, needs and steps

- **Written:** 2026-10-14, after Phase 8.
- **Region:** `ap-south-1` (Mumbai). Data about Indian learners stays in India (§15.2).
- **Prices:** on-demand USD from AWS's own price lists (dated September–October 2026). India GST (18 %) is added on top
  of every bill. Check totals with the [AWS Pricing Calculator](https://calculator.aws/) before committing.
- **Sources:** the spec's topology and scaling plan (§16.2, §16.3) and its SLOs (§16.5): API availability 99.9 %, API
  p95 under 300 ms, job success 99.5 %, public note TTFB under 500 ms. Load target: 500 concurrent users (§17, Phase 9).
- **Infrastructure:** the Terraform in `infra/terraform` (README there) already builds most of it.

## 1. What runs, and where it runs today

| Piece | What it is | On the local VM | In the AWS Terraform today |
| --- | --- | --- | --- |
| web | Next.js 15 app (SSR + static) | yes | ECS Fargate service |
| api | NestJS, all five contexts, GraphQL at `/graphql`, webhooks | yes (2 tasks) | ECS Fargate service |
| worker | BullMQ jobs: notifications, search index, AI pipeline, achievements, imports, GitHub deliveries… | yes | ECS Fargate service |
| migrate | Prisma migrations, one-off before each rollout | yes | ECS one-off task |
| PostgreSQL 16 + pgvector | all data, five schemas | container | RDS (`modules/data`) |
| Redis 7 | BullMQ queues, rate limits, sessions, live events | container | ElastiCache (`modules/data`) |
| S3 | files; identity documents in a restricted bucket with its own KMS key | RustFS | S3 (`modules/storage`) |
| Email | sign-up, digests, class posts | Mailpit | SES (`modules/mail`) |
| Secrets | DB, Redis, JWT keys, HMAC, AI keys secret | Terraform | Secrets Manager (`modules/secrets`) |
| Entrance | one address for web and `/graphql`, `/webhooks/*` | Caddy | CloudFront → internal ALB (`modules/edge`, `modules/service`) |
| **PDF engine** | Python (Docling + PaddleOCR): PDF to notes, OCR | container (3 GB) | **missing** |
| **ClamAV** | scans uploads; infected ones are quarantined | container (2 GB) | **missing**: uploads would not be scanned |
| **Typesense** | fast search with typo tolerance (Postgres answers if it is away) | container (1 GB) | **missing**: search falls back to Postgres |
| AI | Ask AI, study aids, skills import | Ollama on the host | provider keys saved by admins at `/admin/ai` (Claude, OpenAI, Gemini, custom) |

## 2. Change these in Terraform before production

In priority order. The first four are needed for the app to behave on AWS as it does on the local environment.

1. **Redis must never evict (blocker).**
   - The cluster uses `default.redis7`, whose policy evicts keys under memory pressure. BullMQ requires
     `maxmemory-policy = noeviction`, or queued jobs can silently disappear.
   - Fix: add an `aws_elasticache_parameter_group` (family `redis7`, `maxmemory-policy noeviction`) in `modules/data`.
   - Valkey 7.2+ is supported by BullMQ and costs 20 % less (see the Redis row in §3).
2. **Add the three missing services** to `modules/service`, each with its CloudWatch log group:

   | Service | Size | Settings |
   | --- | --- | --- |
   | `pdf-engine` | 2 vCPU / 4 GB, x86 (Docling and PaddleOCR wheels are x86-first) | `REDIS_URL` (secret), the S3 bucket through the task role, `PDF_ENGINE_CONCURRENCY=1` |
   | `clamav` | 0.5 vCPU / 3 GB | Exposes 3310 to the worker only (a security-group rule). Set `CLAMAV_URL=tcp://clamav.<namespace>:3310` through ECS Service Connect or Cloud Map. It needs about 1.5 GB for signatures and a few minutes before it answers; scans are retried meanwhile |
   | `typesense` | 1 vCPU / 2 GB, with an EFS volume for `/data` | Set `SEARCH_PROVIDER=typesense`, `TYPESENSE_URL` and `TYPESENSE_API_KEY` (a new secret). The data is derived: the worker rebuilds every collection from Postgres if it is lost |

   Instead of the `typesense` service you can use Typesense Cloud (§3).
3. **Autoscaling:** `aws_appautoscaling_*`.

   | Service | Range | Scale on |
   | --- | --- | --- |
   | api | min 2, max 20 | CPU 60 % (§16.3) |
   | web | min 2, max 6 | CPU 60 % |
   | worker | min 1, max 4 | BullMQ waiting count published as a CloudWatch metric (step at 1,000 for 5 minutes) |
   | pdf-engine | min 1, max 3 | the `notes.pdf-parse` queue |

4. **A domain** (`learnvianotes.in`):
   - **DNS and certificate:**
     - a Route 53 hosted zone;
     - an ACM certificate in `us-east-1` for CloudFront;
     - aliases on the distribution.
   - **Settings:**
     - `WEB_URL`, `PUBLIC_URL` and `MAIL_FROM` move to the domain;
     - the domain goes into Firebase's authorized domains;
     - the phone's `EXPO_PUBLIC_*` URLs point at it.
   - The sandbox can stay on CloudFront's own address (ADR-0035).
5. **AWS WAF on CloudFront:**
   - the AWS managed rules (core rule set, known bad inputs, IP reputation);
   - a rate rule of 300 requests per 5 minutes per IP on `/graphql`, raised after observing real traffic (§16.2).
   - The CloudFront flat-rate plans include WAF rules (§3).
6. **ARM64 images for web, api, worker and clamav:**
   - Build with `docker buildx --platform linux/arm64` and set `cpu_architecture = "ARM64"` on those task definitions.
   - In Mumbai, ARM Fargate is about 44 % cheaper than x86 (§3).
   - Keep the PDF engine on x86 until its wheels are verified on ARM.
7. **A production environment:** `envs/production`, a copy of `envs/sandbox` in its own AWS account.
   - Production sizes (§4).
   - `multi_az = true` and `deletion_protection = true`.
   - Backups retained 14–35 days.
   - Two NAT gateways, one per AZ.
   - Separate secrets.
8. **Observability:**
   - **Alarms:** CloudWatch alarms on ALB 5xx rate, api p95, RDS CPU, connections and free storage, Redis memory, the
     BullMQ dead-letter count, and ECS deployment failures.
   - **Traces:** set `TF_VAR_otel_exporter_otlp_endpoint` to an OTel collector sidecar or Grafana Cloud.
   - **Errors:** `SENTRY_DSN`.
9. **Deploying from CI:** a GitHub Actions workflow with an OIDC role. It builds the images once per commit, deploys to
   sandbox, runs E2E there, and promotes the same image to production (§16.4).
10. **Later, when metrics say so (§16.3):**
    - an RDS read replica for public-note reads;
    - RDS Proxy when connections run out;
    - VPC endpoints (S3 gateway is free; ECR, Logs and Secrets Manager interface endpoints) to cut NAT traffic;
    - separate worker services per queue.

## 3. Prices used

| Item | ap-south-1 price |
| --- | --- |
| **Fargate** | |
| per vCPU-hour, x86 | $0.04256 |
| per vCPU-hour, ARM | $0.02383 |
| per GB-hour, x86 | $0.004655 |
| per GB-hour, ARM | $0.00261 |
| **RDS PostgreSQL**, per hour, Single-AZ / Multi-AZ | |
| db.t4g.micro | $0.021 / $0.042 |
| db.t4g.medium | $0.084 / $0.167 |
| db.t4g.large | $0.167 / $0.334 |
| db.m7g.large | $0.240 / $0.479 |
| RDS gp3 storage, per GB-month, Single-AZ / Multi-AZ | $0.131 / $0.262 |
| RDS backup storage beyond the free amount, per GB-month | $0.095 |
| **ElastiCache**, per hour, Redis / Valkey | |
| cache.t4g.micro | $0.020 / $0.016 |
| cache.t4g.small | $0.041 / $0.0328 |
| cache.t4g.medium | $0.081 / $0.0648 |
| **Network** | |
| NAT gateway | $0.056 per hour + $0.056 per GB |
| ALB | $0.0239 per hour + $0.008 per LCU-hour |
| **CloudFront** | |
| Data out to India | $0.109 per GB (1 TB a month free) |
| Flat-rate Pro, monthly | $15 (10 M requests, 50 TB) |
| Flat-rate Business, monthly | $200 (125 M requests) |
| **Other AWS** | |
| S3 storage | $0.025 per GB-month |
| Secrets Manager | $0.40 per secret per month |
| CloudWatch Logs | $0.67 per GB ingested, $0.03 per GB-month stored |
| SES | $0.10 per 1,000 emails |
| ECR | $0.10 per GB-month |
| EFS | $0.33 per GB-month |
| WAF | $5 per web ACL + $1 per rule a month, + $0.60 per million requests |
| EC2 g4dn.xlarge (T4 GPU, for self-hosted AI) | $0.579 per hour, about $423 a month |
| **Typesense Cloud** (Mumbai) | |
| One node | about $21.60 a month (first 720 hours free) |
| Three nodes (high availability) | about $43.20 a month |
| **AI APIs**, per 1 M tokens in / out | |
| Claude Haiku 5.5 | $0.10 / $0.50 |
| OpenAI gpt-5.4-nano | $0.20 / $1.25 |
| Gemini 2.5 Flash-Lite | $0.10 / $0.40 |

A month is counted as 730 hours.

## 4. Sizes and monthly cost

### 4.1 Sandbox: shared staging, QA, demos, store review

Single-AZ, small, stopped or scaled down when idle.

| Piece | Size | Count | $/month |
| --- | --- | --- | --- |
| web | 0.5 vCPU / 1 GB (ARM) | 1 | 11 |
| api | 0.5 vCPU / 1 GB (ARM) | 1 | 11 |
| worker | 0.25 vCPU / 0.5 GB (ARM) | 1 | 5 |
| pdf-engine | 1 vCPU / 3 GB (x86) | 1 | 41 |
| clamav | 0.5 vCPU / 3 GB (ARM) | 1 | 14 |
| Search | Postgres (`SEARCH_PROVIDER=postgres`), or Typesense Cloud's one node (first 720 hours free) | — | 0–22 |
| RDS PostgreSQL 16 | db.t4g.micro, 20 GB gp3, 7-day backups | 1 | 18 |
| ElastiCache | cache.t4g.micro (`noeviction`) | 1 | 15 |
| NAT gateway | — | 1 | 44 |
| ALB | — | 1 | 25 |
| CloudFront | pay as you go (inside the free tier) or flat-rate Pro | — | 0–15 |
| S3, Secrets Manager, Logs, SES, ECR | — | — | 15 |
| **Total** | | | **about $200–235**, plus GST |

- On x86 everywhere it is about $30 more.
- `TF_VAR_nat_gateway=false` saves about $44. The network module then runs the tasks in public subnets (security groups
  still admit only the ALB), so they keep reaching the AI providers, FCM, GitHub and the rest. That is fine for the
  sandbox. Production keeps the tasks in private subnets behind NAT (§16.2).
- AI: a capped key on a cheap model (Claude Haiku 5.5 or Gemini Flash-Lite) with `AI_MONTHLY_BUDGET_MICRO_USD` set to
  about $20, so $5–20.

### 4.2 Production at launch: up to about 5,000 monthly learners and 500 at once

Multi-AZ, two of everything that serves requests, autoscaling on.

| Piece | Size | Count (min–max) | $/month |
| --- | --- | --- | --- |
| web | 1 vCPU / 2 GB (ARM) | 2–6 | 42 at 2 tasks |
| api | 1 vCPU / 2 GB (ARM) | 2–20 | 42 at 2 tasks |
| worker | 1 vCPU / 2 GB (ARM) | 1–4 | 21 at 1 task |
| pdf-engine | 2 vCPU / 4 GB (x86) | 1–3 | 76 at 1 task |
| clamav | 0.5 vCPU / 3 GB (ARM) | 1 | 14 |
| Typesense | on ECS: 1 vCPU / 2 GB (ARM) + EFS | 1 | 23 |
| Typesense (alternative) | Typesense Cloud, three nodes (HA) | — | 43 |
| RDS PostgreSQL 16 | db.t4g.medium Multi-AZ, 50 GB gp3, 14-day backups, Performance Insights | 1 | 135 |
| ElastiCache (Valkey or Redis) | cache.t4g.small, primary + replica, `noeviction` | 2 | 48–60 |
| NAT gateways | — | 2 | 88 |
| ALB | — | 1 | 35 |
| CloudFront | flat-rate Pro (includes WAF rules) | — | 15 |
| WAF | if not on a flat-rate plan | — | 16 |
| S3 (about 200 GB of files), Logs (30 GB), Secrets, SES, Route 53, ECR | — | — | 40 |
| **Infrastructure total** | | | **about $600–660**, plus GST |
| AI providers | see below | — | 60–150 |

**Why these sizes:**
- **db.t4g.medium (4 GB):**
  - fits the working set of notes, events and pgvector chunks at this size;
  - Multi-AZ gives the 99.9 % availability target;
  - if CPU credits run out (the T4g burst charge appears on the bill), move to db.m7g.large.
- **api:** two 1 vCPU tasks behind the ALB cover the 500-user load target with headroom. Phase 9's k6 run confirms it
  before launch, and autoscaling adds tasks at 60 % CPU.
- **pdf-engine:** Docling needs about 2 GB a page, and one PDF at a time per task keeps conversions predictable.

**AI cost:**
- **Estimate:** about 1,000 active learners a day, each running about three AI tasks (about 3,000 tokens in and 700
  out each). That is about 270 M input and 63 M output tokens a month, or about $60 on Claude Haiku 5.5. The public
  note pipeline adds more for each note made public.
- **Cap:** set `AI_MONTHLY_BUDGET_MICRO_USD`. The budget breaker stops AI at the cap.
- **Self-hosting:** an Ollama GPU instance costs about $423 a month for a g4dn.xlarge. That is not worth it until API
  spend passes that.

### 4.3 Growth: about 50,000 monthly learners

Only when §16.3's triggers fire: p95 over 300 ms, queue depth over 1,000, or connections running out.

| Piece | Change |
| --- | --- |
| api | 4–10 tasks |
| web | 3–6 tasks |
| workers | split per queue (AI, notifications, search, media) |
| RDS | db.m7g.large Multi-AZ (about $400 with 200 GB) + a read replica (about $175) |
| Valkey | cache.t4g.medium ×2 (about $95) |
| Typesense | three-node HA |
| pdf-engine | 2–4 tasks |
| CloudFront | Business flat rate ($200) if traffic needs it |

Expect **about $1,800–2,500 a month** plus AI and GST.

## 5. What you need before the first deploy

| Need | Who | Notes |
| --- | --- | --- |
| Two AWS accounts (sandbox, production) under AWS Organizations, IAM Identity Center users | owner | Separate accounts, as §16.1 requires |
| Budget alerts | owner | `TF_VAR_budget_monthly_usd`, `TF_VAR_budget_alert_email` |
| CloudFront verification | owner | A new account may need a free support case before CloudFront distributions are allowed |
| Fargate vCPU quota | owner | The default is usually enough; raise it if autoscaling to 20 api tasks |
| Domain `learnvianotes.in` | owner | Route 53 or delegated DNS; the ACM certificate in `us-east-1` |
| SES | owner | Verify the sender (or the domain, with DKIM, SPF and DMARC); request production access (the sandbox limit is 200 mails a day to verified addresses) |
| Firebase project | owner | Google sign-in web config and `FIREBASE_PROJECT_ID`; FCM service account JSON (`FCM_SERVICE_ACCOUNT_JSON`) for push; the domain or CloudFront host in authorized domains |
| AI provider key and budget | owner | Saved at `/admin/ai` by a platform admin; `AI_MONTHLY_BUDGET_MICRO_USD` |
| Sentry DSN | owner | `TF_VAR_sentry_dsn` |
| Mobile stores | owner | Google Play Console (Android); Apple Developer membership for iOS (not built yet) |
| GitHub App | optional | Repository activity (ADR-0078) |
| GitHub OAuth app | optional | GitHub sign-in |
| ORCID client | optional | ORCID import (P7c2) |
| Typesense Cloud account | optional | If not run on ECS |
| Tools on the deploying machine | — | AWS CLI v2, Terraform 1.9+, Docker with buildx, `jq`; lvn-web checked out next to lvn-backend |

## 6. Steps

These are for the sandbox. Production is the same with `production` in place of `sandbox`, once `envs/production`
exists (§2.7).

```bash
# Once per account
aws configure sso                                             # a profile with admin rights in the account
cp infra/terraform/envs/sandbox/.env.example infra/terraform/envs/sandbox/.env    # fill in (§5)
infra/terraform/bootstrap.sh sandbox                          # encrypted, versioned state bucket
infra/terraform/run.sh sandbox init

# Every deploy: images tagged by commit, migrations as a one-off task, then a rolling update. The sandbox deploys an
# lvn-web release/** branch (or a v* tag); production only v* tags in both repositories (ADR-0093). lvn-web's
# .github/workflows/deploy.yml runs this on those pushes.
infra/scripts/deploy.sh sandbox                               # first apply: CloudFront takes about 10 minutes
```

### After the first apply

1. Click SES's verification link, and request production access.
2. Put the public address (`run.sh sandbox output -raw public_url`) into Firebase's authorized domains.
3. Make the first platform admin: run SQL in RDS through a one-off ECS task, or use the admin flow ADR-0019 describes.
4. Save the AI provider key at `/admin/ai`.
5. Build the phone app for the environment:
   - `EXPO_PUBLIC_WEB_URL` and `EXPO_PUBLIC_API_URL` go in `env/sandbox.local.env`;
   - run `pnpm build:android sandbox`;
   - upload to Play's internal track.

### Check the deploy

```bash
pnpm smoke <public_url>                                       # 13 checks: health, sign-up, notes, mail
node scripts/lifecycle-check.mjs <public_url> --token-a <a verified account's token>
E2E_LIVE=1 E2E_BASE_URL=<public_url> npx playwright test tests/e2e/live    # from lvn-web
```

**Rollback:**
1. Write the previous image tag to the SSM parameters (`run.sh sandbox output image_tag_parameters`).
2. Run `run.sh sandbox apply`.

Migrations are expand-then-contract, so the previous image runs against the new schema (§16.2).

## 7. Checks before production

These are Phase 9's exit (§18), and should pass on the sandbox first:
- **Load:** k6 with 500 concurrent users, p95 under 300 ms.
- **SLOs:** met for 7 days in the sandbox under load.
- **Security audit:** findings closed; an S3 policy review.
- **Restore drill:** an RDS point-in-time restore into a scratch instance, with the app pointed at it.
- **On-call:** runbooks and on-call written.
- **Mobile:** a staged rollout of 10 % → 50 % → 100 % with a crash-rate gate (under 0.5 %).

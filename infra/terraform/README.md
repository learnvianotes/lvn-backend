# Infrastructure (Terraform)

The sandbox environment of spec §16.1–16.2 on AWS, region `ap-south-1` (Mumbai: closest to the learners, data stays in
India). Production will be the same modules in its own account with production sizes.

```text
envs/sandbox      root module: what runs in the sandbox account
modules/network   VPC, public subnets (ALB, NAT) and private subnets (tasks, data); security groups ALB → apps → data
modules/data      RDS PostgreSQL 16 (managed master password, TLS only) and ElastiCache Redis 7 (encrypted)
modules/storage   S3: files bucket and the restricted bucket for identity documents with its own KMS key (ADR-0019)
modules/secrets   Secrets Manager names for the apps' secrets — values are put in by hand, never in Terraform
modules/service   ECR, ECS Fargate (api, worker, web; a one-off migrate task), ALB with HTTPS and api.<host> routing
```

## First time (per AWS account)

1. Create the state bucket (versioned, encrypted) and an ACM certificate for `sandbox.learnvianotes.in` and
   `api.sandbox.learnvianotes.in` in `ap-south-1`.
2. `cp envs/sandbox/backend.hcl.example envs/sandbox/backend.hcl` and `terraform.tfvars.example` → `terraform.tfvars`.
3. `cd envs/sandbox && terraform init -backend-config=backend.hcl && terraform plan`, then `apply`.
4. Put the values into each `lvn-sandbox/<NAME>` secret (`secret_arns` output): `DATABASE_URL` from `db_endpoint` and
   the RDS-managed password (`db_master_secret_arn`), `REDIS_URL` as `rediss://<redis_endpoint>:6379`, a new JWT key pair
   and `CODE_HMAC_SECRET` (generated the way `scripts/dev-keys.mjs` does — never the development ones),
   `RESEND_API_KEY`, `SENTRY_DSN`.
5. Point both hosts at `alb_dns_name` (Route 53 alias).

## Each deploy (§16.2)

CI builds one image per commit from `infra/docker/api.Dockerfile` (it also runs the worker and the migrations) and
lvn-web's `Dockerfile`, pushes them to ECR with
the commit SHA as tag, runs the `migrate` task to completion, then updates the services with the same `image_tag`.
Rollback is the previous tag.

## Not yet here

- CloudFront, WAF rules and Route 53 records (§16.2) — with the production account.
- The OpenTelemetry collector sidecar and its backends (Prometheus, Loki, Tempo or Grafana Cloud): the apps export to
  `otel_exporter_otlp_endpoint` when it is set (§16.5).
- `NEXT_PUBLIC_*` values are compiled into the web build, so the web image is built per environment until the web reads
  them at run time.
- The deploy workflow itself (needs the AWS account and an OIDC role for GitHub Actions).

`terraform fmt -check` and `terraform validate` (no backend, no credentials) run in CI.

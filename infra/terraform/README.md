# Infrastructure (Terraform)

The sandbox of spec §16.1–16.2 on AWS, with no domain of its own and every setting in one `.env` (ADR-0035). The site
and API are served at CloudFront's `https://<id>.cloudfront.net` address. Production will be the same modules in its
own account with production sizes.

```text
envs/sandbox   root module of the sandbox; settings in envs/sandbox/.env (template .env.example)
bootstrap      the bucket for the Terraform state (once per account)
modules/network   VPC; public and private subnets; optional NAT; security groups CloudFront → ALB → tasks → data
modules/data      RDS PostgreSQL 16 (TLS only, generated password) and ElastiCache Redis 7 (encrypted)
modules/storage   private, versioned, encrypted S3: files, and identity documents under their own KMS key (ADR-0019)
modules/secrets   Secrets Manager entries with the generated values (database, Redis, JWT keys, code secret)
modules/mail      the SES sender identity and the permission to send as it
modules/service   ECR, ECS Fargate (api, worker, web, one-off migrate), internal ALB with /graphql → api
modules/edge      CloudFront with HTTPS on its default address, reaching the ALB through a VPC origin
run.sh, bootstrap.sh, lib.sh   wrappers that load envs/<env>/.env
../scripts/deploy.sh           build, push, migrate, roll out
```

## What you need

- An AWS account and a CLI profile with administrator rights in it (`aws configure sso` or `aws configure`).
- AWS CLI v2, Terraform 1.9 or later, Docker, `jq`, and lvn-web checked out next to lvn-backend.
- An email address you own, for sending mail. SES sends it a verification link.
- For Google sign-in: the Firebase project id and its web app config.

A brand-new AWS account may refuse to create CloudFront distributions until AWS Support verifies it: open a free
"Account and billing" case if `apply` reports "Your account must be verified before you can add new CloudFront
resources".

## First time

```bash
cp infra/terraform/envs/sandbox/.env.example infra/terraform/envs/sandbox/.env   # fill in the empty values
infra/terraform/bootstrap.sh sandbox        # the encrypted state bucket
infra/terraform/run.sh sandbox init
infra/scripts/deploy.sh sandbox             # infrastructure, images, migrations, services (CloudFront takes ~10 min)
```

Then:

1. Click the verification link SES sent to `TF_VAR_mail_from_address`. Until SES production access is granted (SES
   console → Request production access) mail goes only to verified addresses, 200 a day.
2. Add the CloudFront host (`run.sh sandbox output -raw public_url`) to Firebase → Authentication → Settings →
   Authorized domains.
3. For the app: put `EXPO_PUBLIC_WEB_URL=<public_url>` and `EXPO_PUBLIC_API_URL=<public_url>/graphql` in lvn-mobile's
   `env/sandbox.local.env` and build it (`pnpm build:android sandbox`).

## Every deploy

`infra/scripts/deploy.sh sandbox` (refuses uncommitted changes unless `--allow-dirty`). Images are tagged by commit and
kept in SSM Parameter Store, so `run.sh sandbox apply` on its own changes infrastructure without touching what runs.
Rollback: write the previous tag to the SSM parameters (`run.sh sandbox output image_tag_parameters`) and apply.

## Secrets and state

Terraform generates the database password, the JWT key pair and the code HMAC secret and stores them in Secrets
Manager, so they are also in the state. The state bucket is private, encrypted and versioned; anyone who can read it
can read those secrets. Rotating one: `run.sh sandbox apply -replace=tls_private_key.jwt` (for example), then deploy.

## Cost

As sized, roughly US$110–160 a month in `ap-south-1`: the NAT gateway (about a quarter of it), the ALB, two small
Fargate services and a worker, RDS `db.t4g.micro`, ElastiCache `cache.t4g.micro`. `TF_VAR_nat_gateway=false` drops
the NAT gateway; `TF_VAR_budget_alert_email` sets a monthly budget alert. Check with the AWS Pricing Calculator.

## Not yet here

WAF rules (§16.2), the OpenTelemetry collector and its backends (the apps export when
`TF_VAR_otel_exporter_otlp_endpoint` is set), and a deploy workflow in GitHub Actions (needs an OIDC role).
`terraform fmt -check` and `validate` run in CI.

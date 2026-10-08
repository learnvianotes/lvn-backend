# ADR-0035: A domain-free AWS sandbox, configured from one .env

- Status: Accepted (owner direction, 2026-10-08: "Don't think about Domain, focus on configurable .env")
- Date: 2026-10-08
- Deciders: owner; Backend agent
- Spec sections: §16.1 (Environments), §16.2 (Deployment topology), §7.2 (secrets), §2 (email)
- Amends: ADR-0022 for the sandbox's hosts (`sandbox.learnvianotes.in`, `api.sandbox.learnvianotes.in`)

## Context

The Phase 1 Terraform assumed DNS names and an ACM certificate for `sandbox.learnvianotes.in` and
`api.sandbox.learnvianotes.in`, operator-entered secrets, and Resend for mail. The owner wants the sandbox to run
without any domain work, with every setting in a `.env` file, and with as little to set up by hand as possible.

## Decision

1. **No domain.** CloudFront is the only public entrance and serves HTTPS on its own `https://<id>.cloudfront.net`
   address with the default certificate. It reaches an **internal** ALB through a **VPC origin**, so nothing in the VPC
   is reachable from the internet; the ALB admits only the CloudFront origin-facing prefix list. Web and API share that
   origin (`/graphql` and `/health/*` go to the API): no CORS, and the refresh cookie is first-party. The apps'
   `WEB_URL`, `JWT_ISSUER`, `CORS_ORIGINS` and the web's `NEXT_PUBLIC_*_URL` come from the distribution's address;
   `TRUST_PROXY_HOPS=2` (CloudFront, then the ALB).
2. **One `.env` per environment** (`infra/terraform/envs/<env>/.env`, template `.env.example`): `TF_VAR_*` values,
   the AWS CLI profile and the web build's public Firebase config. `run.sh`, `bootstrap.sh` and
   `infra/scripts/deploy.sh` read it. A custom domain later is an alias and a certificate on the distribution.
3. **Generated secrets.** Terraform generates the database password, the JWT key pair and the code HMAC secret and
   writes them, with the Redis URL, to Secrets Manager. The cost is that these values are in the Terraform state; the
   state bucket (created by `bootstrap.sh`) is private, encrypted and versioned, and access to it equals access to the
   environment.
4. **Mail through Amazon SES** (`MAIL_TRANSPORT=ses`), sent with the task role: no SMTP password or API key exists.
   Resend and SMTP stay available.
5. **Images by commit, tags in SSM.** The deploy script pushes images tagged by commit, runs the migrate task, then
   points the services at the new tags, which it keeps in SSM Parameter Store, so a plain `terraform apply` never rolls
   a service back and services stay at zero tasks until their first image exists.

## Consequences

- To stand up the sandbox the owner needs an AWS account with a CLI profile, a sender address to verify, and the
  Firebase project's values; everything else is created by `bootstrap.sh` and `deploy.sh`.
- Brand-new AWS accounts may have to ask AWS Support ("Account and billing", free) before they can create CloudFront
  distributions.
- SES starts in its sandbox: mail reaches only verified addresses, 200 a day, until production access is granted.
- The CloudFront host must be added to Firebase Authentication's authorized domains for web Google sign-in, and the
  mobile sandbox build points `EXPO_PUBLIC_WEB_URL` / `EXPO_PUBLIC_API_URL` at it (`env/sandbox.local.env`).
- Changing the distribution (for example adding a domain) changes the URLs baked into the web image: redeploy.

# ADR-0036: A local environment on a VM, deployed with Terraform, until the AWS sandbox exists

- Status: Accepted (owner direction, 2026-10-08: "create a separate vm environment and install the terraform and use
  locally for now"; "complete phase 1"). Amended the same day: "for now, lets skip deployment to AWS, lets use my
  system with VM, and i can set it up later" — the local environment is the sandbox until the owner sets AWS up.
- Date: 2026-10-08
- Deciders: owner; Backend agent
- Spec sections: §16.1 (Environments), §16.2 (Deployment), §18 (Phase 1 exit criteria)
- Builds on: ADR-0035 (domain-free sandbox from one `.env`), ADR-0032 (RustFS)

## Context

Phase 1's open exit criteria all say "in sandbox": migrations deploy, a file upload round-trips, and web and mobile sign
in. The sandbox (ADR-0035) needs an AWS account, which does not exist yet. Development runs the apps from source with
`pnpm dev` against Docker Compose, so it never exercises the production images, the migration step, generated secrets,
a single entrance in front of web and API, or a deploy. The owner asked for a separate environment on a VM with
Terraform installed in it, used locally for now.

## Decision

1. **A fourth, local environment: `local`.** It stands in for the sandbox on this machine, and is where shared testing
   and phase exit checks run until the owner sets up AWS. It is not a replacement: the AWS sandbox (ADR-0035) stays
   the target, ready to deploy, and nothing in it changes.
2. **A VM, not the host.** `infra/local-vm/vm.sh` runs a Debian 13 cloud image under QEMU/KVM with Docker and
   Terraform (from HashiCorp's apt repository, key pinned by fingerprint). Its disk, SSH key and logs live outside the
   repository (`~/.local/share/lvn-vm`). QEMU publishes the entrance (port 8080) and the S3 endpoint (8081) on the
   addresses listed in `.env` — localhost and the Tailscale address phones use — and Mailpit (8025) on localhost only.
3. **Terraform in the VM, state in the VM.** `infra/terraform/envs/local` uses the Docker provider against the VM's
   engine, with the local backend (`TF_BACKEND=local`; state in `~/.lvn-terraform` in the VM). Settings come from
   `envs/local/.env`, like every environment (ADR-0035).
4. **The sandbox's shape, in containers.** The same backend and web images, built per commit; PostgreSQL 16 with
   pgvector; Redis 7 with a password; RustFS with the sandbox's two buckets and CORS rule; Mailpit in place of SES;
   generated secrets (database, Redis, S3 keys, JWT key pair, code HMAC secret); the migration as its own step before
   the API and worker start on a new image; one entrance (Caddy) routing `/graphql` and `/health/*` to the API and the
   rest to the web, like CloudFront and the load balancer. The apps run with `APP_ENV=sandbox`.
5. **The same deploy flow.** `infra/scripts/deploy-local.sh` builds both images here, loads them into the VM, copies
   the Terraform code in and applies: data services and buckets, migration, then api, worker and web, each waiting
   until healthy. `pnpm smoke <public_url>` checks any deployed environment; Playwright's `tests/e2e/live.spec.ts`
   (lvn-web) drives the real web against it.

## Consequences

- Phase 1's exit criteria can be shown end to end on this machine; the sandbox run remains for when AWS exists.
- The local environment serves plain HTTP: the refresh cookie is not `Secure` there (it is on CloudFront), and phones
  need a build that allows cleartext traffic (the development variant pointed at the VM's address).
- Every client reaches the API through QEMU's port forwarding, so the API sees one client address and the per-network
  sign-in limit applies to all of them together. It is a test environment.
- Pre-signed URLs point at the published S3 endpoint; the API inside the VM reaches it through the host.
- Google sign-in needs the environment's host in Firebase's authorized domains (web) and works from the development
  build (mobile).
- The VM uses 6 CPUs, 8 GB of memory (6 GB until ClamAV joined it, ADR-0041) and up to 40 GB of disk by default
  (`LVN_VM_*` in `.env`).

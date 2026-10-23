# Lightsail: beta and production (ADR-0096)

One Lightsail VM per environment runs the whole stack with Docker Compose (`infra/lightsail/compose.yaml`). Files go to
Cloudflare R2, and email to Resend. Images come from GHCR. GitHub Actions deploys over SSH.

| Environment | Host | VM | Deploys from | GitHub environment |
| --- | --- | --- | --- | --- |
| beta | `https://beta.learnvianotes.in` | Lightsail `lvn-test`, Mumbai, `13.204.214.142`: 2 GB RAM, 2 GB swap, Ubuntu 24.04, Docker 29 | an lvn-backend or lvn-web `release/**` branch | `beta` (both repositories) |
| production | `https://www.learnvianotes.in` (planned) | **none for now**: the server was deleted on 2026-10-22 and will be brought back as another 2 GB VM | a `v*` tag, the same tag in both repositories | `production`, with a required reviewer |

Until production has a VM, a `v*` tag builds and pushes the images, and then the deploy job stops at SSH. Its host
secret is empty, so it fails before it touches anything. Don't push `v*` tags until production is back.

## What runs on the VM

`/opt/lvn`, owned by the `deploy` user (in the docker group):

| Path | What | Written by |
| --- | --- | --- |
| `compose.yaml`, `Caddyfile`, `lvn.sh` | the stack, the entrance, the helper | lvn-backend's deploy (`infra/lightsail/`) |
| `env/stack.env` | compose's own variables: environment name, data passwords, hosts, ACME email | lvn-backend's deploy |
| `env/backend.env` | the api, worker and migrate environment (docs/architecture/env.md) | lvn-backend's deploy |
| `env/web.env` | the web's run-time environment (`API_INTERNAL_URL`, `REVALIDATE_SECRET`) | lvn-backend's deploy |
| `env/api-image.env`, `env/web-image.env` | the images to run | each repository's deploy (`lvn.sh set-image`) |
| `.env` | all of compose's variables, assembled by `lvn.sh up` from the files above | `lvn.sh` |
| `backup.sh`, `backup-r2.env` | the database backup and its backup-only R2 token (see "Backups" below) | Infra, by hand (not the repository's deploy) |

Everything in `env/` is mode 600 in a mode 700 folder. Docker keeps the GHCR read token in `~deploy/.docker/config.json`.

`lvn.sh` on the VM:

- `up`: pull, start or update, then `ready`. After the first deploy, plain `docker compose pull && docker compose up -d`
  in `/opt/lvn` does the same without the check.
- `ready`: every service healthy, the migration exited 0, and `https://<host>/health/ready` answering through Caddy.
  Exits non-zero otherwise, with the failing services' state and logs.
- `status`: services, health, memory.
- `restore <dump>`: see `restore.md`.
- `set-image api|web <image>`: which image the next `up` runs.

### Backups

Backups are done by the host, not by this repository's deploy. Infra's `/opt/lvn/backup.sh` runs from the deploy
user's cron at 02:30 IST (the VM's clock is Asia/Kolkata), dumps Postgres and copies the dump to the environment's R2
backup bucket with a **backup-only** R2 token kept in `/opt/lvn/backup-r2.env` (mode 600). The app's R2 token cannot
write to the backup bucket, and the app never sees the backup token. `deploy.sh` does not install, change or remove
that cron line; it only removes what the retired `lvn.sh backup` left (`env/backup.env` and its cron line) on VMs that
had it. Restoring a dump: `restore.md`.

### The memory budget (2 GB RAM, 2 GB swap)

Each service has a hard cap (`mem_limit`) and is tuned inside it. Measured on the local test of the stack
(2026-10-22): the same images and compose file, a fresh database, then 1,200 page loads and 600 API calls from 24
clients at once.

| Service | Cap | Inside the cap | At rest | Peak under that load |
| --- | --- | --- | --- | --- |
| api | 448 MB | Node heap 288 MB | 293 MB | 311 MB |
| worker | 352 MB | Node heap 192 MB | 228 MB | 266 MB |
| web | 288 MB | Node heap 160 MB | 142 MB | 168 MB |
| postgres | 384 MB | `shared_buffers` 96 MB, `effective_cache_size` 256 MB, `work_mem` 4 MB, 40 connections | 37 MB | 25–37 MB (grows with data, up to its buffers) |
| redis | 96 MB | `maxmemory` 48 MB, `noeviction`, append-only | 11 MB | 12 MB |
| caddy | 64 MB | — | 30 MB | 57 MB |
| migrate (one-off, then exits) | 256 MB | — | — | — |
| **Total of caps** | **1,632 MB** | | **≈ 740 MB** | **≈ 840 MB** |

- That leaves about 400 MB for Ubuntu and Docker, and the swap for spikes. A service over its cap is killed and
  restarted by Docker; the VM keeps going.
- Watch `lvn.sh status`. If the API or the worker sits near its cap, raise it here before anything else (a bigger
  Lightsail plan raises all of them).
- Not on the VM: ClamAV and the PDF engine (uploads are off, ADR-0097), Typesense (search on Postgres), and the
  monitoring stack (ADR-0089: use Grafana Cloud or an uptime check).

## What Infra provisions

For each environment:

1. **The VM.** Beta is done. For production: a 2 GB Lightsail instance in Mumbai with Ubuntu 24.04, Docker and the
   compose plugin, and 2 GB of swap. Open ports 22, 80 and 443 only; SSH by key only. Create a `deploy` user in the
   docker group, and `/opt/lvn` owned by it. Give it a static IP.
2. **DNS.**
   - beta: `beta.learnvianotes.in` A → `13.204.214.142`.
   - production: `www.learnvianotes.in` and `learnvianotes.in` A → its static IP (`learnvianotes.in` redirects to `www`).
   - DNS must point at the VM before the first deploy: Caddy gets its certificates from Let's Encrypt over port 80/443,
     and the deploy fails until the site answers over HTTPS.
3. **R2.**
   - Buckets `lvn-<env>-files`, `lvn-<env>-restricted` and `lvn-<env>-backups`, all private.
   - An R2 API token with Object Read & Write on the files and restricted buckets only (the app's), and a separate
     backup-only token for the backups bucket, which goes in the host's `/opt/lvn/backup-r2.env`, not in GitHub.
   - On the files bucket, a CORS rule:
     - `GET` from any origin (read links are themselves the permission; the phone's PDF reader has no origin);
     - `PUT` from the site's origin only (any request headers: the API signs the ones it needs), exposing `ETag`,
       `Content-Length`, `Content-Range` and `Accept-Ranges`.
     - Uploads are off at launch, so `PUT` matters only once they are turned on.
   - A lifecycle rule on the backups bucket deleting objects after 30 days.
   - Note the account's endpoint, `https://<account id>.r2.cloudflarestorage.com`.
4. **Resend.**
   - Verify the sending domain (`learnvianotes.in`) with the DNS records Resend gives (SPF, DKIM, and a return path).
   - Create an API key with sending access.
   - `MAIL_FROM` must use that domain.
5. **Firebase (Google sign-in).**
   - Add the environment's host to the project's Authorized domains.
   - Production must use the production project; beta must not (the web build refuses a mix-up: lvn-web
     `config/firebase-projects.json`). `learnvianotes-test` is still to be created, so beta can run without Google
     sign-in until then (leave the Firebase variables empty).
6. **GHCR.** A token that can read the organisation's packages: a classic token with `read:packages`, from an account
   that can see the `lvn-backend` and `lvn-web` packages. It is stored as `LVN_GHCR_TOKEN`, with its account name in
   `LVN_GHCR_USER`. The images are pushed by each repository's workflow with its own `GITHUB_TOKEN`.
7. **GitHub environments.**
   - `beta` and `production` in **both** repositories.
   - `production` gets a required reviewer and deployment tags `v*`; `beta` gets deployment branches `release/**`.
   - Then the secrets and variables below.

## GitHub secrets and variables (names only)

Set in the `beta` and the `production` environment of each repository. Values differ per environment.

**lvn-backend** (`.github/workflows/deploy.yml` → `infra/lightsail/deploy.sh`):

| Kind | Name | What |
| --- | --- | --- |
| secret | `LVN_DEPLOY_SSH_KEY` | the deploy user's private SSH key |
| secret | `LVN_DEPLOY_HOST` | the VM's address (beta: `13.204.214.142`) |
| secret | `LVN_SSH_KNOWN_HOSTS` | the VM's host key line(s), from `ssh-keyscan -t ed25519 <host>`, checked by eye |
| secret | `LVN_GHCR_TOKEN` | GHCR read token (step 6) |
| secret | `LVN_POSTGRES_PASSWORD` | from `infra/lightsail/new-secrets.sh` |
| secret | `LVN_REDIS_PASSWORD` | from `new-secrets.sh` |
| secret | `LVN_JWT_PRIVATE_KEY` | from `new-secrets.sh` (PEM) |
| secret | `LVN_JWT_PUBLIC_KEY` | from `new-secrets.sh` (PEM) |
| secret | `LVN_CODE_HMAC_SECRET` | from `new-secrets.sh` |
| secret | `LVN_REVALIDATE_SECRET` | from `new-secrets.sh` |
| secret | `LVN_AI_KEYS_SECRET` | from `new-secrets.sh` |
| secret | `LVN_RESEND_API_KEY` | Resend API key (step 4) |
| secret | `LVN_R2_ACCESS_KEY_ID` | R2 token's access key id (step 3) |
| secret | `LVN_R2_SECRET_ACCESS_KEY` | R2 token's secret |
| secret, optional | `LVN_BACKEND_EXTRA_ENV` | more `KEY=VALUE` lines for `backend.env` from docs/architecture/env.md, e.g. FCM push |
| variable | `LVN_GHCR_USER` | the GHCR token's account |
| variable | `LVN_PUBLIC_URL` | `https://beta.learnvianotes.in` (production: `https://www.learnvianotes.in`) |
| variable | `LVN_SITE_HOSTS` | `beta.learnvianotes.in` (production: `www.learnvianotes.in learnvianotes.in`) |
| variable | `LVN_ACME_EMAIL` | where Let's Encrypt writes about certificates |
| variable | `LVN_APP_ENV` | `sandbox` for beta (noindex), `production` for production |
| variable | `LVN_MAIL_FROM` | e.g. `LearnViaNotes <no-reply@learnvianotes.in>` |
| variable | `LVN_R2_ENDPOINT` | `https://<account id>.r2.cloudflarestorage.com` |
| variable | `LVN_R2_BUCKET` | `lvn-<env>-files` |
| variable | `LVN_R2_RESTRICTED_BUCKET` | `lvn-<env>-restricted` |
| variable, optional | `LVN_FIREBASE_PROJECT_ID` | the Firebase project whose Google sign-in the API accepts |
| variable, optional | `LVN_UPLOADS_ENABLED` | `true` turns uploads on (ADR-0097); unset or `false` at launch |
| variable, optional | `LVN_SENTRY_DSN` | backend error reports |

**lvn-web** (`.github/workflows/deploy.yml`):

| Kind | Name | What |
| --- | --- | --- |
| secret | `LVN_DEPLOY_SSH_KEY`, `LVN_DEPLOY_HOST`, `LVN_SSH_KNOWN_HOSTS`, `LVN_GHCR_TOKEN` | as for lvn-backend |
| variable | `LVN_GHCR_USER`, `LVN_PUBLIC_URL`, `LVN_APP_ENV`, `LVN_R2_ENDPOINT` | as for lvn-backend; the R2 endpoint becomes the web's `NEXT_PUBLIC_STORAGE_ORIGINS` |
| variable, optional | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | the Firebase web app's config; empty hides Google sign-in |
| variable, optional | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics, only after consent (ADR-0092) |
| variable, optional | `NEXT_PUBLIC_SENTRY_DSN` | browser error reports |

**Repository secret already used by lvn-web's CI:** `LVN_BACKEND_READ_TOKEN`, for its contract check. The deploys
don't need it.

## The first deploy (beta)

1. Infra steps 1–7 are done, and DNS for `beta.learnvianotes.in` answers with `13.204.214.142`.
2. Make the stack's secrets on your machine and put them into lvn-backend's `beta` environment, then delete the folder:

   ```bash
   infra/lightsail/new-secrets.sh /tmp/lvn-beta-secrets
   for f in /tmp/lvn-beta-secrets/*; do gh secret set "$(basename "$f")" --env beta --repo learnvianotes/lvn-backend < "$f"; done
   rm -rf /tmp/lvn-beta-secrets
   ```
3. Push a release branch in **lvn-backend** first, then in **lvn-web**:
   - the backend's deploy installs the stack and starts it without the web (the web's compose profile turns on with
     its first image);
   - the web's deploy refuses until `/opt/lvn/lvn.sh` exists.

   ```bash
   git -C lvn-backend switch -c release/beta main && git -C lvn-backend push -u origin release/beta
   git -C lvn-web switch -c release/beta main && git -C lvn-web push -u origin release/beta
   ```
4. Each run ends with `Deployed …` only when every service is healthy and the site answers over HTTPS. Then check
   `https://beta.learnvianotes.in`: sign up with a real address and confirm that the email arrives.
5. Bring the old site's subjects, topics and Sheet 150 problems across as public notes: `legacy-content.md`
   (ADR-0098). It needs the read-only Firestore key and the LearnViaNotes account.

## Every deploy

- **Beta:** push to the release branch. Each repository deploys its own image.
- **Production:** tag the release commit in both repositories with the same `v*` tag, lvn-backend first. Approve the
  `production` deployment of each.
- The backend image is built once per commit, so a tag on a commit beta already ran reuses it. The web image is built
  per environment.
- **Rolling back:** `roll-back.md`.

## Uploads

Off (ADR-0097). To turn them on: room for ClamAV (or a `CLAMAV_URL` elsewhere), the PDF engine for PDF conversion,
`LVN_UPLOADS_ENABLED=true`, the files bucket's `PUT` CORS rule, then deploy lvn-backend.

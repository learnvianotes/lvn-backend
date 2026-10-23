#!/usr/bin/env bash
# Deploys lvn-backend to an environment's Lightsail VM (ADR-0096): installs the stack (compose.yaml, Caddyfile, lvn.sh)
# in /opt/lvn, writes its settings from the environment's GitHub secrets and variables, points it at the new backend
# image, then runs `lvn.sh up` there (pull, start, health) and checks the site over HTTPS from here. Exits non-zero when
# the stack is not healthy. .github/workflows/deploy.yml runs it; an operator can too, with the same variables.
#
#   LVN_ENV=beta|production LVN_API_IMAGE=ghcr.io/learnvianotes/lvn-backend:<sha> infra/lightsail/deploy.sh
#
# Releases (ADR-0093): beta deploys from a release/** branch (or a v* tag), production only from a v* tag. In CI the ref
# is GitHub's (GITHUB_REF_TYPE, GITHUB_REF_NAME); by hand, this checkout's.
# Every variable it reads is listed in docs/runbooks/lightsail.md. Needs ssh, tar and curl here.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
die() { echo "deploy.sh: $*" >&2; exit 1; }
need() { local n; for n in "$@"; do [ -n "${!n:-}" ] || die "$n is not set (docs/runbooks/lightsail.md)"; done; }

need LVN_ENV LVN_API_IMAGE LVN_DEPLOY_HOST LVN_DEPLOY_SSH_KEY LVN_SSH_KNOWN_HOSTS LVN_GHCR_USER LVN_GHCR_TOKEN
need LVN_PUBLIC_URL LVN_SITE_HOSTS LVN_ACME_EMAIL LVN_APP_ENV LVN_MAIL_FROM LVN_R2_ENDPOINT LVN_R2_BUCKET LVN_R2_RESTRICTED_BUCKET
need LVN_POSTGRES_PASSWORD LVN_REDIS_PASSWORD LVN_JWT_PRIVATE_KEY LVN_JWT_PUBLIC_KEY LVN_CODE_HMAC_SECRET LVN_REVALIDATE_SECRET
need LVN_AI_KEYS_SECRET LVN_RESEND_API_KEY LVN_R2_ACCESS_KEY_ID LVN_R2_SECRET_ACCESS_KEY

# --- the release gate --------------------------------------------------------------------------------------------------
ref_type=${GITHUB_REF_TYPE:-} ref=${GITHUB_REF_NAME:-}
if [ -z "$ref_type" ]; then
  if ref=$(git -C "$here" describe --exact-match --tags --match 'v*' HEAD 2>/dev/null); then ref_type=tag
  else ref_type=branch ref=$(git -C "$here" symbolic-ref --short -q HEAD || echo 'a detached HEAD'); fi
fi
case "$LVN_ENV" in
  production)
    if [ "$ref_type" != tag ] || [[ $ref != v* ]]; then
      die "production deploys only from a v* tag (ADR-0093), not $ref_type $ref"
    fi ;;
  beta) { [ "$ref_type" = branch ] && [[ $ref == release/* ]]; } || { [ "$ref_type" = tag ] && [[ $ref == v* ]]; } ||
    die "beta deploys only from a release/** branch or a v* tag (ADR-0093), not $ref_type $ref" ;;
  *) die "LVN_ENV must be beta or production, not $LVN_ENV" ;;
esac

# --- settings ----------------------------------------------------------------------------------------------------------
canonical=$(printf '%s' "$LVN_PUBLIC_URL" | sed -E 's#^https://([^/:]+)/?$#\1#')
[ "$canonical" != "$LVN_PUBLIC_URL" ] || die "LVN_PUBLIC_URL must be https://<host>, e.g. https://beta.learnvianotes.in"
case " $LVN_SITE_HOSTS " in *" $canonical "*) ;; *) die "LVN_SITE_HOSTS ($LVN_SITE_HOSTS) must include $canonical" ;; esac
r2_origin=$(printf '%s' "$LVN_R2_ENDPOINT" | sed -E 's#^(https://[^/]+).*#\1#')
[[ $r2_origin == https://* ]] || die "LVN_R2_ENDPOINT must be https://<account>.r2.cloudflarestorage.com"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
umask 077
mkdir -p "$work/env"

# KEY='value' lines: single quotes keep compose from reading a "$" in a value; a PEM key travels with \n escapes.
kv() {
  local v=$2
  v=${v//$'\r'/}
  v=${v//$'\n'/\\n}
  [[ $v != *"'"* ]] || die "$1 contains a single quote, which an env file cannot hold"
  printf "%s='%s'\n" "$1" "$v"
}

{
  kv LVN_ENV "$LVN_ENV"
  kv LVN_POSTGRES_PASSWORD "$LVN_POSTGRES_PASSWORD"
  kv LVN_REDIS_PASSWORD "$LVN_REDIS_PASSWORD"
  kv LVN_SITE_HOSTS "$LVN_SITE_HOSTS"
  kv LVN_CANONICAL_HOST "$canonical"
  kv LVN_ACME_EMAIL "$LVN_ACME_EMAIL"
} > "$work/env/stack.env"

{
  kv APP_ENV "$LVN_APP_ENV"
  kv LOG_LEVEL "${LVN_LOG_LEVEL:-info}"
  kv RELEASE "${LVN_API_IMAGE##*:}"
  kv API_PORT 4000
  kv WORKER_HEALTH_PORT 4001
  # Caddy is the one proxy in front of the API.
  kv TRUST_PROXY_HOPS 1
  kv CORS_ORIGINS "$LVN_PUBLIC_URL"
  kv WEB_URL "$LVN_PUBLIC_URL"
  kv JWT_ISSUER "$LVN_PUBLIC_URL"
  kv DATABASE_URL "postgresql://lvn:$LVN_POSTGRES_PASSWORD@postgres:5432/lvn"
  kv REDIS_URL "redis://:$LVN_REDIS_PASSWORD@redis:6379"
  kv JWT_PRIVATE_KEY "$LVN_JWT_PRIVATE_KEY"
  kv JWT_PUBLIC_KEY "$LVN_JWT_PUBLIC_KEY"
  kv CODE_HMAC_SECRET "$LVN_CODE_HMAC_SECRET"
  kv AI_KEYS_SECRET "$LVN_AI_KEYS_SECRET"
  # Cloudflare R2 (S3-compatible): pre-signed URLs point at this endpoint, so the web's Content Security Policy names
  # its origin (lvn-web's deploy reads the same LVN_R2_ENDPOINT).
  kv S3_ENDPOINT "$r2_origin"
  kv S3_REGION auto
  kv S3_FORCE_PATH_STYLE true
  kv S3_ACCESS_KEY_ID "$LVN_R2_ACCESS_KEY_ID"
  kv S3_SECRET_ACCESS_KEY "$LVN_R2_SECRET_ACCESS_KEY"
  kv S3_BUCKET "$LVN_R2_BUCKET"
  kv S3_RESTRICTED_BUCKET "$LVN_R2_RESTRICTED_BUCKET"
  kv UPLOADS_ENABLED "${LVN_UPLOADS_ENABLED:-false}"
  kv MAIL_TRANSPORT resend
  kv RESEND_API_KEY "$LVN_RESEND_API_KEY"
  kv MAIL_FROM "$LVN_MAIL_FROM"
  kv SEARCH_PROVIDER postgres
  kv PASSWORD_BREACH_API_URL https://api.pwnedpasswords.com/range
  kv WEB_REVALIDATE_URL http://web:3000/api/revalidate
  kv REVALIDATE_SECRET "$LVN_REVALIDATE_SECRET"
  # Public APIs without keys, as in the local environment: repository cards (ADR-0048) and books (ADR-0074).
  kv GITHUB_API_URL https://api.github.com
  kv GITLAB_API_URL https://gitlab.com/api/v4
  kv OPEN_LIBRARY_URL https://openlibrary.org
  kv OPEN_LIBRARY_COVERS_URL https://covers.openlibrary.org
  [ -z "${LVN_FIREBASE_PROJECT_ID:-}" ] || kv FIREBASE_PROJECT_ID "$LVN_FIREBASE_PROJECT_ID"
  [ -z "${LVN_SENTRY_DSN:-}" ] || kv SENTRY_DSN "$LVN_SENTRY_DSN"
  # Anything else from docs/architecture/env.md, KEY=VALUE per line (e.g. FCM push); it wins over the lines above.
  if [ -n "${LVN_BACKEND_EXTRA_ENV:-}" ]; then
    while IFS= read -r line; do
      line=${line%$'\r'}
      [[ -z $line || $line == \#* ]] && continue
      [[ $line == [A-Z]*=* ]] || die "LVN_BACKEND_EXTRA_ENV: not KEY=VALUE: ${line%%=*}"
      kv "${line%%=*}" "${line#*=}"
    done <<<"$LVN_BACKEND_EXTRA_ENV"
  fi
} > "$work/env/backend.env"

{
  kv API_INTERNAL_URL http://api:4000/graphql
  kv REVALIDATE_SECRET "$LVN_REVALIDATE_SECRET"
} > "$work/env/web.env"

# Backups are not part of this deploy: the host's own /opt/lvn/backup.sh (Infra's, 02:30 IST, a backup-only R2 token in
# /opt/lvn/backup-r2.env) dumps the database. See docs/runbooks/lightsail.md.

# --- the VM ------------------------------------------------------------------------------------------------------------
printf '%s\n' "$LVN_DEPLOY_SSH_KEY" > "$work/key"
printf '%s\n' "$LVN_SSH_KNOWN_HOSTS" > "$work/known_hosts"
target="${LVN_DEPLOY_USER:-deploy}@$LVN_DEPLOY_HOST"
# Where the stack lives on the VM (Infra makes /opt/lvn, owned by the deploy user).
rdir=${LVN_REMOTE_DIR:-/opt/lvn}
remote() { ssh -i "$work/key" -o UserKnownHostsFile="$work/known_hosts" -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=20 "$target" "$@"; }

echo "==> $LVN_ENV: $canonical ($target), backend $LVN_API_IMAGE"
# The stack files, then the settings (only the deploy user can read /opt/lvn/env).
tar -C "$here" -cf - compose.yaml Caddyfile lvn.sh | remote "set -e; cd '$rdir' && tar -xf - && chmod 755 lvn.sh"
tar -C "$work" -cf - env | remote "set -e; cd '$rdir' && umask 077 && mkdir -p env && tar -xf - && chmod 700 env && chmod 600 env/*.env"
# What older deploys left for the retired `lvn.sh backup`: its rclone settings and its cron line (crontab is untouched
# when it has no such line, so the host's own backup schedule stays as Infra set it).
remote "rm -f '$rdir/env/backup.env'; if crontab -l 2>/dev/null | grep -q 'lvn.sh backup'; then crontab -l | grep -v 'lvn.sh backup' | crontab -; fi"
# Pulls from GHCR with a read-only token; docker keeps it for later pulls by hand.
printf '%s' "$LVN_GHCR_TOKEN" | remote "docker login ghcr.io -u '$LVN_GHCR_USER' --password-stdin >/dev/null"
remote "'$rdir/lvn.sh' set-image api '$LVN_API_IMAGE' && LVN_READY_TIMEOUT=${LVN_READY_TIMEOUT:-300} '$rdir/lvn.sh' up"

echo "==> From outside"
curl -fsS --retry 10 --retry-delay 6 --retry-all-errors --max-time 10 "$LVN_PUBLIC_URL/health/ready" >/dev/null ||
  die "$LVN_PUBLIC_URL/health/ready does not answer from outside the VM (DNS, ports 80/443, or the certificate)"
echo "Deployed $LVN_API_IMAGE to $LVN_ENV ($LVN_PUBLIC_URL)"

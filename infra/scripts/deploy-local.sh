#!/usr/bin/env bash
# Deploys the current commits of lvn-backend and lvn-web to the local environment (ADR-0036) — deploy.sh's steps, on
# the VM instead of AWS, with settings from infra/terraform/envs/local/.env:
#   1. starts the VM if needed (infra/local-vm/vm.sh)
#   2. builds the API and web images here, tagged by commit (the web build gets the environment's public URL), and
#      loads them into the VM's Docker
#   3. copies infra/terraform into the VM and applies envs/local there: data services and buckets, the migration with
#      the new API image, then the api, worker and web containers, waiting until each is healthy
#
#   infra/scripts/deploy-local.sh [--allow-dirty]
# Needs: Docker and git here; lvn-web checked out next to lvn-backend (or LVN_WEB_DIR). Terraform runs in the VM.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
backend=$(cd "$here/../.." && pwd)
# shellcheck source=../terraform/lib.sh
. "$backend/infra/terraform/lib.sh"

allow_dirty=${1:-}
web=${LVN_WEB_DIR:-$backend/../lvn-web}
vm="$backend/infra/local-vm/vm.sh"

load_env local
[ "${TF_BACKEND:-}" = local ] || { echo "envs/local/.env must set TF_BACKEND=local" >&2; exit 1; }
[ -d "$web" ] || { echo "lvn-web not found at $web (set LVN_WEB_DIR)" >&2; exit 1; }
public_url=${TF_VAR_public_url:?set TF_VAR_public_url in envs/local/.env}

tag_of() {
  local dir=$1 sha
  sha=$(git -C "$dir" rev-parse --short=12 HEAD)
  if [ -n "$(git -C "$dir" status --porcelain)" ]; then
    [ "$allow_dirty" = --allow-dirty ] || { echo "$dir has uncommitted changes; commit them or pass --allow-dirty" >&2; exit 1; }
    sha="$sha-dirty-$(date +%s)"
  fi
  echo "$sha"
}
api_image="lvn-backend:$(tag_of "$backend")"
web_image="lvn-web:$(tag_of "$web")"

echo "==> VM"
"$vm" status | grep -q '^running' || "$vm" up

echo "==> Images ($api_image, $web_image)"
docker image inspect "$api_image" >/dev/null 2>&1 || docker build -f "$backend/infra/docker/api.Dockerfile" -t "$api_image" "$backend"
docker image inspect "$web_image" >/dev/null 2>&1 || docker build -t "$web_image" \
  --build-arg NEXT_PUBLIC_APP_ENV=sandbox \
  --build-arg NEXT_PUBLIC_SITE_URL="$public_url" \
  --build-arg NEXT_PUBLIC_API_URL="$public_url/graphql" \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:-}" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-}" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-}" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID:-}" \
  --build-arg NEXT_PUBLIC_SENTRY_DSN="${NEXT_PUBLIC_SENTRY_DSN:-}" \
  "$web"
for image in "$api_image" "$web_image"; do
  "$vm" ssh docker image inspect "$image" >/dev/null 2>&1 || { echo "loading $image into the VM"; docker save "$image" | "$vm" ssh docker load; }
done

echo "==> Terraform (in the VM)"
# The VM keeps its own .terraform, state (~/.lvn-terraform) and images.auto.tfvars; only the code and .env are copied.
rsync -a --mkpath --delete -e "$("$vm" ssh-command)" --exclude .terraform/ --exclude '*.tfstate*' --exclude 'envs/*/.env' \
  --exclude images.auto.tfvars "$backend/infra/terraform/" lvn@127.0.0.1:lvn/infra/terraform/
rsync -a -e "$("$vm" ssh-command)" "$backend/infra/terraform/envs/local/.env" lvn@127.0.0.1:lvn/infra/terraform/envs/local/.env
"$vm" ssh "set -euo pipefail
  cd lvn/infra/terraform
  printf 'api_image = \"%s\"\nweb_image = \"%s\"\n' '$api_image' '$web_image' > envs/local/images.auto.tfvars
  [ -d envs/local/.terraform ] || ./run.sh local init
  ./run.sh local apply -input=false -auto-approve"

echo "==> Old images"
# Each repository keeps the image just deployed and the one before it (to roll back to); older builds go, here and in
# the VM, where each API image is about 800 MB.
prune() {
  for repo in lvn-backend lvn-web; do
    docker images "$repo" --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' | sort -r | cut -f2 | grep -vxF -e "$1" -e "$2" | tail -n +2 |
      xargs -r docker image rm >/dev/null 2>&1 || true
  done
}
prune "$api_image" "$web_image"
"$vm" ssh bash -s -- "$api_image" "$web_image" <<<"$(declare -f prune); prune \"\$1\" \"\$2\""

ready=$(curl -fsS "$public_url/health/ready" || true)
echo "Ready: $ready"
echo "Deployed $api_image (api, worker) and $web_image (web) to $public_url"

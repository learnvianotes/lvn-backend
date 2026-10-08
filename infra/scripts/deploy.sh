#!/usr/bin/env bash
# Deploys the current commits of lvn-backend and lvn-web to an environment (spec §16.2), with settings from
# infra/terraform/envs/<env>/.env:
#   1. terraform apply — creates or updates the infrastructure (the first run also creates the CloudFront URL)
#   2. builds the API and web images (the web build gets the public URL) and pushes them to ECR, tagged by commit
#   3. runs the migrate task with the new API image and waits for it to succeed
#   4. points the services at the new images and waits until they are stable and ready
#
#   infra/scripts/deploy.sh sandbox [--allow-dirty]
# Needs: AWS CLI v2 (profile from .env), Terraform >= 1.9, Docker, git; lvn-web checked out next to lvn-backend (or LVN_WEB_DIR).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
backend=$(cd "$here/../.." && pwd)
# shellcheck source=../terraform/lib.sh
. "$backend/infra/terraform/lib.sh"

env=${1:?usage: deploy.sh <env> [--allow-dirty]}
allow_dirty=${2:-}
web=${LVN_WEB_DIR:-$backend/../lvn-web}
tf() { "$backend/infra/terraform/run.sh" "$env" "$@"; }
out() { tf output -raw "$1"; }

load_env "$env"
[ -d "$web" ] || { echo "lvn-web not found at $web (set LVN_WEB_DIR)" >&2; exit 1; }

# Images are tagged by commit and never overwritten (ECR tags are immutable); uncommitted changes need --allow-dirty.
tag_of() {
  local dir=$1 sha
  sha=$(git -C "$dir" rev-parse --short=12 HEAD)
  if [ -n "$(git -C "$dir" status --porcelain)" ]; then
    [ "$allow_dirty" = --allow-dirty ] || { echo "$dir has uncommitted changes; commit them or pass --allow-dirty" >&2; exit 1; }
    sha="$sha-dirty-$(date +%s)"
  fi
  echo "$sha"
}
api_tag=$(tag_of "$backend")
web_tag=$(tag_of "$web")

echo "==> Infrastructure"
[ -d "$backend/infra/terraform/envs/$env/.terraform" ] || tf init
tf apply -input=false -auto-approve

region=$(out region)
public_url=$(out public_url)
cluster=$(out cluster_name)
api_repo=$(tf output -json ecr_repositories | jq -r .api)
web_repo=$(tf output -json ecr_repositories | jq -r .web)
api_param=$(tf output -json image_tag_parameters | jq -r .api)
web_param=$(tf output -json image_tag_parameters | jq -r .web)
registry=${api_repo%%/*}

echo "==> Images ($api_tag, $web_tag)"
aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registry" >/dev/null
pushed() { aws ecr describe-images --region "$region" --repository-name "${1#*/}" --image-ids "imageTag=$2" >/dev/null 2>&1; }
if ! pushed "$api_repo" "$api_tag"; then
  docker build --platform linux/amd64 -f "$backend/infra/docker/api.Dockerfile" -t "$api_repo:$api_tag" "$backend"
  docker push "$api_repo:$api_tag"
fi
if ! pushed "$web_repo" "$web_tag"; then
  docker build --platform linux/amd64 -t "$web_repo:$web_tag" \
    --build-arg NEXT_PUBLIC_APP_ENV="$(out app_environment)" \
    --build-arg NEXT_PUBLIC_SITE_URL="$public_url" \
    --build-arg NEXT_PUBLIC_API_URL="$public_url/graphql" \
    --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:-}" \
    --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-}" \
    --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-}" \
    --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID:-}" \
    --build-arg NEXT_PUBLIC_SENTRY_DSN="${NEXT_PUBLIC_SENTRY_DSN:-}" \
    "$web"
  docker push "$web_repo:$web_tag"
fi

echo "==> Migrations"
aws ssm put-parameter --region "$region" --name "$api_param" --value "$api_tag" --type String --overwrite >/dev/null
# Only the migrate task definition picks up the new API image now; the services follow once migrations succeeded.
tf apply -input=false -auto-approve -target='module.service.aws_ecs_task_definition.this["migrate"]'
subnets=$(tf output -json app_subnet_ids | jq -r 'join(",")')
public_ip=$([ "$(out assign_public_ip)" = true ] && echo ENABLED || echo DISABLED)
task=$(aws ecs run-task --region "$region" --cluster "$cluster" --launch-type FARGATE --task-definition "$(out migrate_task_family)" \
  --network-configuration "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$(out apps_security_group_id)],assignPublicIp=$public_ip}" \
  --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --region "$region" --cluster "$cluster" --tasks "$task"
code=$(aws ecs describe-tasks --region "$region" --cluster "$cluster" --tasks "$task" --query 'tasks[0].containers[0].exitCode' --output text)
[ "$code" = 0 ] || { echo "migrate task failed (exit $code); logs: /ecs/${TF_VAR_name:-lvn-$env}/migrate" >&2; exit 1; }

echo "==> Services"
aws ssm put-parameter --region "$region" --name "$web_param" --value "$web_tag" --type String --overwrite >/dev/null
tf apply -input=false -auto-approve
aws ecs wait services-stable --region "$region" --cluster "$cluster" --services api worker web

ready=$(curl -fsS "$public_url/health/ready" || true)
echo "Ready: $ready"
echo "Deployed $api_tag (api, worker) and $web_tag (web) to $public_url"

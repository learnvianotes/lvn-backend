# Shared by run.sh, bootstrap.sh and infra/scripts/deploy*.sh: loads envs/<env>/.env and works out the state bucket.
# shellcheck shell=bash

TERRAFORM_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

load_env() {
  local env=$1 file="$TERRAFORM_DIR/envs/$1/.env"
  if [ ! -f "$file" ]; then
    echo "No $file — copy envs/$env/.env.example to envs/$env/.env and fill it in." >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$file"
  set +a
  export TF_VAR_region=${TF_VAR_region:-ap-south-1}
  # The local environment (ADR-0036) keeps its state in its VM and needs no AWS account.
  [ "${TF_BACKEND:-s3}" = local ] && return 0
  if [ -z "${TF_STATE_BUCKET:-}" ]; then
    local account
    account=$(aws sts get-caller-identity --query Account --output text)
    TF_STATE_BUCKET="lvn-$env-tfstate-$account"
  fi
  export TF_STATE_BUCKET
}

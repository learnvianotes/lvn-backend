# Shared by run.sh and infra/scripts/*-local.sh: loads envs/<env>/.env. Only the local environment (ADR-0036) runs
# Terraform now; it keeps its state in its VM. The AWS environments were retired for Lightsail (ADR-0096).
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
  export TF_ROOT=$env
  [ "${TF_BACKEND:-}" = local ] || { echo "envs/$env/.env must set TF_BACKEND=local (ADR-0096: no remote state)" >&2; exit 1; }
}

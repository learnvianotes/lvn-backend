#!/usr/bin/env bash
# Terraform for one environment, with its settings from envs/<env>/.env (TF_VAR_*, AWS_PROFILE, TF_STATE_BUCKET).
#   infra/terraform/run.sh sandbox init
#   infra/terraform/run.sh sandbox plan | apply | output | destroy …
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

env=${1:?usage: run.sh <env> <terraform command> [args…]}
shift
load_env "$env"
dir="$TERRAFORM_DIR/envs/$env"

if [ "${1:-}" = init ]; then
  shift
  exec terraform -chdir="$dir" init -input=false \
    -backend-config="bucket=$TF_STATE_BUCKET" \
    -backend-config="key=$env/terraform.tfstate" \
    -backend-config="region=$TF_VAR_region" \
    -backend-config="use_lockfile=true" \
    -backend-config="encrypt=true" "$@"
fi
exec terraform -chdir="$dir" "$@"

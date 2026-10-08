#!/usr/bin/env bash
# Terraform for one environment, with its settings from envs/<env>/.env (TF_VAR_*, AWS_PROFILE, TF_STATE_BUCKET).
# TF_BACKEND=local (the local environment, run inside its VM) keeps the state in $TF_STATE_DIR (~/.lvn-terraform).
#   infra/terraform/run.sh sandbox init
#   infra/terraform/run.sh sandbox plan | apply | output | destroy …
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

env=${1:?usage: run.sh <env> <terraform command> [args…]}
shift
load_env "$env"
dir="$TERRAFORM_DIR/envs/$env"

if [ "${1:-}" = init ] && [ "${TF_BACKEND:-s3}" = local ]; then
  shift
  mkdir -p "${TF_STATE_DIR:-$HOME/.lvn-terraform}"
  exec terraform -chdir="$dir" init -input=false -backend-config="path=${TF_STATE_DIR:-$HOME/.lvn-terraform}/$env.tfstate" "$@"
fi
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

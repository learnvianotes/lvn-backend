#!/usr/bin/env bash
# Terraform for the local environment (ADR-0036), with its settings from envs/local/.env, run inside its VM: the state
# stays in $TF_STATE_DIR (~/.lvn-terraform). The AWS environments were retired for Lightsail (ADR-0096).
#   infra/terraform/run.sh local init
#   infra/terraform/run.sh local plan | apply | output | destroy …
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

env=${1:?usage: run.sh <env> <terraform command> [args…]}
shift
load_env "$env"
dir="$TERRAFORM_DIR/envs/$TF_ROOT"

if [ "${1:-}" = init ]; then
  shift
  mkdir -p "${TF_STATE_DIR:-$HOME/.lvn-terraform}"
  exec terraform -chdir="$dir" init -input=false -backend-config="path=${TF_STATE_DIR:-$HOME/.lvn-terraform}/$env.tfstate" "$@"
fi
exec terraform -chdir="$dir" "$@"

#!/usr/bin/env bash
# Once per AWS account: creates the encrypted, versioned bucket for an environment's Terraform state.
#   infra/terraform/bootstrap.sh sandbox
#   infra/terraform/bootstrap.sh emulated -auto-approve   (the AWS stand-in, ADR-0066)
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

env=${1:?usage: bootstrap.sh <env> [apply options, e.g. -auto-approve]}
shift
load_env "$env"
# bootstrap is its own root module: not the .terraform directory of the environment's (TF_ROOT, ADR-0066).
unset TF_DATA_DIR
state="$TERRAFORM_DIR/bootstrap/$env.tfstate"
terraform -chdir="$TERRAFORM_DIR/bootstrap" init -input=false
terraform -chdir="$TERRAFORM_DIR/bootstrap" apply -input=false -state="$state" -var="region=$TF_VAR_region" -var="bucket=$TF_STATE_BUCKET" "$@"
echo "State bucket: $TF_STATE_BUCKET. Next: infra/terraform/run.sh $env init"

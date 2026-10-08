#!/usr/bin/env bash
# Once per AWS account: creates the encrypted, versioned bucket for an environment's Terraform state.
#   infra/terraform/bootstrap.sh sandbox
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

env=${1:?usage: bootstrap.sh <env>}
load_env "$env"
state="$TERRAFORM_DIR/bootstrap/$env.tfstate"
terraform -chdir="$TERRAFORM_DIR/bootstrap" init -input=false
terraform -chdir="$TERRAFORM_DIR/bootstrap" apply -input=false -state="$state" -var="region=$TF_VAR_region" -var="bucket=$TF_STATE_BUCKET"
echo "State bucket: $TF_STATE_BUCKET. Next: infra/terraform/run.sh $env init"

#!/usr/bin/env bash
# The AWS stand-in (ADR-0066): the sandbox's Terraform applied to Moto, an AWS emulator, on its own small VM, until
# there is an AWS account. Settings come from infra/terraform/envs/emulated/.env. Terraform and Moto run in the VM; the
# code is copied in on each command, so the VM always plans what is checked out here.
#
#   infra/scripts/aws-stand-in.sh up         start the VM and Moto, create the state bucket if missing, init
#   infra/scripts/aws-stand-in.sh plan | apply | destroy | output | validate | state …   Terraform (run.sh emulated …)
#   infra/scripts/aws-stand-in.sh check      fmt, validate, then apply and destroy everything: the whole cycle
#   infra/scripts/aws-stand-in.sh reset      forget the emulated account (a new Moto) and its state
#   infra/scripts/aws-stand-in.sh ssh [cmd…] | down
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
backend=$(cd "$here/../.." && pwd)
vm="$backend/infra/local-vm/vm.sh"
export LVN_VM_ENV=emulated
# shellcheck source=../terraform/lib.sh
. "$backend/infra/terraform/lib.sh"
load_env emulated
moto_image=${LVN_MOTO_IMAGE:?set LVN_MOTO_IMAGE in envs/emulated/.env}
endpoint=${AWS_ENDPOINT_URL:?set AWS_ENDPOINT_URL in envs/emulated/.env}
moto_port=${endpoint##*:}
# AWS's managed IAM policies (the ECS task execution role attaches one) are loaded only when asked for.
moto_env=(-e MOTO_IAM_LOAD_MANAGED_POLICIES=true)
moto_config="$moto_image ${moto_env[*]}"

in_vm() { "$vm" ssh "set -euo pipefail; cd lvn/infra/terraform; $1"; }

sync() {
  # The VM keeps its own .terraform directories and bootstrap state; only the code and .env are copied.
  rsync -a --mkpath --delete -e "$("$vm" ssh-command)" --exclude .terraform/ --exclude '.terraform-*/' --exclude '*.tfstate*' \
    --exclude 'envs/*/.env' --exclude images.auto.tfvars "$backend/infra/terraform/" lvn@127.0.0.1:lvn/infra/terraform/
  rsync -a -e "$("$vm" ssh-command)" "$backend/infra/terraform/envs/emulated/.env" lvn@127.0.0.1:lvn/infra/terraform/envs/emulated/.env
}

moto() {
  # Moto keeps the emulated account in memory: a new container (or a VM that was stopped) starts with nothing.
  # S3 Control puts the account id in front of the host name (123456789012.localhost): the VM resolves it to itself.
  "$vm" ssh "set -euo pipefail
    grep -q ' 123456789012.localhost\$' /etc/hosts || echo '127.0.0.1 123456789012.localhost' | sudo tee -a /etc/hosts >/dev/null
    if [ \"\$(docker inspect -f '{{index .Config.Labels \"lvn.config\"}}' moto 2>/dev/null)\" != '$moto_config' ]; then
      docker rm -f moto >/dev/null 2>&1 || true
      docker run -d --name moto --restart unless-stopped --label 'lvn.config=$moto_config' ${moto_env[*]} -p $moto_port:5000 '$moto_image' >/dev/null
    fi
    docker start moto >/dev/null
    for _ in \$(seq 1 30); do curl -fs -o /dev/null http://127.0.0.1:$moto_port/moto-api/ && exit 0; sleep 1; done
    echo 'Moto did not start; see: docker logs moto' >&2; exit 1"
}

up() {
  "$vm" status | grep -q '^running' || "$vm" up
  echo "==> Moto ($moto_image)"
  moto
  sync
  # A new emulated account has no state bucket: the bootstrap state and the sandbox's .terraform describe the old one.
  if ! in_vm "curl -fs -o /dev/null -I '$endpoint/$TF_STATE_BUCKET'" 2>/dev/null; then
    echo "==> State bucket $TF_STATE_BUCKET (a new emulated account)"
    in_vm "rm -rf bootstrap/emulated.tfstate* envs/sandbox/.terraform-emulated; ./bootstrap.sh emulated -auto-approve"
  fi
  in_vm "[ -d envs/sandbox/.terraform-emulated ] || ./run.sh emulated init"
}

case ${1:-} in
  up) up ;;
  down) "$vm" stop ;;
  ssh)
    shift
    exec "$vm" ssh "$@"
    ;;
  reset)
    "$vm" ssh 'docker rm -f moto >/dev/null 2>&1 || true'
    up
    ;;
  check)
    up
    in_vm "terraform fmt -check -recursive && ./run.sh emulated validate && ./run.sh emulated apply -input=false -auto-approve && ./run.sh emulated destroy -input=false -auto-approve"
    ;;
  plan | apply | destroy | output | validate | state | show | console | import)
    up
    in_vm "./run.sh emulated $(printf '%q ' "$@")"
    ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac

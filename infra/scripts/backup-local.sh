#!/usr/bin/env bash
# Takes a backup of the local environment now (ADR-0089): runs envs/local/backup.sh in the VM and prints where it is.
#   infra/scripts/backup-local.sh
set -euo pipefail
backend=$(cd "$(dirname "$0")/../.." && pwd)
"$backend/infra/local-vm/vm.sh" ssh 'bash lvn/infra/terraform/envs/local/backup.sh'

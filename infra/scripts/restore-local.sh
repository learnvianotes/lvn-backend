#!/usr/bin/env bash
# Restores a backup of the local environment (ADR-0089, docs/runbooks/restore.md): the drill by default (a separate copy,
# checked, then removed), or --replace for the live data. With no backup given, the newest.
#   infra/scripts/restore-local.sh [<backup dir in the VM>] [--replace]
set -euo pipefail
backend=$(cd "$(dirname "$0")/../.." && pwd)
vm="$backend/infra/local-vm/vm.sh"
dir=${1:-}
[[ "$dir" == --* ]] && { mode=$dir; dir=; } || mode=${2:-}
[ -n "$dir" ] || dir=$("$vm" ssh 'ls -1d /var/lib/lvn-backups/*/ | sort | tail -1')
"$vm" ssh "bash lvn/infra/terraform/envs/local/restore.sh ${dir%/} $mode"

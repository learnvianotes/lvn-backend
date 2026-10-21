#!/usr/bin/env bash
# Makes the stack's own secrets for one environment (ADR-0096) into a folder, one file per GitHub secret, readable only
# by you: the data services' passwords, the JWT key pair (RS256, §7.1) and the HMAC, revalidation and sealing secrets.
# Nothing leaves this machine; put each into the GitHub environment, e.g.
#   gh secret set LVN_JWT_PRIVATE_KEY --env beta < <dir>/LVN_JWT_PRIVATE_KEY
# then delete the folder. Changing them later: docs/runbooks/rotate-secrets.md.
#
#   infra/lightsail/new-secrets.sh <dir>
set -euo pipefail
dir=${1:?usage: new-secrets.sh <dir>}
[ ! -e "$dir" ] || { echo "$dir exists; give a new folder" >&2; exit 1; }
umask 077
mkdir -p "$dir"
rand() { openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
rand 32 > "$dir/LVN_POSTGRES_PASSWORD"
rand 32 > "$dir/LVN_REDIS_PASSWORD"
rand 48 > "$dir/LVN_CODE_HMAC_SECRET"
rand 48 > "$dir/LVN_REVALIDATE_SECRET"
rand 48 > "$dir/LVN_AI_KEYS_SECRET"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$dir/LVN_JWT_PRIVATE_KEY" 2>/dev/null
openssl pkey -in "$dir/LVN_JWT_PRIVATE_KEY" -pubout -out "$dir/LVN_JWT_PUBLIC_KEY"
ls -1 "$dir"

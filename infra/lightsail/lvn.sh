#!/usr/bin/env bash
# Runs the LearnViaNotes stack on its Lightsail VM (ADR-0096). Lives in /opt/lvn beside compose.yaml and the Caddyfile;
# infra/lightsail/deploy.sh installs it and calls it over SSH, and an operator can run it by hand as the deploy user.
#
#   lvn.sh set-image api|web <image>   which image the next `up` runs (env/api-image.env, env/web-image.env)
#   lvn.sh up                          assemble .env, pull, start or update every service, then `ready`
#   lvn.sh ready [seconds]             wait until every service is healthy and the site answers through Caddy over
#                                      HTTPS; exits non-zero (with the failing services' state and logs) otherwise
#   lvn.sh status                      services, health and memory
#   lvn.sh restore <dump file>         stop the api and worker, restore the database from a dump, start them again
#
# Backups are the host's own /opt/lvn/backup.sh (Infra's, 02:30 IST), not this script (docs/runbooks/lightsail.md).
# After `up`, plain `docker compose pull && docker compose up -d` in /opt/lvn does the same as `up` without the checks.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"
mkdir -p env
compose() { docker compose "$@"; }
die() { echo "lvn.sh: $*" >&2; exit 1; }
# A setting from env/*.env, without the single quotes deploy.sh writes around values.
value() { sed -n "s/^$1=//p" env/*.env 2>/dev/null | tail -n 1 | sed -E "s/^'(.*)'$/\1/"; }

# compose's own variables: the stack settings, the two images and, once lvn-web has deployed, the web profile.
assemble() {
  [ -f env/stack.env ] || die "env/stack.env is missing: deploy lvn-backend first (infra/lightsail/deploy.sh api)"
  [ -f env/api-image.env ] || die "no API image yet: deploy lvn-backend first"
  local web=''
  [ -f env/web-image.env ] && web=web
  umask 077
  { cat env/stack.env env/api-image.env; [ -n "$web" ] && cat env/web-image.env; echo "COMPOSE_PROFILES=$web"; } > .env
}

set_image() {
  local which=$1 image=$2
  case "$which" in
    api) printf 'LVN_API_IMAGE=%s\n' "$image" > env/api-image.env ;;
    web) printf 'LVN_WEB_IMAGE=%s\n' "$image" > env/web-image.env ;;
    *) die "set-image api|web <image>" ;;
  esac
}

# Services that must be running and healthy; migrate must have finished with 0.
services() { compose config --services | grep -vx migrate; }

health_of() {
  local id
  id=$(compose ps -q "$1")
  [ -n "$id" ] || { echo missing; return; }
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

site_ready() {
  local host
  host=$(value LVN_CANONICAL_HOST)
  [ -n "$host" ] || return 1
  # Through Caddy on this VM, with the real certificate. A local test of the stack sets LVN_READY_PORT (where Caddy's
  # 443 is published) and LVN_READY_INSECURE=1 (Caddy's own CA for localhost).
  local port=${LVN_READY_PORT:-443}
  curl -fsS --max-time 10 ${LVN_READY_INSECURE:+--insecure} --resolve "$host:$port:127.0.0.1" "https://$host:$port/health/ready" >/dev/null
}

ready() {
  local timeout=${1:-300} deadline bad s h
  deadline=$((SECONDS + timeout))
  while :; do
    bad=()
    if [ "$(compose ps -a --format '{{.State}} {{.ExitCode}}' migrate)" != 'exited 0' ]; then bad+=("migrate:$(compose ps -a --format '{{.State}}/{{.ExitCode}}' migrate)"); fi
    for s in $(services); do
      h=$(health_of "$s")
      # healthy, or running for a service without a health check (Caddy: the HTTPS check below covers it).
      [ "$h" = healthy ] || [ "$h" = running ] || bad+=("$s:$h")
    done
    if [ ${#bad[@]} -eq 0 ] && site_ready; then
      echo "ready: every service healthy, https://$(value LVN_CANONICAL_HOST)/health/ready answers"
      return 0
    fi
    if [ $SECONDS -ge $deadline ]; then
      echo "NOT READY after ${timeout}s: ${bad[*]:-every service healthy, but the site does not answer over HTTPS}" >&2
      compose ps -a >&2
      for s in migrate $(services); do
        case " ${bad[*]:-} " in *" $s:"*) echo "--- $s (last 40 lines)" >&2; compose logs --no-color --tail 40 "$s" >&2 || true ;; esac
      done
      [ ${#bad[@]} -eq 0 ] && { echo "--- caddy (last 40 lines)" >&2; compose logs --no-color --tail 40 caddy >&2 || true; }
      return 1
    fi
    sleep 5
  done
}

# Each repository keeps the image running now and the one before it (to roll back to); older ones go.
prune() {
  local repo keep
  for repo in ghcr.io/learnvianotes/lvn-backend ghcr.io/learnvianotes/lvn-web; do
    keep=$(docker ps --format '{{.Image}}' | grep "^$repo:" || true)
    docker images "$repo" --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' | sort -r | cut -f2 |
      { if [ -n "$keep" ]; then grep -vxF "$keep"; else cat; fi; } | tail -n +2 | xargs -r docker image rm >/dev/null 2>&1 || true
  done
}

up() {
  assemble
  # LVN_PULL=never: images built on this machine (a local test of the stack), not in GHCR.
  [ "${LVN_PULL:-always}" = never ] || compose pull --quiet
  compose up -d --remove-orphans
  prune
  ready "${LVN_READY_TIMEOUT:-300}"
}

status() {
  compose ps -a
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}'
  free -m
}

restore() {
  local file=${1:?restore <dump file>}
  [ -f "$file" ] || die "no such file: $file"
  compose stop api worker
  compose exec -T postgres pg_restore -U lvn -d lvn --clean --if-exists --no-owner < "$file"
  compose start api worker
  ready "${LVN_READY_TIMEOUT:-300}"
}

case "${1:-}" in
  set-image) set_image "${2:-}" "${3:?set-image api|web <image>}" ;;
  up) up ;;
  ready) assemble; ready "${2:-300}" ;;
  status) status ;;
  restore) restore "${2:-}" ;;
  *) sed -n '2,13p' "$0"; exit 64 ;;
esac

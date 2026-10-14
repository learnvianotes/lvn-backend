#!/usr/bin/env bash
# Restores a backup of the local environment, run in the VM (ADR-0089, docs/runbooks/restore.md).
#   restore.sh <backup dir>            the drill: into a separate database (lvn_restore) and buckets (<bucket>-restore),
#                                      every table's count compared with the backup's, then an API started on the copy
#                                      and asked; all of it removed afterwards. The live data is never touched.
#   restore.sh <backup dir> --replace  into the live database and buckets (the API and worker must be stopped first)
set -euo pipefail
dir=${1:?usage: restore.sh <backup dir> [--replace]}
mode=${2:-drill}
name=${LVN_NAME:-lvn-local}
[ -f "$dir/lvn.dump" ] || { echo "no lvn.dump in $dir" >&2; exit 1; }
env=$(docker inspect "$name-worker" --format '{{range .Config.Env}}{{println .}}{{end}}')
value() { grep "^$1=" <<<"$env" | head -1 | cut -d= -f2-; }
s3() { docker run --rm --network "$name" -v "$dir:/backup" -e AWS_ACCESS_KEY_ID="$(value S3_ACCESS_KEY_ID)" -e AWS_SECRET_ACCESS_KEY="$(value S3_SECRET_ACCESS_KEY)" -e AWS_DEFAULT_REGION=us-east-1 amazon/aws-cli:2.37.10 --endpoint-url http://s3:9000 "$@"; }
sql() { docker exec -i "$name-postgres" psql -U lvn -v ON_ERROR_STOP=1 "$@"; }
files=$(value S3_BUCKET)
restricted=$(value S3_RESTRICTED_BUCKET)

if [ "$mode" = --replace ]; then
  if docker ps --format '{{.Names}}' | grep -qE "^$name-(api|api-[0-9]+|worker)$"; then echo "stop the API and worker first" >&2; exit 1; fi
  sql -d postgres -c 'drop database if exists lvn with (force)' -c 'create database lvn owner lvn'
  docker exec -i "$name-postgres" pg_restore -U lvn -d lvn --no-owner < "$dir/lvn.dump"
  for b in "$files" "$restricted"; do s3 s3 sync "/backup/buckets/$b" "s3://$b" --delete --only-show-errors; done
  echo "restored $dir into the live database and buckets: deploy-local.sh starts the apps again"
  exit 0
fi

db=lvn_restore
cleanup() {
  docker rm -f "$name-restore-api" >/dev/null 2>&1 || true
  sql -d postgres -qc "drop database if exists $db with (force)" >/dev/null 2>&1 || true
  for b in "$files-restore" "$restricted-restore"; do s3 s3 rb "s3://$b" --force >/dev/null 2>&1 || true; done
}
trap cleanup EXIT
cleanup
started=$(date +%s)
sql -d postgres -qc "create database $db owner lvn"
docker exec -i "$name-postgres" pg_restore -U lvn -d "$db" --no-owner < "$dir/lvn.dump"
for b in "$files" "$restricted"; do
  s3 s3 mb "s3://$b-restore" >/dev/null
  s3 s3 sync "/backup/buckets/$b" "s3://$b-restore" --only-show-errors
done
restored=$(( $(date +%s) - started ))

# Every table's count, against the backup's.
docker exec "$name-postgres" psql -U lvn -d "$db" -Atc "
  select n.nspname || '.' || c.relname, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and not c.relispartition and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%'
  order by 1" > /tmp/restore-counts.txt
tables=$(wc -l < "$dir/counts.txt")
if ! diff <(cat "$dir/counts.txt") /tmp/restore-counts.txt > /tmp/restore-diff.txt; then
  echo "row counts differ from the backup:"; cat /tmp/restore-diff.txt; exit 1
fi
objects=$(find "$dir/buckets" -type f | wc -l)
copied=$(s3 s3 ls "s3://$files-restore" --recursive | wc -l)
copied=$(( copied + $(s3 s3 ls "s3://$restricted-restore" --recursive | wc -l) ))
[ "$objects" = "$copied" ] || { echo "the backup holds $objects objects; $copied were restored" >&2; exit 1; }

# The API on the copy: it must start, be ready and answer. Its settings are the live API's, pointed at the copy; one
# argument each, as the JWT key spans lines.
mapfile -d '' envs < <(docker inspect "$name-api" --format '{{json .Config.Env}}' | python3 -c 'import json, sys; [sys.stdout.write(e + "\0") for e in json.load(sys.stdin)]')
mapfile -d '' cmd < <(docker inspect "$name-api" --format '{{json .Config.Cmd}}' | python3 -c 'import json, sys; [sys.stdout.write(e + "\0") for e in (json.load(sys.stdin) or [])]')
args=()
for e in "${envs[@]}"; do
  case "$e" in
    DATABASE_URL=*) e="${e%/lvn}/$db" ;;
    S3_BUCKET=*) e="S3_BUCKET=$files-restore" ;;
    S3_RESTRICTED_BUCKET=*) e="S3_RESTRICTED_BUCKET=$restricted-restore" ;;
    OTEL_EXPORTER_OTLP_ENDPOINT=*) continue ;;
  esac
  args+=(-e "$e")
done
docker run -d --name "$name-restore-api" --network "$name" "${args[@]}" "$(docker inspect "$name-api" --format '{{.Config.Image}}')" "${cmd[@]}" > /dev/null
for _ in $(seq 1 60); do
  docker exec "$name-proxy" wget -qO- "http://$name-restore-api:4000/health/ready" >/dev/null 2>&1 && break
  sleep 2
done
answer=$(docker exec "$name-proxy" wget -qO- --header 'content-type: application/json' --post-data '{"query":"{ termsVersion }"}' "http://$name-restore-api:4000/graphql")
grep -q termsVersion <<<"$answer" || { echo "the API on the copy did not answer: $answer" >&2; exit 1; }
users=$(docker exec "$name-postgres" psql -U lvn -d "$db" -Atc 'select count(*) from users."User"')
notes=$(docker exec "$name-postgres" psql -U lvn -d "$db" -Atc 'select count(*) from notes."Note"')
echo "drill passed: $dir restored in ${restored}s; $tables tables match the backup ($users users, $notes notes); $objects files; the API on the copy answered"

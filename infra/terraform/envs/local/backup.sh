#!/usr/bin/env bash
# A backup of the local environment, run in the VM (ADR-0089, docs/runbooks/restore.md): the database (pg_dump -Fc),
# both buckets and every table's row count, into /var/lib/lvn-backups/<UTC time>; the newest 7 are kept. Cron runs it
# nightly (backup.tf); infra/scripts/backup-local.sh runs it now. Prints the backup's directory.
set -euo pipefail
name=${LVN_NAME:-lvn-local}
root=/var/lib/lvn-backups
at=$(date -u +%Y%m%dT%H%M%SZ)
dir=$root/$at
sudo mkdir -p "$dir"
sudo chown "$(id -u):$(id -g)" "$root" "$dir"

docker exec "$name-postgres" pg_dump -U lvn -d lvn -Fc > "$dir/lvn.dump"
# The counts the restore drill compares with.
docker exec "$name-postgres" psql -U lvn -d lvn -Atc "
  select n.nspname || '.' || c.relname, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and not c.relispartition and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%'
  order by 1" > "$dir/counts.txt"

env=$(docker inspect "$name-worker" --format '{{range .Config.Env}}{{println .}}{{end}}')
value() { grep "^$1=" <<<"$env" | head -1 | cut -d= -f2-; }
for bucket in "$(value S3_BUCKET)" "$(value S3_RESTRICTED_BUCKET)"; do
  docker run --rm --network "$name" -v "$dir:/backup" -e AWS_ACCESS_KEY_ID="$(value S3_ACCESS_KEY_ID)" -e AWS_SECRET_ACCESS_KEY="$(value S3_SECRET_ACCESS_KEY)" \
    -e AWS_DEFAULT_REGION=us-east-1 amazon/aws-cli:2.37.10 --endpoint-url http://s3:9000 s3 sync "s3://$bucket" "/backup/buckets/$bucket" --only-show-errors
done
sudo chown -R "$(id -u):$(id -g)" "$dir"

ls -1d "$root"/*/ | sort | head -n -7 | xargs -r rm -rf
echo "$dir"

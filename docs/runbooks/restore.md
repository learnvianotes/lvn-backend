# Restore from backup

When: data was lost or corrupted (a bad migration, a mistaken delete, a broken disk), or for the quarterly drill
(§16.5). A backup counts only once it has been restored and the app has run against the copy (Phase 9 plan).

## What is backed up

| Data | Lightsail (beta, production — ADR-0096) | Local environment (ADR-0036) |
| --- | --- | --- |
| Postgres | `lvn.sh backup`: a daily `pg_dump -Fc` (03:00 IST, cron of the deploy user), the last 3 in `/opt/lvn/backups`, every one in the environment's R2 backup bucket (its lifecycle rule keeps 30 days) | `infra/scripts/backup-local.sh`: a nightly `pg_dump -Fc` into `/var/lib/lvn-backups` in the VM, 7 kept |
| Files | R2 buckets. Uploads are off at launch (ADR-0097); with them on, keep R2's object versioning or a copy job (not built) | The same script copies both buckets beside the dump |
| Redis | Append-only file in its volume. Queues and sessions only: losing Redis signs people out and drops waiting jobs, never notes | Append-only file in its volume |
| Typesense | Not run on Lightsail (search on Postgres) | Not backed up: it is rebuilt from Postgres (`reindexSearch`, §11) |

## Restore on Lightsail

On the VM (`ssh deploy@<host>`, in `/opt/lvn`):

1. **Get the dump.** The last three are in `backups/`. Older ones come from the R2 backup bucket, under `<env>/`:
   `docker run --rm --env-file env/backup.env -v "$PWD/backups:/backups" rclone/rclone:1.68.2 copy
   r2:<bucket>/<env>/lvn-<stamp>.dump /backups/`.
2. **Check it first** without touching the live data: `docker compose exec -T postgres createdb -U lvn lvn_check`,
   then `docker compose exec -T postgres pg_restore -U lvn -d lvn_check --no-owner < backups/lvn-<stamp>.dump`. Compare
   counts:

   ```sql
   select count(*) from notes."Note";
   select count(*) from users."User" where "deletedAt" is null;
   select max("updatedAt") from notes."Note";
   ```

   Then `docker compose exec -T postgres dropdb -U lvn lvn_check`.
3. **Restore.** `./lvn.sh restore backups/lvn-<stamp>.dump` stops the api and worker, restores into `lvn` (`--clean`),
   starts them, and fails unless everything is healthy again.
4. **A lost VM.** Make a new one (docs/runbooks/lightsail.md, "What Infra provisions"), point DNS at it, deploy both
   repositories (the GitHub environments hold every secret), then copy the dump to it and run step 3.
5. **Check.** `pnpm smoke <url>` and `node scripts/lifecycle-check.mjs <url>`.
6. **Write it up** in the incident log: what was lost between the dump and the stop, and who must be told (§16.6: a
   personal-data loss may need notice within 72 hours; see `leakage-report.md`).

## Restore on the local environment

`infra/scripts/backup-local.sh` takes a backup now (a systemd timer in the VM runs it nightly: `systemctl --user
list-timers`). `infra/scripts/restore-local.sh <backup>` restores one into a separate database (`lvn_restore`) and separate buckets. It starts an API on the copy and
checks that every table's row count matches the backup and that the API answers on it. This is the drill, and it never
touches the live data. To replace the live data with a backup:

1. `infra/local-vm/vm.sh ssh 'docker stop lvn-local-api lvn-local-api-2 lvn-local-worker'`.
2. `infra/scripts/restore-local.sh <backup> --replace` drops `lvn`, restores the dump into it and copies the buckets
   back.
3. `infra/scripts/deploy-local.sh`, then smoke and lifecycle.

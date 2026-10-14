# Restore from backup

When: data was lost or corrupted (a bad migration, a mistaken delete, a broken disk), or for the quarterly drill
(§16.5). A backup counts only once it has been restored and the app has run against the copy (Phase 9 plan).

## What is backed up

| Data | AWS (sandbox, prod) | Local environment (ADR-0036) |
| --- | --- | --- |
| Postgres | RDS automated backups: 7 days, point-in-time restore to any second (`backup_retention_period`) | `infra/scripts/backup-local.sh`: a nightly `pg_dump -Fc` into `/var/lib/lvn-backups` in the VM, 7 kept |
| Files (S3) | Versioned buckets: an overwritten or deleted object keeps its old version 30 days (1 for restricted) | The same script copies both buckets beside the dump |
| Redis | Daily snapshots, 7 kept (ADR-0089). Queues and sessions only: losing Redis signs people out and drops waiting jobs, never notes | Append-only file in its volume |
| Typesense | Not backed up: it is rebuilt from Postgres (`reindexSearch`, §11) | Same |

## Restore on AWS

1. **Stop writes.** Scale the api and worker services to 0: `aws ecs update-service --cluster <name> --service api
   --desired-count 0`, then the same for the worker. The web shows the maintenance page while the API is down.
2. **Restore Postgres to a new instance**, at the moment before the damage: `aws rds restore-db-instance-to-point-in-time
   --source-db-instance-identifier <name> --target-db-instance-identifier <name>-restored --restore-time <UTC ISO>`.
   Wait for `available`.
3. **Check the copy.** Connect through the bastion task (`infra/scripts/aws-stand-in.sh psql` in the stand-in), then
   compare counts against what you expect:

   ```sql
   select count(*) from notes."Note";
   select count(*) from users."User" where "deletedAt" is null;
   select max("updatedAt") from notes."Note";
   ```
4. **Swap.** Point `DATABASE_URL` in Secrets Manager at the restored instance: update `<name>/DATABASE_URL`, or rename
   the instances so the old name points to the copy. Then redeploy with `infra/scripts/deploy.sh <env>`, which runs
   migrations (a no-op on a copy of the same schema).
5. **Files.** Restore a deleted object by deleting its delete marker: `aws s3api delete-object --bucket <files>
   --key <key> --version-id <marker id>`. A whole prefix: list versions with `aws s3api list-object-versions --prefix
   <env>/<ownerId>/`.
6. **Search.** As a platform admin, run `reindexSearch` from the admin page, then compare search counts.
7. **Start again.** Scale api and worker back (min 2 api). Run `pnpm smoke <url>` and `node
   scripts/lifecycle-check.mjs <url>`.
8. **Write it up** in the incident log: what was lost between the restore point and the stop, and who must be told
   (§16.6: a personal-data loss may need notice within 72 hours; see `leakage-report.md`).

## Restore on the local environment

`infra/scripts/backup-local.sh` takes a backup now (the VM's cron runs it nightly). `infra/scripts/restore-local.sh
<backup>` restores one into a separate database (`lvn_restore`) and separate buckets. It starts an API on the copy and
checks that every table's row count matches the backup and that the API answers on it. This is the drill, and it never
touches the live data. To replace the live data with a backup:

1. `infra/local-vm/vm.sh ssh 'docker stop lvn-local-api lvn-local-api-2 lvn-local-worker'`.
2. `infra/scripts/restore-local.sh <backup> --replace` drops `lvn`, restores the dump into it and copies the buckets
   back.
3. `infra/scripts/deploy-local.sh`, then smoke and lifecycle.

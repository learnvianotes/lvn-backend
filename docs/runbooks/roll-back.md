# Roll back a release

When: a deploy made things worse: errors or latency up on the dashboard, a feature broken, the smoke check failing.
Roll back first, investigate after.

Images are tagged by commit and never overwritten (ECR tags are immutable), so the previous release is always there.
Migrations are expand-then-contract (§7.4): a release adds columns and tables and never drops what the previous
release reads. Running the previous code against the new schema is therefore safe, and a rollback never needs a down
migration.

## AWS

1. Find the previous good commit: the last `Deployed …` line in the deploy log, or `aws ecs describe-task-definition`
   on the previous revision.
2. `git -C lvn-backend checkout <commit>` (and lvn-web if the web changed), then `infra/scripts/deploy.sh <env>`. The
   images exist, so nothing is rebuilt; the migrate step finds nothing to do.
3. Faster, without a checkout: `aws ecs update-service --cluster <name> --service api --task-definition <previous
   revision>`, then the same for worker and web.
4. `pnpm smoke <url>`; watch p95 and the error rate for 15 minutes.
5. If the bad release ran a migration that changed data, not only the schema, restore that data (`restore.md`).

## Local environment

1. `git -C lvn-backend checkout <commit>` (and lvn-web).
2. `infra/scripts/deploy-local.sh`: the images for that commit are rebuilt or found in the VM.
3. `pnpm smoke http://100.70.234.41:8080`.

## Phones

A phone build cannot be rolled back on people's phones. The API stays compatible with the two previous app versions
(§6.2, additive schema changes only), so a phone release is rolled forward with a fix. Until then, switch the feature
off by its flag.

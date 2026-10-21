# Roll back a release

When: a deploy made things worse: errors or latency up on the dashboard, a feature broken, the smoke check failing.
Roll back first, investigate after.

Images are tagged by commit and never overwritten (GHCR keeps every pushed tag, and the VM keeps the previous one), so
the previous release is always there.
Migrations are expand-then-contract (§7.4): a release adds columns and tables and never drops what the previous
release reads. Running the previous code against the new schema is therefore safe, and a rollback never needs a down
migration.

## Lightsail (beta, production — ADR-0096)

1. Find the previous good images: GitHub → Actions → deploy, the last green run before the bad one, prints
   `Deployed ghcr.io/…/lvn-backend:<sha>`; lvn-web's prints its image the same way. On the VM, `docker images` lists
   the one kept from before.
2. On the VM (`ssh deploy@<host>`), point the stack back at them and bring it up; it checks itself and fails loudly:

   ```bash
   /opt/lvn/lvn.sh set-image api ghcr.io/learnvianotes/lvn-backend:<previous sha>
   /opt/lvn/lvn.sh set-image web ghcr.io/learnvianotes/lvn-web:<env>-<previous sha>   # if the web changed
   /opt/lvn/lvn.sh up
   ```

   The migrate step finds nothing to do (the schema only grows, §7.4).
3. `pnpm smoke <url>`; watch the error rate and the API's logs (`docker compose logs -f api` in /opt/lvn) for 15 minutes.
4. If the bad release ran a migration that changed data, not only the schema, restore that data (`restore.md`).
5. Fix forward: revert on the release branch (beta follows), then tag the next patch version in both repositories
   (ADR-0093).

## Local environment

1. `git -C lvn-backend checkout <commit>` (and lvn-web).
2. `infra/scripts/deploy-local.sh`: the images for that commit are rebuilt or found in the VM.
3. `pnpm smoke http://100.70.234.41:8080`.

## Phones

A phone build cannot be rolled back on people's phones. The API stays compatible with the two previous app versions
(§6.2, additive schema changes only), so a phone release is rolled forward with a fix. Until then, switch the feature
off by its flag.

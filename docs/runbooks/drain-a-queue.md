# Drain a queue

When: a queue's waiting or failed count keeps growing (the DLQ-growth alert, §16.4); a bad job keeps failing; a deploy
needs a queue empty first; a provider (AI, mail, push) is down and jobs should wait rather than fail.

Queues are BullMQ on Redis, named `<context>.<purpose>`: `ai.tasks`, `notes.media`, `notes.search`, `notes.chunks`,
`notes.pdf`, `notes.pdf-parse`, `notes.import`, `users.export`, `users.skills`, `users.welcome`, `comms.email`, `comms.push`,
`core.engagement`, `core.github`, `core.learning-analytics`, and the `*.maintenance` schedules. Every job is
idempotent (§9.2), so a job run twice does no harm.

## Look

The worker's CLI talks to BullMQ directly, so it works while the worker is stopped. On the local environment, in the
worker's container; on Lightsail, as the deploy user in `/opt/lvn`, `docker compose exec worker node apps/worker/dist/cli.js …`
with the same arguments.

```bash
# Every queue's waiting, delayed, active and failed jobs
infra/local-vm/vm.sh ssh 'docker exec lvn-local-worker node apps/worker/dist/cli.js queues'
# The last 20 failed jobs of a queue, with their reasons
infra/local-vm/vm.sh ssh 'docker exec lvn-local-worker node apps/worker/dist/cli.js queue:failed ai.tasks'
```

Prometheus has the same counts as `lvn_queue_backlog{queue,state}` and the outcomes as `lvn_queue_jobs_total`, on
Grafana's SLO dashboard (ADR-0089).

## Act

Each with `node apps/worker/dist/cli.js` in the worker's container:

- **Retry the failed jobs** once the cause is fixed: `queue:retry <queue>`.
- **Pause a queue** while a dependency is down, so jobs wait instead of failing: `queue:pause <queue>`, then
  `queue:resume <queue>`.
- **Run a scheduled job now** (housekeeping after an outage, or to check one): `queue:run <queue> <job>`, e.g.
  `queue:run users.maintenance delete-accounts`.
- **The admin metrics rollup missed nights** (ADR-0106; the worker was down longer than `METRICS_ROLLUP_DAYS`):
  `metrics:backfill <from> <to>` with past IST days, e.g. `metrics:backfill 2026-10-20 2026-11-12`. It runs in the
  CLI's own process, not on the queue, a month at a time, and rewrites days already rolled up with the same rows.
  Until then the dashboard counts the missing days from the tables, so nothing is wrong, only slower.
- **Drop a poisoned job** (it fails every time and blocks nothing else, but fills the failed set): note its id and
  reason from `queue:failed` in the incident log, then remove it with BullMQ's `getJob(id)` and `remove()`.
- **Empty a queue** only when its jobs are recomputed anyway: `notes.search` (reindex instead), `core.engagement`
  (the next learning event queues it again). Use BullMQ's `obliterate({ force: true })`. Never empty `comms.email`,
  `users.export` or `users.welcome`; people are waiting for those.
- **Before a deploy that changes a job's data shape**: pause the queue, deploy, resume. The new worker reads the old
  jobs as the old shape, so a job must accept both for one release.

Redis must keep `maxmemory-policy noeviction` (ADR-0089). If Redis is full, writes fail visibly instead of jobs
vanishing. Fix it by draining or by raising the memory, never by allowing eviction.

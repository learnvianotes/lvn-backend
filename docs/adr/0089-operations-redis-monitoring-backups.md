# ADR-0089: Operations — Redis for queues, monitoring with SLO alerts, backups and the restore drill

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend agent; owner
- Spec sections: §9.1 (BullMQ), §16.4 (SLOs, alerts), §16.5 (runbooks, restore), §18 Phase 9

## Context

Phase 9's review of operations (docs/plans/phase-9.md) found:

- **Redis** on the local environment had no memory policy and no persistence, and no volume: a restart lost every
  waiting job. The AWS module's ElastiCache used `default.redis7`, whose `volatile-lru` evicts. BullMQ's "going to
  production" guidance is `maxmemory-policy noeviction`, because an evicted job key loses the job without a trace.
- **No metrics backend.** The apps exported OpenTelemetry when `OTEL_EXPORTER_OTLP_ENDPOINT` was set, but nothing
  received it. No alert existed, so §16.4's SLOs could not be measured or alerted on, and queue depth was not
  measured at all.
- **No backups on the local environment** (RDS and S3 versioning cover AWS), and no restore had ever been tried.
- **Runbooks:** only moderation existed.

## Decision

- **Redis** keeps every key and survives restarts.
  - Locally: `--maxmemory 512mb --maxmemory-policy noeviction --appendonly yes --appendfsync everysec`, with a volume.
  - On AWS: a `redis7` parameter group with `maxmemory-policy noeviction`, and 7 daily snapshots.

  A full Redis then refuses writes, which is seen, instead of dropping jobs, which is not.
- **Queue metrics** from the worker (libs/queue):
  - `lvn.queue.jobs`, a counter by queue and outcome (completed, or failed after the last attempt): the job SLO;
  - `lvn.queue.backlog`, a gauge by queue and state (waiting, delayed, active, failed), read at each collection.

  API latency and errors come from the HTTP instrumentation's `http.server.request.duration`.
- **Monitoring on the local environment** (`envs/local/monitoring.tf`, configuration in `infra/terraform/monitoring`):
  - an OpenTelemetry Collector (OTLP in, Prometheus out), which the apps send to by default;
  - Prometheus, keeping 15 days and evaluating `rules.yml`;
  - Alertmanager, emailing alerts (to Mailpit here);
  - Grafana with the SLO dashboard at `<public_url>/grafana`, behind its own sign-in. The admin password is a
    Terraform output.

  `rules.yml` holds the SLOs as recording rules and the alerts of `docs/runbooks/on-call.md`: multiwindow,
  multi-burn-rate error-budget alerts for 99.9 % availability, p95 over 300 ms, queue backlog, failing jobs and a
  silent service. The sandbox will run the same rules on a managed Prometheus when AWS starts.
- **Backups on the local environment.** `envs/local/backup.sh` runs nightly from a systemd timer in the VM, and on
  demand from `infra/scripts/backup-local.sh`. It takes `pg_dump -Fc`, both buckets and every table's row count, and keeps 7.
- **The restore drill.** `envs/local/restore.sh`, run through `infra/scripts/restore-local.sh`:
  - restores a backup into a separate database and separate buckets;
  - checks every table's count and every file against the backup;
  - starts an API on the copy and asks it a question;
  - removes the copy.

  It never touches the live data. `--replace` restores over the live data, for a real recovery.
- **Runbooks** (`docs/runbooks/`): restore, rotate secrets, drain a queue, roll back, leakage report, on-call.

## Consequences

- An alert can now fire, and the SLOs can be read for any window, including Phase 9's soak.
- The VM carries four more containers (about 600 MB of memory together).
- Paging a person needs an address and, on AWS, a delivery channel (SNS or email). The owner chooses who is on call
  (`ALERT_EMAIL`); until then alerts land in Mailpit.
- The restore drill is repeatable: run it after any change to the schema's shape, and quarterly.

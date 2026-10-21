# On-call

What is watched, what wakes someone, and what they do (§16.4).

## Service level objectives

| SLO | Target | Measured from |
| --- | --- | --- |
| API availability | 99.9 % of requests not 5xx, over 30 days | `http.server.request.duration` (OpenTelemetry), by status |
| API latency | p95 < 300 ms | the same histogram |
| Jobs | 99.5 % of jobs succeed, over 30 days | `lvn.queue.jobs` completed vs failed (worker, ADR-0089) |
| Public note TTFB | < 500 ms | k6 and the web's server timing |

A 30-day 99.9 % budget is 43 minutes of errors.

## Alerts

Defined in `infra/terraform/monitoring/rules.yml` (ADR-0089). Locally, Alertmanager emails them to Mailpit. The
Lightsail VMs run no monitoring stack (no room in 2 GB, ADR-0096): until the owner picks Grafana Cloud or another
service, an uptime check on `<public url>/health/ready` is the page, and `lvn.sh status` on the VM the first look.

| Alert | When | Severity | First look |
| --- | --- | --- | --- |
| `ApiErrorBudgetFastBurn` | 5xx rate above 14.4× the budget over 1 h and 5 min (2 % of the month's budget in an hour) | page | The dashboard's errors by route; the last deploy (`roll-back.md`) |
| `ApiErrorBudgetSlowBurn` | Above 6× over 6 h and 30 min | page | Same |
| `ApiLatencyHigh` | p95 above 300 ms for 15 min | ticket | Slow routes on the dashboard; `pg_stat_statements` top queries |
| `QueueBacklog` | A queue's waiting jobs above 1,000 for 15 min, or growing for 30 min | ticket | `drain-a-queue.md` |
| `JobsFailing` | Failed jobs above 0.5 % over 1 h | ticket | The failed reason (`drain-a-queue.md`) |
| `TargetDown` | The API or worker not scraped for 5 min | page | `docker ps`, or `lvn.sh status` on Lightsail; restart; `roll-back.md` |
| `AiBudget80` | AI spend at 80 % of the month (§10.4, the app's own email) | ticket | AI settings: lower limits or raise the budget |

**Page** means now, day or night. **Ticket** means the next working day.

## Who

Until there is a team: the owner, by email and phone. The owner chooses the address; it is
`ALERT_EMAIL` in `envs/<env>/.env`. One person on call per week once there are two. Hand over with a note of open
alerts.

## When paged

1. Acknowledge (reply to the alert email).
2. Open the SLO dashboard (locally, Grafana at `<public url>/grafana`; its admin password is the Terraform output
   `grafana_admin_password`): errors, latency, queues, last deploy. On Lightsail: `lvn.sh status` and
   `docker compose logs --tail 200 api worker` in `/opt/lvn`.
3. If a deploy in the last hour lines up, roll back (`roll-back.md`), then investigate.
4. Otherwise: database (`restore.md` if data is damaged), Redis (`drain-a-queue.md`), a provider down (AI, mail,
   push: pause its queue).
5. Leak or abuse: `leakage-report.md`, `moderation.md`.
6. Write down what happened in `docs/incidents/` the same day.

## Slow queries

Postgres keeps statistics of every statement (`pg_stat_statements`: preloaded on the local environment and by the Lightsail
stack's Postgres command, `infra/lightsail/compose.yaml`). Once per database:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

The top 20 by total time, then the plan of one:

```sql
SELECT round(total_exec_time) AS total_ms, calls, round(mean_exec_time::numeric, 2) AS mean_ms, left(query, 120)
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
EXPLAIN (ANALYZE, BUFFERS) <the query, with real values>;
```

A sequential scan of a large table, or a sort without an index, wants an index in a migration. `SELECT
pg_stat_statements_reset();` starts a fresh window.

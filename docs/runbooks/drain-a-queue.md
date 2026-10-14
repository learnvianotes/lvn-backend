# Drain a queue

When: a queue's waiting or failed count keeps growing (the DLQ-growth alert, §16.4); a bad job keeps failing; a deploy
needs a queue empty first; a provider (AI, mail, push) is down and jobs should wait rather than fail.

Queues are BullMQ on Redis, named `<context>.<purpose>`: `ai.tasks`, `notes.media`, `notes.search`, `notes.chunks`,
`notes.pdf`, `notes.pdf-parse`, `notes.import`, `users.export`, `users.skills`, `comms.email`, `comms.push`,
`core.engagement`, `core.github`, `core.learning-analytics`, and the `*.maintenance` schedules. Every job is
idempotent (§9.2), so a job run twice does no harm.

## Look

```bash
# Local environment: counts per queue
infra/local-vm/vm.sh ssh 'docker exec lvn-local-redis sh -c "for q in ai.tasks notes.media notes.search comms.email; do echo \$q \$(redis-cli LLEN bull:\$q:wait) waiting \$(redis-cli ZCARD bull:\$q:failed) failed; done"'
# A failed job's reason
infra/local-vm/vm.sh ssh 'docker exec lvn-local-redis redis-cli HGET bull:ai.tasks:<jobId> failedReason'
```

On AWS, the worker's `/metrics` exposes `bullmq_queue_jobs{queue,state}`, and Grafana's queues dashboard shows the
same.

## Act

- **Retry the failed jobs** once the cause is fixed. Retry a queue's failed jobs with BullMQ's `retryJobs` from the
  worker shell: `node -e "new (require('bullmq').Queue)('ai.tasks',{connection:{url:process.env.REDIS_URL}}).retryJobs({state:'failed'})"`.
- **Pause a queue** while a dependency is down, so jobs wait instead of failing: `.pause()` on the same Queue. Resume
  with `.resume()`.
- **Drop a poisoned job** (it fails every time and blocks nothing else, but fills the failed set): `.getJob(id)` then
  `.remove()`. Record its id and reason in the incident log first.
- **Empty a queue** only when its jobs are recomputed anyway: `notes.search` (reindex instead), `core.engagement`
  (the next learning event queues it again). Use `.obliterate({force:true})`. Never empty `comms.email` or
  `users.export`; people are waiting for those.
- **Before a deploy that changes a job's data shape**: pause the queue, deploy, resume. The new worker reads the old
  jobs as the old shape, so a job must accept both for one release.

Redis must keep `maxmemory-policy noeviction` (ADR-0089). If Redis is full, writes fail visibly instead of jobs
vanishing. Fix it by draining or by raising the memory, never by allowing eviction.

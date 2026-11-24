# Runbooks

Required before real users (spec §16.5): restore from backup (`restore.md`), rotate secrets, drain a queue, roll back
a release, take a note offline, respond to a leakage report. Each is written in the phase that introduces the system
it operates (database and queues: Phase 1; notes: Phase 2). Web-only procedures live in lvn-web's `docs/runbooks/`.

- `moderation.md` — the first platform admin, taking a note offline, the moderation word list (Phase 2)
- `restore.md` — restoring Postgres on Lightsail and the local environment, and the restore drill (Phase 9; ADR-0096)
- `rotate-secrets.md` — replacing each generated secret, and what people notice (Phase 9)
- `drain-a-queue.md` — looking at, pausing, retrying and emptying BullMQ queues (Phase 9)
- `roll-back.md` — going back to the previous release (Phase 9)
- `leakage-report.md` — the first hour, day and week after someone saw what they should not (Phase 9)
- `on-call.md` — SLOs, alerts, who answers and what they do (Phase 9)
- `lightsail.md` — beta and production on Lightsail: what runs, the memory budget, what Infra provisions, every GitHub
  secret and variable, the first and every deploy (ADR-0096, ADR-0097). The upload scanner is a second instance:
  `docs/ops/scanner-host.md` (ADR-0102)
- `legacy-content.md` — the seeded study notes in `content/study`, synced when the migrate container runs (ADR-0098)

# Runbooks

Required before real users (spec §16.5): restore from backup (`restore.md`), rotate secrets, drain a queue, roll back
a release, take a note offline, respond to a leakage report. Each is written in the phase that introduces the system
it operates (database and queues: Phase 1; notes: Phase 2). Web-only procedures live in lvn-web's `docs/runbooks/`.

- `moderation.md` — the first platform admin, taking a note offline, the moderation word list (Phase 2)

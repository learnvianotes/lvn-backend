# ADR-0102: Remote upload scanner

- Status: Proposed
- Date: 2026-10-25
- Deciders: Backend agent; owner
- Spec sections: §8.1, §8.2
- Amends: ADR-0041, ADR-0097

## Context

ADR-0041 scans an upload in the worker with clamd, then still serves the file if the scanner fails on the last
attempt. ADR-0097 leaves uploads off until there is room for ClamAV. The beta VM is a 2 GB Lightsail instance
(`lvn-test`, Mumbai) that already runs the API, worker, web, Postgres and Redis. ClamAV's signature database does
not fit beside that stack.

The scan has to move to its own instance. That instance must not be reachable from the public internet, and it must
not hold the database or the R2 credentials.

## Decision

- A separate process, `apps/scanner`, runs on a second 2 GB Lightsail instance in `ap-south-1a` (bundle `small_3_1`),
  the same region as `lvn-test`. Compose on that host runs `clamd` (with freshclam) and the scanner HTTP service.
  Nothing is published on a public port. The process binds the instance's private IP. clamd binds `127.0.0.1` only.
- The worker streams the file body to `POST /v1/scan`. The scanner does not receive a storage URL or any R2
  credential. It answers `clean` (with a PDF page count), `infected`, or `unsafe`.
- Every request, including `/healthz` and `/readyz`, carries an HMAC-SHA256 of a canonical string
  (`LVN-SCAN-1`, timestamp, nonce, body hash, length, mime) made with a shared secret. A timestamp outside the skew
  window or a reused nonce is rejected. The shared format lives in `@lvn-backend/scanner-protocol`.
- `/readyz` answers ready only when clamd responds to PING and the signature database is younger than
  `SCANNER_SIGNATURE_MAX_AGE_HOURS` (48 by default).
- The service caps the body (500 MB), PDF parsing (50 MB), concurrency (1) and its own memory (256 MB, heap 160 MB).
  clamd is capped at 1450 MB. The host has 2 GB of swap.
- `SCAN_MODE` selects the behaviour:
  - `remote`: `completeUpload` and a non-restricted `store` set `scanResult` to `PENDING` before the file can be
    read. The worker calls the service with a timeout, three attempts and a circuit breaker. Any failure throws and
    leaves the file `PENDING`. A `PENDING` file is not served: client reads look like a missing file, and server-side
    reads (`readBytes`, `download`) answer UNAVAILABLE so the caller can retry. `CLEAN` is served. `infected` and
    `unsafe` are quarantined the way ADR-0041 quarantines an infection. The worker does not count PDF pages itself.
  - `local`: today's ADR-0041 path. A scanner error on the last attempt sets `scanResult` to `ERROR` and the file is
    served.
  - `off`: nothing is scanned.
  - Unset: `CLAMAV_URL` means `local`, otherwise `off`.
- Outside development, `SCANNER_URL` must be a private IPv4 address.
- The last failed attempt of the media job is reported to Sentry with `user.id` set to the file owner. There is no
  separate `error_events` table; this is the existing `reportError` path. A sweeper re-queues READY files that are
  still `PENDING` when their job is not already waiting.
- An import that reads a file still `PENDING` is retried. On its last attempt it is marked failed with a clear
  message.
- College ID cards (ADR-0099) do not publish `FileReady` and are not scanned. They stay in the restricted bucket and
  are served only to the admin who reviews them.
- Image, video and audio variants stay on the worker, after a clean verdict. The scanner has no ffmpeg, sharp,
  database client or object-storage credentials.

## Consequences

- Turning uploads on (ADR-0097) now means bringing up the scanner host and setting `SCAN_MODE=remote` on the API and
  the worker, with the same secret. The steps are `docs/ops/scanner-host.md`.
- A scanner outage stops new files from being served. It does not serve them unscanned.
- Local development and the existing media tests keep working with `CLAMAV_URL` and no `SCAN_MODE`.
- The private path between two Lightsail instances in one region is not filtered by the public firewall. The host
  firewall and the process allow-list are what keep other instances in the region out. Docker is on the host network
  so that firewall sees the caller's address.
- Contracts `0.72.0` adds the four scan variables. No GraphQL field changes.

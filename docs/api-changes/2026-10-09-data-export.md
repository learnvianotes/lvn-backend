# Data export (Phase 2, P2g; ADR-0018)

- Date: 2026-10-09
- Package: `@lvn/contracts` unchanged; GraphQL only
- Breaking: no

## GraphQL (users subgraph)

- `requestDataExport: DataExportPayload` — one a day (VALIDATION otherwise); built by apps/worker within minutes;
  the person is emailed (`dataExportReady`) with a link to their account page.
- `myDataExports: [DataExport!]!` — newest five: `status` (PENDING, READY, FAILED, EXPIRED), `requestedAt`, `readyAt`,
  `expiresAt` (7 days), `sizeBytes`, and while READY a `downloadUrl` that works 15 minutes (ask again for another).

## The archive

`README.html`, `manifest.json` (format `lvn-export/1`, counts, every file's size and SHA-256, what was left out),
`notes/<kind>/<slug>-<id>/index.md` (front matter: title, id, kind, visibility, folder, tags, topics, dates, fork credit,
moderation; then Markdown), `note.json` (format `lvn-note/1`: the draft's cards and every version, exactly as stored),
`media/` (originals, up to 300 MB per archive; larger files are listed as omitted), `notes/folders.json`,
`notes/tags.json`, and `data/users/*.json` (account without the password hash, sign-in providers, sessions, college
emails, organisations, consents, verification requests, study profile, plan, old-site import, activity log) and
`data/core/*.json` (study progress, problem marks, reports filed, appeals, moderation of the account).

Stored in the restricted bucket (`FileObject` purpose EXPORT, parent DATA_EXPORT) and deleted after 7 days by the
nightly `expire-exports` job. Every context adds new personal data to its part (`NOTES_DATA_EXPORT`,
`CORE_DATA_EXPORT` facades; `users` its own).

## Data

`users.DataExport`; `FileParentType` gains IMPORT_JOB and DATA_EXPORT; migration `20261009070000_data_exports`.

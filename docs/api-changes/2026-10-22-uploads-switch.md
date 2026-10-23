# Uploads behind a switch (off for the launch)

- Date: 2026-10-22
- Package: `@lvn/contracts` 0.62.0
- Spec: ADR-0097 (§8.1)
- Breaking: no for clients that handle `UNAVAILABLE` (behaviour changes only where uploads are switched off)

## What changes for clients

- **`Query.uploadsEnabled: Boolean!`**, public. Read it once (cache-first). While it is `false`, hide every control that
  uploads a file: media cards and their file pickers, voice notes, quick notes from photos and PDFs, imports, avatars,
  group pictures, resource covers, verification and teaching documents.
- **`createUploadIntent`** answers `userErrors: [{ code: UNAVAILABLE, message: "Uploads are off for now. …" }]` while
  uploads are off, and stores nothing. Show the message if it ever reaches a person.
- Files already stored, data exports and covers the server copies itself are unaffected.
- **`apiConfigSchema`** gains `UPLOADS_ENABLED` (default `false`).

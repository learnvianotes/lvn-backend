# ADR-0097: Uploads switched off for the launch, by configuration

- Status: Accepted (owner decision, 2026-10-22: the rewrite launches on Lightsail without uploads)
- Date: 2026-10-22
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §8.1 (upload flow), §8.2; ADR-0041 (scanning), ADR-0028 (PDF engine)

## Context

The rewrite launches on one 2 GB Lightsail VM per environment (ADR-0096). Uploads bring work that does not fit there
on day one:

- the ClamAV scanner needs about 1.5 GB of memory on its own (ADR-0041);
- the PDF engine (ADR-0028) is a large Python service;
- video transcoding runs ffmpeg in the worker.

Without scanning, people's files would reach other people unchecked. The owner chose to launch with uploads off and
turn them on once the hardware and the scanner are in place.

## Decision

**`UPLOADS_ENABLED`** (api and worker, default `false`). Turning uploads on is setting it to `true` and restarting the
api and worker; nothing else changes.

**What "off" means:**

- `createUploadIntent` answers `UNAVAILABLE` ("Uploads are off for now…") before anything is stored. Every file a
  person sends starts there: pictures, video, audio and PDFs in notes; voice notes; quick notes from photos and PDFs;
  avatars and group pictures; resource covers; note imports; verification and teaching documents.
- **`Query.uploadsEnabled: Boolean!`** (public) tells the clients. The web and the phone hide every upload control while
  it is false (no dead controls), and show what still works.
- Files the server makes or fetches itself are not uploads and carry on: data exports, and a book cover copied from Open
  Library.
- Files already stored stay readable.

**Day one runs without ClamAV and the PDF engine.** With no uploads there is nothing to scan or convert. The worker's
scan and conversion queues stay empty.

**Development and the local environment** (`.env.example`, `infra/terraform/envs/local`) set `UPLOADS_ENABLED=true`, so
the upload features stay tested. The API test suites do the same, and one suite checks the default.

## Turning uploads back on

1. Give the VM room for the scanner, or point `CLAMAV_URL` at a clamd elsewhere. Without it, uploads are not scanned.
2. For PDF conversion, run the PDF engine (`workers/pdf-engine`) beside the worker.
3. Set `UPLOADS_ENABLED=true` in the environment's settings: the GitHub environment variable `LVN_UPLOADS_ENABLED` for
   Lightsail (ADR-0096), or `.env` elsewhere. Then redeploy or restart api and worker.
4. Check R2's CORS rule on the files bucket allows `PUT` from the site's origin (lvn-backend
   `docs/runbooks/lightsail.md`).

## Consequences

- The launch has no user files to scan, store or moderate.
- Features that are only uploads disappear from the screens until then: media cards, voice notes, quick notes from
  photos and PDFs, imports, avatars and document proof. The rest of each screen stays.
- Once ADR-0095's platform settings are merged, the switch can move to `/admin/settings` (its `uploads` section holds
  the scanner's address today). Until then it is configuration.

**Amended by ADR-0099.** College ID verification does not follow `UPLOADS_ENABLED`. Platform admins turn that path on
from the app (`setStudentIdVerificationEnabled`); it is off until they do, and turning it on does not enable general
uploads.

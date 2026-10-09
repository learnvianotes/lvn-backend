# ADR-0041: Media processing after upload — sizes, transcodes, scanning

- Status: Accepted
- Date: 2026-10-09
- Deciders: Backend agent (closing the Phase 2 media scope, P2c-3)
- Spec sections: §8.1 (step 3), §8.2, §9.1 (the `media` queue)

## Context

§8.1 asks for processing after an upload: images in three sizes, video transcoded to H.264 720p, audio normalised,
PDF text extraction, and a malware scan with ClamAV. §8.2 lists the columns it fills (`variants`, `width`, `height`,
`durationMs`, `pageCount`, `checksumSha256`, `scanResult`, `scannedAt`, status `QUARANTINED`) and asks for a nightly
reconciliation of storage against the rows. P2c shipped uploads without any of it.

Constraints:
- Uploads must stay usable at once: a 300 MB video takes minutes to transcode on CPU.
- The backend is TypeScript in one image (API, worker, migrations).
- Copyleft code must not be linked into our code.

## Decision

1. **Processing follows READY; it does not gate it.** `completeUpload` keeps marking the original READY (verified to
   exist, of the declared size and kind) and publishes `FileReady`. The notes context queues `process-file` on
   `notes.media` (jobId `<fileId>.process`), and apps/worker runs one at a time. Cards show the original until the
   variants arrive, then the variants.
2. **Scan first.**
   - The worker streams the file to ClamAV's `clamd` over TCP (`INSTREAM`; `CLAMAV_URL`, e.g. `tcp://clamav:3310`).
   - An infected file is copied to `quarantine/<key>` in the restricted bucket (kept 90 days, §8.2), and the original
     and its variants are deleted. Its row becomes `QUARANTINED` with `scanResult INFECTED`, so it has no read URL
     and its cards show it as unavailable. `FileQuarantined` is published.
   - A scanner error retries; the last attempt leaves `scanResult ERROR` and the file served, and logs it.
   - Without `CLAMAV_URL` (development) nothing is scanned and `scanResult` stays empty.
   - ClamAV (GPL-2.0) runs as its own container and is called over the network, never linked.
3. **Variants**, next to the original as `{env}/{ownerId}/{fileId}/<variant>`:

   | Kind | Variants | Facts |
   | --- | --- | --- |
   | Images | `thumb` 320, `medium` 960 and `large` 1920 pixels wide, WebP, never enlarged, EXIF orientation applied, first frame of a GIF (`sharp`, Apache-2.0) | width and height |
   | Video | `video720` (H.264, at most 720 lines, AAC, fast start) and `poster` (WebP from 1 s in) | duration, width, height (`ffprobe`) |
   | Audio | `audio` (EBU R128 loudness-normalised AAC) | duration |
   | PDFs | — | page count (`pdf-lib`, MIT) and SHA-256 |

   Every file gets its SHA-256. The system `ffmpeg` and `ffprobe` (Debian's packages, with libx264) run as separate
   processes in our server image. The image runs our service and is not distributed, so no copyleft code is linked
   into ours.
4. **PDF text extraction moves to Phase 5.** The PDF engine (ADR-0028) already reads PDFs for conversion; text for
   search and AI comes from it when Ask AI needs it.
5. **Reading.** `MediaFile` gains signed URLs for the variants: `thumbUrl`, `mediumUrl`, `largeUrl`, `posterUrl`,
   `playbackUrl` (the 720p video or the normalised audio), and `pageCount`. Each is null until made. The web shows
   images through `srcset` and plays the transcode when it exists.
6. **Reconciliation.** A nightly `reconcile` job compares the files bucket's objects with the rows. It logs objects
   without a row and READY rows without an object, and deletes nothing. Drift is for a person to look at.
7. **Not now.**
   - Same-owner deduplication by SHA-256 (§8.2) waits for storage cost to matter.
   - HLS waits for long videos; 720p MP4 with fast start streams by ranges.
   - The phone keeps placeholders for pictures, video and audio for now (PDFs open in the reader).

## Consequences

- People never wait for processing to use what they uploaded, and see better files a moment later.
- The backend image grows by ffmpeg, about 200 MB. The local environment runs a ClamAV container: about 1.5 GB of
  memory once its signatures load. The local VM goes to 8 GB.
- A file found infected after someone saw it is removed then; the scan is minutes, not a gate.

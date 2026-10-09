# Media processing (Phase 2, P2c-3)

- Date: 2026-10-09
- Package: `@lvn/contracts` 0.18.0 (event `FileQuarantined`, config `CLAMAV_URL`)
- Spec: §8.1, §8.2, §9.1; ADR-0041
- Breaking: no

## What changes for clients

`MediaFile` gains fields. Each is null until processing makes it, usually seconds after the upload (minutes for a long
video):

| Field | What |
| --- | --- |
| `thumbUrl`, `mediumUrl`, `largeUrl` | pictures 320, 960 and 1920 pixels wide, WebP, never enlarged |
| `posterUrl` | a frame of a video, WebP |
| `playbackUrl` | the 720p H.264 transcode of a video, or the loudness-normalised audio |
| `pageCount` | pages of a PDF |
| `width`, `height`, `durationMs` | now filled in |

How clients should use them:
- The original `url` stays as it was.
- Show the sizes in `srcset`.
- Play `playbackUrl` when present, with `posterUrl` as the poster.
- An upload ClamAV finds infected is quarantined: its cards get `media: null`, as for a deleted file.

## Behind it

- `completeUpload` still marks the original READY. `FileReady` queues `process-file` on `notes.media`.
- apps/worker scans the file (clamd over TCP, `CLAMAV_URL`), then makes the variants next to the original: `sharp`
  for pictures, the system `ffmpeg`/`ffprobe` for video and audio, `pdf-lib` for page counts. It records SHA-256,
  size, length and pages.
- Infected files are copied to `quarantine/` in the restricted bucket, and their objects are removed.
- A damaged file is retried, then left served as uploaded.
- A nightly `reconcile` (03:40 UTC) reports drift between storage and rows.
- The backend image now includes ffmpeg.
- The local environment runs ClamAV 1.5.4 and needs 8 GB.

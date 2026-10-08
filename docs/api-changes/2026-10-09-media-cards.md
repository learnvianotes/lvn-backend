# Media cards: pictures, video, audio and files on notes (Phase 2, P2c-2)

- Date: 2026-10-09
- Package: `@lvn/contracts` unchanged (0.15.0); GraphQL only
- Spec: §4.1, §4.4, §8.1, §8.2; ADR-0010 (forks)
- Breaking: no (additions; media cards were refused before)

## What and why

Image, video, audio and file cards now work. Files are uploaded to a note, media cards of that note show them, and
everyone who can read the note gets a short-lived read URL. A card cannot show a file of another note, so a card is
never a way into someone else's files.

## Upload (unchanged flow, §8.1)

`createUploadIntent` accepts `purpose: ATTACHMENT` with `parentId` = a note the uploader can edit (its owner or a share
editor). Accepted types and limits:

| Kind | Types | Limit |
| --- | --- | --- |
| Pictures | image/jpeg, image/png, image/webp, image/gif | 20 MB |
| Video | video/mp4, video/webm, video/quicktime | 500 MB |
| Audio | audio/mpeg, audio/mp4, audio/ogg, audio/wav, audio/webm | 100 MB |
| Documents | application/pdf | 50 MB |

Files count against the uploader's storage (5 GB student, 20 GB teacher). 300 uploads an hour. `completeUpload` checks
the bytes as before; browser recordings (audio/webm) and .m4a files with an MP4 brand are accepted as what they are.

## Cards

Content is `{ fileId, caption? }` (`alt` too for images), as in `CARD_CONTENT`. `updateNoteDraft` accepts a media card
when its file is linked to the note, READY, and of the card's kind (an image card shows a picture, a file card any
attachment); otherwise VALIDATION at `input.ops.N.content.fileId`. `createNote` still refuses media cards: upload to the
note first.

`Card.media: MediaFile { id, url, expiresAt, mimeType, fileName, sizeBytes, width, height, durationMs }` — null for
other cards or a file that is gone. The URL works for 15 minutes; load the card again for a new one. Version cards
(history, previews) resolve media the same way.

## Copies and deletion

`forkNote` links the files the copied cards show to the copy, so it keeps working when the origin changes or is
deleted. A file is deleted (bytes removed, row kept as DELETED) once no note links to it: right after
`deleteNoteForever`, and nightly after the trash is emptied.

## Data

New table `notes.NoteAttachment (noteId, fileId)`, migration `20261009020000_note_attachments`.

## Not yet

Image sizes, video/audio transcoding and the malware scan (§8.1 processing) come with the media processing slice;
until then files are served as uploaded.

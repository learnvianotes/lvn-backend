# Transcription and quick notes (P5e)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.37.0
- Spec: §10.1, §13; ADR-0062
- Breaking: no

## What changes for clients

- **`AiTask` gains `TRANSCRIBE` and `QUICK_NOTE`.** Both are card tasks: `runAiTask`, then `aiArtifact` until READY, then
  `keepAiCards`, as in ADR-0059.
  - **TRANSCRIBE**, with `cardIds: [audioOrVideoCardId]` (it may be left out when the note has one recording): the
    result is one text card holding what is said, titled "Transcript — <note>". `truncated` is set past 30 minutes.
    Readers transcribe for themselves; keeping into the note is for its editors.
  - **QUICK_NOTE**, on a note the person may edit (FORBIDDEN otherwise): it reads the note's words and up to four of its
    photos, and the result is a structured note (headings and text).
  - VALIDATION when there is no recording, or nothing to read.
- **Recording:** voice notes are ordinary audio cards: `createUploadIntent` (ATTACHMENT, `audio/webm` from browsers,
  `audio/mp4` from phones), `completeUpload`, then an `audio` card.

## What clients should do

- **Record:** web with MediaRecorder; phone with expo-audio (the microphone permission ships in a new build).
- **On a recording card, offer "Transcribe".** A voice note made from the phone's Create sheet starts it once the card
  is saved.
- **On one's own note, offer "Tidy into notes"** (QUICK_NOTE), and start it from the Create sheet's Quick note and
  Photo.

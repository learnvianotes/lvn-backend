# Voice notes and live captions

## What was wrong

Transcription always sent a WAV through the chat API as `input_audio`. Whisper and `*-transcribe` models were classified as supporting nothing, because the app never called `POST /audio/transcriptions`, so the Admin Transcribe picker hid them. The task then fell through to the default chat model (GPT, Claude, and the rest), which cannot hear, and every transcription failed.

`generate({ task: 'TRANSCRIBE' })` is unchanged: a chat model that cannot hear still fails with "The AI chosen here cannot hear recordings." Recordings now go through `transcribeBytes`, which picks a model that can hear.

## What to call

Live captions stay on the device. `voiceCapture(input: { noteId })` describes that and returns `userErrors`:

- `api`: `SpeechRecognition` (use `webkitSpeechRecognition` where that is the name the browser exposes)
- `interimResults`: true
- `continuous`: true
- `languages`: `en-US`, `en-IN`, `hi-IN`, `te-IN`
- `streamingFallback`: `transcribeCaptionClip`

When the browser recognised speech, call `transcribeCaptionClip(input: { noteId, captions })`. The text is not stored. When it could not, upload a short clip and call `transcribeCaptionClip(input: { noteId, fileId })`.

A full recording is an upload:

1. `createUploadIntent` with `purpose: VOICE_NOTE` (or `ATTACHMENT` for audio on a note). Pass `parentId` when the recording belongs to a note.
2. PUT the bytes, then `completeUpload`. When `SCAN_MODE` is remote, the file stays unscanned-and-unserved until the scanner finishes. Storage still counts against `STORAGE_BYTES`.
3. `transcribeAudio(input: { noteId, fileId })`.

`makeNotesFromTranscript(input: { noteId, transcript })` writes a private note: a summary card, then a heading and text for each section. The transcript is cut at 20,000 characters. `fileId` is used when `transcript` and `captions` are empty. The task is `NOTES_FROM_TRANSCRIPT` (a chat route, not an `AiTask` value). Every voice payload includes `userErrors`.

## Which model

Admin → AI → Transcribe. The list is models that can hear:

- Whisper and `*-transcribe` are sent to `POST /audio/transcriptions` (OpenAI and any OpenAI-compatible server that implements it).
- `gpt-audio`, Gemini and Gemma take the WAV on the chat call.

Realtime and live models stay off that list. If the Transcribe route names a model that cannot hear, the call stops and names that model instead of trying another. If the chosen model needs the transcriptions API and the provider has no such call (Claude, Ollama), the error says so.

# ADR-0062: Voice notes, transcription and quick notes, on the local model

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P5e)
- Spec sections: §5 (uploads), §9.1, §10.1, §13 (mobile), §18 (Phase 5); ADR-0041, ADR-0058, ADR-0059

## Context

Phase 5 owes three things:
- **Voice notes.** Recording, carried as a gap since Phase 3: the web and the phone play recordings, but nothing
  records. The microphone is off by configuration on both: the web's `Permissions-Policy`, and the phone's expo-audio
  plugin.
- **Transcription** of voice notes and of audio and video cards. §3 names "Whisper (API or self-hosted) behind the
  gateway"; the phase plan asks for gemma4's audio input or a Whisper worker, preferring one model if it is good
  enough.
- **Quick notes:** rough text or a photo becomes a structured note.

§13 says a transcript "returns as a `NoteArtifact`; the user accepts or edits before it becomes a card".

The measurement, on the dev machine:
- **Clip:** the Open Speech Repository's American English list 1, ten Harvard sentences, 33.6 s, 8 kHz.
- **Input:** sent to gemma4 through Ollama's chat API as one 16 kHz mono WAV in the message's `images`.
- **Result:** the transcript came back in 14.9 s, word for word apart from "pug" for "parked" and "glued" for
  "Glue".

A second model (Whisper) would need its own service, its own memory on the one 16 GB GPU, and its own operations.

## Decision

1. **Transcription is gemma4's.** No Whisper service.
   - `TRANSCRIBE` is a new AI task on one audio or video card of a note the person can read. It runs on the AI lane like
     the others (ADR-0059).
   - The worker fetches the file through a new `FILES.download`. ffmpeg cuts the sound into 30-second pieces of 16 kHz
     mono WAV, which the model transcribes in order with a versioned `transcribe` prompt ("in the language spoken").
   - At most 30 minutes are transcribed. A longer recording's transcript says it was cut.
   - The tokens count against the person's day.
2. **A transcript is cards to keep**, as a card task:
   - Its result is one text card holding the transcript, previewed and kept in one tap: into the note for its editors,
     or as a new private note.
   - Kept, it is an ordinary text card: the person edits it there, and search and Ask AI read it.
   - The audio card itself is not changed.
3. **Voice notes are audio cards.**
   - Recording: the web with `MediaRecorder` (Opus in WebM; the `Permissions-Policy` allows the microphone for the
     site itself); the phone with expo-audio (AAC in M4A; the microphone permission is declared, so a new native
     build).
   - The recording is uploaded like any audio card (`ATTACHMENT`, normalised by ADR-0041's media processing).
   - A voice note started from the phone's Create sheet is a new note holding the recording; its transcription is
     queued once the card is saved, so the person finds the transcript waiting to be kept.
4. **Quick notes.** `QUICK_NOTE` is a new card task on the person's own note.
   - The model reads its text and up to four of its photos (the gateway's images, from the pictures' medium size). It
     writes a structured note: a title and sections, as CREATE_NOTES does.
   - The person keeps the result into the note or as a new note.
   - The phone's Create sheet "Quick note" and "Photo" start one: a note with the rough text or the photo, then the
     task.
   - It is not a derivative task: it works on the person's own words and pictures.

## Consequences

- Hindi and Telugu speech go to the same model. Its accuracy there is unmeasured and waits for the owner's evaluation
  recordings, like the PDF engine's Telugu (ADR-0028).
- A long lecture recording ties up the GPU lane: 30 minutes is about 60 calls, roughly 15 minutes of GPU time.
  Shorter waits come from a bigger GPU or a hosted model with a zero-retention agreement.
- The phone needs a new native build for the microphone. Store builds will ask people for it the first time they
  record.

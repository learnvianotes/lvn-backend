# AI reads a note's photos, PDFs and recordings

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.56.0 (unchanged)
- Spec: ADR-0085
- Breaking: no

## What changes for clients

- **`runAiTask`**: every task but Explain code, Clean up and Transcribe now reads the note's photos, the words of its
  PDFs and the viewer's transcripts of its recordings, with its words. A note of only photos or PDFs no longer fails
  with "This note has nothing to work on yet". That message now reads "This note has nothing to work on yet: write
  something, or add photos, PDFs or a recording."
- **A note of only recordings without a transcript** is refused with "Transcribe the recording first: AI tasks work on
  what it says." Clients can offer Transcribe beside it.
- **`askAi(scope: THIS_NOTE)`** answers from the note's photos, PDFs and transcripts too.
- **A failed task** whose note had only photos, PDFs or recordings that could not be read ends with "Nothing in this
  note's photos, PDFs or recordings could be read. A scanned PDF becomes notes with Convert PDF."
- **The first task on a note with photos takes longer**: each photo is read once, and later tasks reuse the reading.

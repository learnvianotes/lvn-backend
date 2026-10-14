# ADR-0085: AI reads a note's photos, PDFs and recordings

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §15 (AI); amends ADR-0059, ADR-0062, ADR-0084

## Context

The owner made a note from two photos (ADR-0084), then asked Translate and the other AI tools about it. Every one said
"This note has nothing to work on yet". Only Transcribe worked, on a voice note.

The tasks read a note's typed words and nothing else. The quick note's result waits to be kept, so a note of photos,
PDFs or a recording has no words of its own. The owner: "it needs to use the context from the notes, pdfs, or even
photos".

## Decision

- **Every task and Ask AI read what the note holds, in the cards' order:**
  - its words;
  - what up to 10 photos say;
  - the words of up to 10 PDFs;
  - the asker's transcript of each recording.

  The tasks are Summarize, Translate, Flashcards, Quiz, Explain, Find mistakes, Revision sheet, Create notes and the
  quick note. Explain code still reads code, Clean up still mends typed words, and Transcribe still hears one recording.
- **A photo is read on its own** with the page-reading model and prompt (`READ_PAGE`, `read-page`, ADR-0063). The
  reading is labelled "Photo n:".
  - It is kept in Redis by file for 30 days (`ai:photo-text:<fileId>`), so the note's next task does not read it
    again.
  - The quick note still sends up to four photos with its request (ADR-0084).
  - Reading counts against the asker's allowance, as their work.
- **A PDF's words** come from its text layer (ADR-0084), labelled "PDF n:". A scanned PDF adds nothing.
- **A recording is read from the asker's newest ready transcript**, labelled "Recording n:". A note of only recordings
  with no transcript is refused before anything is queued: "Transcribe the recording first: AI tasks work on what it
  says."
- **Nothing is read twice.** A quick note now records the photos and PDFs it read (`options.read`). A result kept into
  the note itself records that (`options.keptInNote`). From then on those photos, PDFs and recordings are read through
  the words that were kept, not again.
- **Order and limit:** the note's words come first, in the cards' order, and everything is cut at the task's limit
  (24,000 characters) as before.

## Consequences

- A note of photos or a voice note works with every AI tool, and Ask AI answers from its photos.
- **The first task on a note with many photos takes longer**, about 1–2 seconds a photo on the local model. Later tasks
  are as quick as before.
- A reading kept in Redis outlives a deleted photo by at most 30 days. It is only ever read for a note that holds that
  file.
- Results kept before this change did not record what they read, so their photos are read again with their words.

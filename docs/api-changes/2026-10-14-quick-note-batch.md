# Quick notes from up to ten photos and PDFs

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.56.0
- Spec: ADR-0084
- Breaking: no

## What changes for clients

- **`QuickNoteLimits`** (contracts, domain):
  - `files`: 10, the most photos and PDFs one quick note reads;
  - `pdfBytes`: 20 MB, the largest PDF the apps add to one;
  - `pictureSide`: 2,048, the longest side a picture is resized to on the device before upload (JPEG).
- **`runAiTask(input: { task: QUICK_NOTE })`** now reads:
  - up to ten image cards, not four. With five or more, each is read on its own first, so the task takes longer;
  - the words of the note's PDF file cards. A scanned PDF adds nothing.

  When nothing in the note could be read, the artifact fails with "Nothing in these photos or files could be read. A
  scanned PDF becomes notes with Convert PDF."
- **Uploads:** declare `sizeBytes` as the exact bytes sent. Storage refuses a PUT of any other length, so a compressed
  picture must be declared at its compressed size.

## Client work

- Phone: Photo opens a tray (camera again and again, photo library with several at once, files). It holds up to 10
  items, compresses pictures, refuses PDFs over 20 MB, then makes notes.
- Web: "Notes from photos and PDFs" on Notes, the same tray as a dialog.

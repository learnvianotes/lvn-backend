# ADR-0084: Quick notes from many photos and PDFs

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §13.1 (create), §15 (AI); amends ADR-0062

## Context

The owner asked for a flow in which a person adds as many photos and files as they want, up to ten, with sizes kept in
check, and AI then makes notes from all of them together.

Until now a quick note (ADR-0062) read the note's words and at most four photos, sent with one request. The phone's
Photo action took one camera photo, and nothing read a PDF's words. A file over the size that was signed into its
upload URL was refused by storage (the phone fix of 2026-10-14 declares the bytes it sends).

The local model (gemma4 on Ollama) has a 4,096-token context by default. A photo at 1,280 pixels takes about 540 of
those tokens (measured), so ten photos cannot go with one request.

## Decision

- **Limits, in contracts (`QuickNoteLimits`):**
  - at most **10** photos and PDFs together in one quick note;
  - the apps add a PDF of at most **20 MB** to one;
  - pictures are made smaller on the device first: at most **2,048 pixels** on the longer side, as JPEG.

  The server's own upload limits (`UploadLimits`) are unchanged and still enforced.
- **The server reads (QUICK_NOTE):**
  - the note's words, in the cards' order;
  - up to `MAX_IMAGES` (10) photos. Up to `IMAGES_TOGETHER` (4) are sent with the request as before. When there are
    more, each is first read on its own with the `read-page` prompt (as a PDF page is read, ADR-0063) and written in
    as "Photo n:", so ten fit a small context;
  - the words of up to `MAX_PDFS` (10) PDF file cards, up to 60 pages each, taken from the PDF's text layer with
    pdf.js (`unpdf`), and written in as "PDF n:".

  A scanned PDF has no words to read and is left out (Convert PDF reads scans). When nothing could be read at all, the
  task fails with words that say so. Every call is the person's AI use, against their allowance. The `quick-note`
  prompt (version 2) asks for one note that brings what belongs together across photos and PDFs.
- **The phone:** Photo opens a tray to fill before anything is sent:
  - the camera, again and again;
  - the photo library, several at once;
  - files: pictures and PDFs.

  Each picture is resized and compressed as it is added, and each item shows its size. A PDF over the limit is refused
  with its size. Make notes creates the note, uploads each item with progress, adds the cards, and runs QUICK_NOTE over
  them all.
- **The web:** Notes has "Notes from photos and PDFs", the same tray as a dialog. It takes files chosen or dropped, and
  compresses pictures in the browser (canvas, JPEG).

## Consequences

- **Many photos take longer.** Ten photos make eleven model calls, about one to three minutes on the local model. The
  task runs in the worker and the person waits on its progress page as before.
- **No API shape changes.** The limits are new constants in contracts (0.56.0), and the server reads more than it did.
- **A PDF's pictures and scanned pages are not read** by a quick note. Convert PDF remains the way to read them.
- **Audio and video in a tray are not offered.** A recording has its own Voice note and Transcribe.

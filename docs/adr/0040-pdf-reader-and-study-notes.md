# ADR-0040: A PDF reader for making notes

- Status: Accepted
- Date: 2026-10-09
- Deciders: Owner (request of 2026-10-09: "a pdf reader where i can have a pdf reading with proper notes making as
  well"); backend, web and mobile agents
- Spec sections: §4.1, §4.4, §8, §12, §13, §18 (Phase 2). Amends ADR-0025 and ADR-0028 (one anchor shape for
  hand-made and converted cards; the engine's review screen is this reader).

## Context

Students read PDFs — textbooks, slides, papers, old question papers — and make notes from them. ADR-0025 lets any PDF a
user can open become an editable note through the PDF engine (ADR-0028). Converting is not the same as studying,
though. Most students read page by page and pick out what matters. The owner asked for a PDF reader with proper
note making.

What study readers do (research, 2026-10-09):

- LiquidText and MarginNote put the document and the notes side by side. A note made from a passage keeps a link back
  to it, and reviewers single that link out.
- Zotero 7's reader has:
  - highlights in colours, with comments;
  - area (image) annotations;
  - notes that cite the page they came from.
- Getting annotations out is a common complaint (LiquidText: no selective export).

Engines compared:

- **pdf.js** (`pdfjs-dist`, Apache-2.0, Mozilla). It ships in Firefox and releases monthly: 6.3.289 on 2026-08-29,
  6.4.299 on 2026-10-03. Its viewer is virtualised, with a text layer for selection and find, and it loads big files
  by range requests. Highlights that snap to a selection are ours to draw: selection rectangles turned into page
  coordinates.
- **EmbedPDF** (MIT, PDFium in WebAssembly, 2.15). It has more annotation tools, but it is built around writing
  annotations into the PDF.
- **react-pdf-highlighter-extended** (MIT). Last released 2024-07.
- **react-native-pdf** 7 (native). It cannot select text on Android.

We do not write annotations into the PDF. The file stays exactly as uploaded, and what the student makes is
LearnViaNotes data: it is searchable, synced, exported and shared under the note's rules.

## Decision

1. **The reader opens a PDF next to its note.**
   - Any PDF in a file card of a note the viewer can read opens in the reader. The PDF is on one side and the note's
     cards are on the other; on phones the cards are in a sheet.
   - Web route: `/notes/[id]/read/[fileId]`.
   - Reading a new PDF makes a new private note that holds the PDF in a file card, opened in the reader.
   - The reader has page navigation, zoom, find in the PDF and the PDF's outline.
   - The last page read is kept per device, not on the server.
2. **Cards remember where they came from.** Any card's content may carry an `anchor`:
   - **Shape:** `{ fileId, page, rects?, quote? }`, where rects are `[x0, y0, x1, y1]` fractions of the page from its
     top left.
   - **Validation:** `cardAnchorSchema` in `@lvn/contracts/validation`. The anchor's file must be attached to the
     note, like a media card's file.
   - **Making cards:** a selection becomes a quote card with the passage. A snipped area becomes an image card with
     the crop.
   - **Going back:** a card's page chip scrolls the PDF to the page and flashes the passage.
   - **Where it lives:** anchors are part of card content, so versions, sync, copies, export and import carry them
     with no new table.
   - **Converted cards:** the PDF engine (ADR-0028, stage 5) writes the same anchor on the cards it makes, with the
     source page and box. One shape serves both.
3. **Highlights are the note's working marks.** `NoteHighlight` (schema `notes`) stores:
   - a passage (TEXT) or an area (AREA) of one page;
   - a colour: yellow, green, blue, pink or purple;
   - the quoted text, an optional comment, and the card made from it.

   At most 5,000 per note. Rules:
   - The owner and editors see and change them, as they see the draft. Readers do not; they see the published cards
     and their anchors. So a comment never reaches the public without passing the moderation gate (ADR-0037).
   - Highlights are not versioned, and copies (`forkNote`) do not take them.
   - They are in the data export (note.json, and a Highlights section in the Markdown), and importing an LVN export
     restores them.
4. **Studying someone else's PDF uses the fork rule** of ADR-0025 (`file.convertToNote`).
   - `studyPdf` makes a private note of the viewer's own, with the PDF in a file card and the credit line of a copy.
   - The file is linked, not duplicated (§4.4: copies keep working).
   - Converting with the engine (P2h-2) is the same request with conversion turned on, counted against
     `PDF_PAGES_MONTHLY`. Studying alone costs no pages.
5. **The PDF is read through a fresh link.**
   - `noteFile(noteId, fileId)` returns a read URL, valid for an hour, for a file the viewer may see in that note:
     - editors: any file attached to the note;
     - readers: a file shown by, or anchored in, the published cards.
   - pdf.js loads it by range requests, so a large file opens at its first page. The storage CORS rule exposes
     `Accept-Ranges`, `Content-Range` and `Content-Length`.
6. **Engines.**
   - **Web:** `pdfjs-dist` 6.3.289, using its `PDFViewer` with our highlight layer above the text layer.
   - **Phone:** the same pdf.js in an Expo DOM component, as ADR-0039 does for Tiptap. Text is selected with the
     system's long press.

## Consequences

- One anchor shape for hand-made and converted cards. Reviewing a conversion (P2h-2) happens in this reader.
- Highlights on the phone need a connection for now, because they are not in the offline store. Cards made from a PDF
  on the phone are offline like any other card.
- Some PDFs have fonts without Unicode maps, which is common in Hindi and Telugu PDFs. Passages copied from them come
  out garbled. Area snips work on any page, and the engine's OCR (P2h-2) gives the real text.
- PDFs stay at the §8.1 limit of 50 MB.
- pdf.js in a web view is slower than a native renderer on low-end phones. It is measured on a mid-range phone before
  release.

## Sources

- pdf.js releases: <https://github.com/mozilla/pdf.js/releases>; npm `pdfjs-dist` versions checked 2026-10-09.
- Selection to page coordinates with pdf.js (`convertToPdfPoint`):
  <https://www.nutrient.io/blog/pdfjs-text-highlight-annotations/>.
- EmbedPDF annotation plugin: <https://www.embedpdf.com/docs/snippet/plugins/plugin-annotation>.
- react-pdf-highlighter-extended: <https://github.com/DanielArnould/react-pdf-highlighter-extended>.
- LiquidText features and reviews: <https://apps.apple.com/us/app/liquidtext-pdf-document-reader-annotate-excerpt/id922765270>,
  <https://softwarefinder.com/legal/liquidtext/reviews?page=2>, <https://talk.macpowerusers.com/t/highlights-v-marginnote-v-liquidtext-v/17287>.
- MarginNote and LiquidText in practice: <https://forum.eastgate.com/t/marginnote-and-liquidtext/680>.

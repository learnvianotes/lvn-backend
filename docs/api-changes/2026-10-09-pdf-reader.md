# The PDF reader (Phase 2, P2h-1)

- Date: 2026-10-09
- Package: `@lvn/contracts` 0.17.0 (run `contracts:sync` in lvn-web and lvn-mobile)
- Spec: §4.1, §4.4, §8; ADR-0040
- Breaking: no

## Cards remember their page

Any card's content may carry an `anchor`. It records where the card came from in a PDF attached to its note:

```ts
anchor?: { fileId: string; page: number; rects?: [x0, y0, x1, y1][]; quote?: string }
```

- Rectangles are fractions of the page's width and height, measured from the page's top left.
- Validation lives in `@lvn/contracts/validation`:
  - `cardAnchorSchema` and `pageRectSchema`;
  - `cardAnchor(content)` reads a card's anchor;
  - `CARD_LIMITS.anchorRects` (100), `anchorQuote` (5,000) and `anchorPage`.

Saving rules:

- A save of a card with an anchor (`updateNoteDraft`, `syncPush`) needs the anchor's file to be a PDF linked to the
  note. Otherwise it fails with VALIDATION at `…content.anchor.fileId`.
- `createNote` refuses anchors ("Add cards from a PDF once the note exists"), as it refuses media cards.

**Editors must keep `anchor` when they rewrite a card's content.** A save that leaves it out removes it.

Anchors travel with the card content: versions, copies (the copy also links the PDF), sync, export and import keep them.

## Highlights

`Note.highlights(fileId)` returns `[PdfHighlight]` in page order.

- Only the owner and editors see highlights. Readers get an empty list.
- Each highlight has `kind` TEXT or AREA, a `color` (YELLOW, GREEN, BLUE, PINK or PURPLE), `rects`, and optional
  `quote`, `comment` and `cardId` (the card made from it).

Mutations (owner and editors; `HIGHLIGHT_LIMITS`: 5,000 per note, comments up to 2,000 characters):

- `addPdfHighlight`. An AREA is exactly one rectangle; TEXT takes up to 100.
- `updatePdfHighlight` changes the colour, the comment (an empty comment removes it) and `cardId` (`null` unlinks it).
- `removePdfHighlight`.

Errors:

- Readers get FORBIDDEN. This is an error of the request, as for other edits.
- People who cannot see the note get NOT_FOUND.

Highlights are deleted with their note.

## Reading links and studying a PDF

- `noteFile(noteId, fileId)`: a `MediaFile` whose URL works for an hour.
  - Owner and editors: any file attached to the note.
  - Readers: a file the published cards show or anchor into.
  - Anyone else gets null.

  Storage CORS exposes `Accept-Ranges` and `Content-Range`, so pdf.js can load by range requests. It also allows GET
  from any origin: the phone's reader runs in a web view without one, and a read URL is the permission itself.
- `studyPdf({ noteId, fileId })`: a new PRIVATE note of the viewer's own. Its title comes from the file name, and it
  has one file card with the PDF (linked, not copied).
  - It follows the fork rule (`file.convertToNote`): FORBIDDEN when copies are off.
  - When the note was someone else's, the new note carries the same `forkedFrom` credit as a copy.

## Export and import

- `note.json` gains:
  - `highlights` (with `media`, the archive path of their PDF);
  - `anchorMedia` on draft cards.
- `index.md` ends a card made from a PDF with "_From page N of [file](media/…#page=N)_". It also gains a
  `## Highlights` section.
- Importing an LVN export:
  - stores each file once per note;
  - points anchors and highlights at the new file;
  - links highlights to their new cards.

  Anchors and highlights whose PDF is not in the archive are left out (anchors) or reported (highlights).

## Database

`notes.NoteHighlight` (migration `20261009090000_note_highlights`) references `NoteAttachment(noteId, fileId)`, with
cascade delete.

# Converting PDFs into notes (Phase 2, P2h-2)

- Date: 2026-10-09
- Package: `@lvn/contracts` unchanged; GraphQL only
- Spec: §8.1, §9.1; ADR-0025, ADR-0028, ADR-0040
- Breaking: no

## Asking

`convertPdfToNote({ noteId, fileId })` returns a `PdfConversion`.

- It takes a PDF of a note the viewer can read, under the rule for copies (`file.convertToNote`, as `studyPdf`):
  - copies turned off: FORBIDDEN;
  - not visible: NOT_FOUND;
  - not a PDF: VALIDATION.
- It makes a new PRIVATE note of the viewer's own at once: the PDF in a file card, titled after the file, with the
  credit line of a copy.
- One conversion per person at a time: CONFLICT while another runs. At most 20 a day.

## Following it

`pdfConversion(id)` gives the status and its progress (0–100):

| Status | Meaning | Progress |
| --- | --- | --- |
| `TRIAGE` | counting pages | 5 |
| `PARSING` | the engine reads layout, tables, pictures and scanned pages, about 3 s a page | 15 |
| `MAPPING` | making cards | 85 |
| `DONE` | the cards are in `note` | 100 |
| `FAILED` | `error` says why, in words for people | — |

Other fields: `pages`, `scannedPages` (read with OCR), `cards`.

- Only the person who asked sees a conversion.
- `Note.pdfConversion` is the latest one filling a note, for that person.
- `pdfPagesThisMonth { used limit }`: pages converted this calendar month (UTC), with `limit` null when unlimited.

Reasons a conversion fails:

- more than 300 pages;
- more pages than are left this month (`PDF_PAGES_MONTHLY`, ADR-0024);
- a password-protected PDF;
- the engine could not read it;
- no answer within 2 hours.

Failed conversions do not count against the month.

## What the cards are

Every card carries an `anchor` (ADR-0040): the page and boxes it came from.

- Headings get levels from their numbering.
- Paragraphs and lists become text cards.
- Tables become table cards.
- Pictures become image cards with their caption; the pictures are files of the new note.
- Code becomes code cards; formulas become Markdown cards.

Review the cards beside the PDF in the reader (`/notes/<note>/read/<file>`).

## Behind it

- Prisma: `notes.PdfConversion` (migration `20261009100000_pdf_conversions`).
- Queues: `notes.pdf-parse` (the Python engine, `workers/pdf-engine`) and `notes.pdf` (apps/worker), with an
  hourly `expire-stuck`.
- The engine's output is cached by SHA-256 in the restricted bucket under `pdf-engine/`.

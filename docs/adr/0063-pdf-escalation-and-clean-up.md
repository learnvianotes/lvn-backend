# ADR-0063: PDF pages read again by the vision model, and AI clean-up of converted notes

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P5f)
- Spec sections: §10.1, §18 (Phase 5); ADR-0025, ADR-0028, ADR-0040, ADR-0058, ADR-0059

## Context

ADR-0028 left two stages of PDF conversion to Phase 5.

**Stage 4, escalation:**
- Pages with low OCR confidence, handwriting, maths or broken tables go to a vision model through the gateway.
- The model gets a verbatim-transcription prompt and a strict schema matching our card types.
- Results that disagree sharply with the OCR are rejected.
- At most about 15 % of a document's pages escalate.
- Only the page image is sent, never who the person is.

ADR-0028 sets no threshold for "low confidence" and no measure of "sharp disagreement"; its implementation note says
low-confidence flags wait for this stage.

**Stage 6, clean-up:** optional AI clean-up of a converted note, started by the person, text only, counted against
their AI allowance (ADR-0025).

What Docling 2.135 gives per page: a `ConfidenceReport` with layout, OCR, parse and table scores, keyed by the
document's 1-based page numbers. It grades a page from its lowest score: below 0.5 "poor", below 0.8 "fair". Formula
regions are labelled `formula`. The engine's fixtures grade "good": 0.867 for the digital chapter, 0.852 for the scan.

gemma4 reads page images (ADR-0058). It read a photo of rough notes into a structured note in ADR-0062's live test.

## Decision

1. **Which pages: the engine decides.**
   - A page is unsure when Docling's lowest page score is below **0.8** ("fair" or "poor"), or when it holds a
     formula region.
   - Handwriting is not detected on its own; it shows as low OCR and layout scores.
   - The unsure pages are read again least sure first, at most **15 % of the pages** (rounded down), and at least one
     when any is unsure.
   - The engine renders those pages as PNGs (pypdfium2, 144 dpi) beside the document (`pages/<n>.png`) and lists them
     in its `map` answer as `{page, reason, score, key}`. Its cache keeps them, as it keeps the document.
2. **Reading them again: the notes context, through the gateway.** The map step sends each listed page image to a new
   `PAGE_VISION` facade, answered by `ai`. That runs the versioned `read-page` prompt:
   - Transcribe exactly what is on the page, in reading order, in its own language.
   - Formulas in LaTeX; never complete, correct or explain anything.

   The answer must match a strict schema of blocks that map onto our card types: heading, paragraph, list, formula,
   table and code.
   - **Whose work:** the platform's (no one's allowance; the monthly budget breaker applies). The page is the
     person's, so it is private material under the data-processing flag.
   - **A new reading** replaces the OCR's cards of that page with cards made from the blocks, at the place of the first
     of them. They keep the page's anchor, so the reader still finds them. The page's pictures stay where they were:
     the model only transcribes.
   - Lists become Markdown cards, numbered by the card; formulas become display maths in a Markdown card, as the
     converter writes them; a table's short rows are filled out to its width. Blocks that fail their card's schema are
     dropped.
   - **"Sharp disagreement" is measured:** the share of the OCR's words (three letters or more) that the new reading
     contains.
     - Below **30 %** the new reading is rejected and the OCR's cards stay.
     - The check applies when the OCR scored at least **0.5** and has at least eight such words. A page the OCR read
       "poorly" has no reliable text to judge by: there the new reading is taken if it has any words.
   - With AI off, or a page that fails, the OCR's cards stay. The conversion never fails because of this stage.
   - `PdfConversion` records how many pages were read again (`aiPages`) and how many readings were rejected
     (`aiRejected`); the GraphQL type shows both.
3. **Clean-up: a card task, `CLEAN_UP`, on a note the person may edit.**
   - The note's text, heading and quote cards go to the model in batches of about 6,000 characters, each passage under
     its number, up to 48,000 characters of a note. The versioned `clean-up` prompt asks it to fix only what conversion
     broke: words split by hyphens or line ends, characters the OCR misread, stray page numbers and headers inside
     sentences. It returns only the passages it would change, by number.
   - It must not rephrase, add or drop anything, and the code checks each proposed change before the person sees it. A
     change is kept only when it differs and:
     - keeps at least **70 %** and at most **110 %** of the card's letters and digits;
     - has at least **80 %** of its words (three letters or more) taken from the card. A word counts as the card's when
       it appears in the card's letters run together (so `conver- sion` gives `conversion`), or is one edit from one of
       the card's words (two edits for words of eight letters or more), so `tbe` gives `the`.
   - The result is a list of changes, `{cardId, before, after}`, for the cards it would change. The person reviews them
     and applies the ones they keep with `applyAiChanges`, through the normal save with each card's revision. The
     artifact records which were applied.
   - A card's anchor and type are kept. A change to a card edited since is refused for that card.
   - It counts against the person's allowance. When a batch after the first fails (the allowance runs out, the model
     stops answering), the changes found so far are kept and the result says the note was not all read, as it does for
     a note past 48,000 characters.
4. **Hindi: the engine keeps `en`; the vision model reads Hindi pages.** Measured on the dev machine:
   - Docling 2.135's RapidOCR runs **one** recogniser per run: given `en,devanagari` it uses `en` and ignores the rest.
     ADR-0028's "Hindi is `devanagari`" therefore means choosing one recogniser for every page.
   - The PP-OCRv5 Devanagari recogniser reads the English scan fixture as well as `en` does. On a Hindi scanned page it
     gives garbled text ("hlhle 5: प्रकाश सूर्य के प्रकाश ऐ Iehe …") with a "fair" OCR score of 0.81. A reading would then
     be judged against that garbage.
   - `en` reads almost no words from the same page, and Docling grades it 0.63, so the page is escalated. With too few
     OCR words to judge by, the vision reading is taken.
   - gemma4 read the page word for word ("पौधे सूर्य के प्रकाश से अपना भोजन बनाते हैं।") with the `read-page` prompt.

   So the engine stays on `en`, and Hindi pages reach the vision model as unsure pages, least sure first. Telugu waits
   for the owner's evaluation set, as ADR-0028 says.

## Consequences

- The thresholds are first settings, not measurements. The owner's ~200 labelled pages (ADR-0028's evaluation set)
  will tune 0.8, 15 % and 30 %, which are constants beside the code that uses them.
- A page read again costs a vision call: 3.4 seconds for the scan fixture's page (309 tokens) on the dev machine's
  GPU, more for a full page. A 300-page scan can add 45 of them to its conversion, which runs in the worker, one
  conversion at a time.
- A scanned Hindi book has more unsure pages than the 15 % cap, so most of its pages keep their poor OCR text. Raising
  the cap for such documents waits for the evaluation set, as do the other thresholds.
- Clean-up changes cards only when the person applies the changes; a note's earlier versions are untouched (§10.3).

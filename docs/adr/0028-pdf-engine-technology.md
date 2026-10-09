# ADR-0028: PDF engine technology — Docling on CPU, OCR where needed, AI only for hard pages

- Status: Accepted (technology chosen on research, 2026-10-08) — gated by the evaluation set below
- Date: 2026-10-08
- Spec sections: §2 (Language), §8.1, §9.1, §10.1, §16.2
- Implements: ADR-0025 (PDF engine); amends §2 "TypeScript everywhere" for one service

## Context

ADR-0025 asks for a PDF engine that turns any PDF — lecture slides, textbooks, question papers, scans, Hindi and Telugu
— into an editable note made of cards. The backend is TypeScript on ECS Fargate (CPU only; Fargate has no GPUs), with
an AI gateway that has quotas. LVN is a closed-source service, so copyleft (AGPL/GPL) components are not acceptable.

Research (2026-10-08, sources in the research notes; quality scores are vendor-published and must be re-checked on our
own pages):

- **IBM Docling** — MIT code, Apache/CDLA models, very active; good layout, reading order and tables; JSON with
  bounding boxes; runs on CPU (≈ 3 s/page on 8 vCPU with OCR and tables). Weak on handwriting.
- **PyMuPDF / PyMuPDF4LLM** (AGPL) and older **MinerU** (AGPL) are excluded; **Marker/Surya** and **Chandra** weights are
  free only below revenue thresholds; **Nougat** weights are non-commercial — all excluded from the default path.
- OCR: **RapidOCR / PaddleOCR (PP-OCRv5)**, Apache-2.0, has English, Devanagari and Telugu models; Tesseract is a fallback.
- Hosted options for hard cases: frontier **vision LLMs** through our gateway (structured output, no retention by
  default on Anthropic's API); **Sarvam Vision** and **Google Document AI** lead on Indic printed text and handwriting;
  AWS Textract does not support Indic scripts.

## Decision

**A stage-wise pipeline**, owned by the `notes` context (which owns `FileObject`):

1. **Ingest (API):** check the fork rule (`file.convertToNote`), the plan's `PDF_PAGES_MONTHLY` and a per-file page
   cap; skip files already converted (SHA-256 cache); queue in chunks of ~20 pages.
2. **Triage (Node worker, `pdfjs-dist`, Apache-2.0):** per page — has a usable text layer? broken glyphs (old
   non-Unicode Hindi/Telugu fonts)? mostly images? which script? Decides OCR or not.
3. **Parse (`pdf-engine`, a Python service on CPU Fargate):** Docling for layout, reading order and tables; RapidOCR
   (PP-OCRv5: English, Devanagari, Telugu) only on pages or regions that need it; code detection on, formula
   recognition only on formula regions. Output: Docling JSON plus figure crops in S3. It consumes the BullMQ queue
   through the official Python `bullmq` client and holds **no business rules** — PDF in, structured document out.
4. **Escalate (Phase 5, AI gateway, budgeted):** pages with low OCR confidence, handwriting, maths or broken tables
   go to the cheapest capable vision model first (model table in the database, §10.1), a stronger one on retry, with a
   strict schema matching our card types and a verbatim-transcription prompt; results that disagree sharply with the
   OCR text are rejected. At most ~15 % of a document's pages escalate.
5. **Map to cards (Node, `notes`):** heading → heading; paragraph → text; list → markdown/checklist; table → table;
   picture → image + caption; code → code; formula → math (LaTeX); quotes and callouts by heuristic. Paragraphs and
   tables split across pages are merged. Each card keeps its source page and bounding box, so the editor can show the
   original page beside the card and re-run one page.
6. **Optional AI clean-up (Phase 5):** user-triggered, text only, counted against their AI quota (ADR-0025).

**Rollout.**
- **Phase 2:** stages 1–3 and 5 — digital PDFs and printed scans in English, Hindi and Telugu; side-by-side review.
  Build an **evaluation set of ~200 labelled pages** (slides, textbooks, question papers, Indic, handwriting); every
  engine or model upgrade must not regress on it.
- **Phase 5:** escalation and AI clean-up with quotas.
- **Later:** route Indic scans and handwriting to Sarvam Vision or Google Document AI (after a privacy review), or
  self-host a permissively licensed vision OCR model on GPU instances once escalation spend exceeds an always-on GPU.

**Cost and privacy.** The default path uses no paid model — estimated well under a dollar per 1,000 pages on CPU;
workers scale to zero. Content stays in our AWS account unless a page escalates; escalation sends the page image only,
never user identity (§10.1). External processors are listed in the privacy policy (§15.2, DPDP).

**Licences.** A CI licence allowlist (JavaScript and Python dependencies, including transitive ones) blocks AGPL/GPL
and non-commercial terms; model weights and versions are pinned.

**Language exception.** §2 says "TypeScript everywhere". `pdf-engine` is the one Python service, because the best
permissively licensed document-layout and OCR models are Python-only. It lives in `lvn-backend/workers/pdf-engine/`
with its own Dockerfile, typed I/O (JSON Schema shared with `@lvn/contracts`), tests and CI job.

## Consequences

- PDF conversion works on cheap CPU from Phase 2, with quality measured on our own pages, not vendor benchmarks.
- One extra runtime (Python) to operate; scoped to a stateless converter behind a queue.
- Handwriting and Indic scans improve in Phase 5 and later, behind budgets.

## Implementation notes (2026-10-09, P2h-2)

How Phase 2 built this, where it differs from the plan above:

- **Triage moved into the engine; decisions stay in Node.** The engine reports facts about a PDF (pages, pages with
  fewer than 20 characters in their text layer, SHA-256, password-protected) using pdfium (`pypdfium2`, Apache-2.0 or
  BSD-3), which Docling already ships. The notes context decides:
  - the per-file cap of 300 pages;
  - `PDF_PAGES_MONTHLY` (no row in the FREE plan yet, so unlimited until the owner sets one);
  - whether to OCR;
  - the cache.

  `pdfjs-dist` is ESM-only and awkward in the CommonJS worker and its tests.
- **Queues.**
  - `notes.pdf-parse` (the engine's): `triage`, then `parse`.
  - `notes.pdf` (the notes context's): `triaged`, `map`, `parse-failed`, and an hourly `expire-stuck` that fails
    conversions the engine never answered.

  The typed messages are `workers/pdf-engine/src/pdf_engine/jobs.py` and the interfaces in
  `contexts/notes/src/application/pdf-conversion.service.ts`. Both sides' tests check the same shapes; a shared JSON
  Schema in `@lvn/contracts` is still to come.
- **One PDF, one job.** No 20-page chunks yet: one conversion per person at a time and one PDF at a time per engine.
  This keeps the engine's memory predictable. Chunking comes back if large PDFs need it.
- **Cache.** The engine writes `pdf-engine/<sha256>/` in the restricted bucket: `document.json` (Docling's JSON, with
  pictures named rather than embedded), `pictures/<n>.png` and `result.json`. The same PDF converted again is mapped
  from these without parsing.
- **Versions.** Docling 2.135.0; **RapidOCR 3.9.2**, because 3.10.0 drops `PP_OCRV6_LANGS`, which Docling reads.
  PP-OCRv6 English is the default recogniser.
  - Hindi uses Docling's `devanagari` script model (to be measured on the evaluation set).
  - Telugu is not in RapidOCR's PP-OCRv6 list. Whether the PP-OCRv5 Telugu model works through Docling is open; it is
    checked when the owner's labelled pages arrive.
  - CPU PyTorch from PyTorch's CPU index.
- **Image.** About 4 GB, with the models downloaded by a warm-up conversion while the image is built, so a running
  engine never reaches the internet. It runs as a non-root user. On the local VM it gets a 3 GB memory cap and one
  job at a time. Speed is about 3 s a page on the development machine, with and without OCR.
- **Mapping (stage 5).**
  - Docling reports every section header at level 1, so heading levels come from numbering: "Chapter 3" is 1, "3.1"
    is 2, "3.1.2" is 3.
  - Paragraphs and lists on one page gather into text cards of up to about 3,000 characters.
  - A "Figure …" or "Table …" line straight after a picture or table is its caption, even when Docling calls it a
    header.
  - Page headers and footers, and the words drawn inside a figure, are dropped.
  - Every card carries the anchor of ADR-0040: the page and its boxes.
  - Pictures become files of the new note.

  Low-confidence flags wait for stage 4.
- **Where the cards go.** Each conversion makes a new private note of the asker's own (ADR-0025, through `studyPdf`).
  The cards are reviewed beside the PDF in the reader of ADR-0040.
- **Evaluation.**
  - `python -m pdf_engine.evaluate <folder>` reads `<name>.pdf` with `<name>.expected.json` (headings, phrases,
    tables, pictures). It reports heading and phrase recall and seconds per page, and fails below a recall threshold
    (90 % by default).
  - Two generated pages (a digital chapter, a scanned page) score 100 % today.
  - The owner's ~200 labelled pages are still to come.

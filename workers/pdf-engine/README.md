# pdf-engine

The PDF engine of LearnViaNotes (lvn-backend [ADR-0028](../../docs/adr/0028-pdf-engine-technology.md)). It is a
Python worker on CPU: Docling reads layout, reading order, tables and pictures, and RapidOCR reads pages without a
text layer. It holds no business rules — a PDF goes in and a structured document comes out. The `notes` context
decides limits and makes the cards.

## Jobs

| Queue | Job | From → to | What |
| --- | --- | --- | --- |
| `notes.pdf-parse` | `triage` | notes → engine | `{conversionId, bucket, key}`: count pages, find scans, hash |
| `notes.pdf` | `triaged` | engine → notes | `{conversionId, pages, scannedPages, sha256, encrypted}` |
| `notes.pdf-parse` | `parse` | notes → engine | `{conversionId, bucket, key, outputBucket, outputPrefix, ocr}` |
| `notes.pdf` | `map` | engine → notes | `{conversionId, bucket, documentKey, pictures[], pages, seconds}` |
| `notes.pdf` | `parse-failed` | engine → notes | `{conversionId, error}` (words for people) |

`parse` writes the following under `outputPrefix` (`pdf-engine/<sha256>/` in the restricted bucket):

- `document.json`: the DoclingDocument, with pictures named `pictures/<n>.png`;
- `pictures/<n>.png`;
- `result.json`: the `map` message, which the next conversion of the same PDF reuses.

## Settings

| Variable | Default | |
| --- | --- | --- |
| `REDIS_URL` | — (required) | The API's Redis |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | AWS defaults | Storage, as the API's (inside the network on the local VM) |
| `PDF_ENGINE_QUEUE` | `notes.pdf-parse` | |
| `PDF_ENGINE_RESULT_QUEUE` | `notes.pdf` | |
| `PDF_ENGINE_CONCURRENCY` | `1` | PDFs at a time (1–8); each needs about 2 GB |
| `PDF_ENGINE_OCR_LANGUAGES` | `en` | PP-OCR recognisers, comma-separated (`devanagari` for Hindi) |

## Development

```sh
uv sync --python 3.12                      # CPU PyTorch from PyTorch's CPU index
uv run pytest -m "not models"              # fast: settings, jobs, triage, the worker's answers
uv run pytest                              # also Docling itself (downloads models once, ~1 GB)
uv run python -m pdf_engine.evaluate tests/fixtures   # the evaluation set: recall and seconds a page
uv run ruff check src tests && uv run ruff format --check src tests
docker build -t lvn-pdf-engine .           # ~4 GB; models baked in by a warm-up conversion
```

The test PDFs in `tests/fixtures` are made with Chromium from HTML. Add labelled pages as `<name>.pdf` with a
`<name>.expected.json` (headings, phrases, tables, pictures, ocr).
`hindi-scan.pdf` is an image of a Hindi page (Pillow with Noto Sans Devanagari) and has no expected file: the `en`
recogniser cannot read it, so its test checks that it goes to the vision model instead (ADR-0063).

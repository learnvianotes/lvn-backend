"""Downloads Docling's and RapidOCR's models by converting a small PDF with and without OCR — run when the container
image is built, so a running engine never reaches the internet (ADR-0028)."""

from __future__ import annotations

import sys
from pathlib import Path

from .parse import parse_pdf

if __name__ == "__main__":
    pdf = Path(sys.argv[1])
    languages = tuple(sys.argv[2].split(",")) if len(sys.argv) > 2 else ("en",)
    for ocr in (False, True):
        parsed = parse_pdf(pdf, ocr=ocr, languages=languages)
        print(f"warm-up {'with' if ocr else 'without'} OCR: {parsed.pages} page(s) in {parsed.seconds:.1f}s")

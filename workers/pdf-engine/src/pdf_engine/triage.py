"""Stage 2 of ADR-0028: facts about a PDF before it is parsed — its pages, which of them have no text layer (scans that
need OCR) and its SHA-256 (the cache key). The notes context decides what to do with them (page limits, OCR, cache)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import pypdfium2 as pdfium

#: A page with fewer characters than this in its text layer is read with OCR
MIN_TEXT_CHARS = 20
#: Pages counted for their text layer; past this only the number of pages matters (the notes context refuses them)
MAX_PAGES_READ = 2_000


@dataclass(frozen=True)
class Triage:
    pages: int
    scanned_pages: int
    sha256: str
    encrypted: bool


def triage_pdf(path: Path) -> Triage:
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    try:
        pdf = pdfium.PdfDocument(str(path))
    except pdfium.PdfiumError as err:
        if "password" in str(err).lower():
            return Triage(pages=0, scanned_pages=0, sha256=sha, encrypted=True)
        raise
    try:
        pages = len(pdf)
        scanned = 0
        for index in range(min(pages, MAX_PAGES_READ)):
            page = pdf[index]
            textpage = page.get_textpage()
            if textpage.count_chars() < MIN_TEXT_CHARS:
                scanned += 1
            textpage.close()
            page.close()
        return Triage(pages=pages, scanned_pages=scanned, sha256=sha, encrypted=False)
    finally:
        pdf.close()

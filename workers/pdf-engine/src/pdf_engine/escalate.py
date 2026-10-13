"""Stage 4 of ADR-0028 (ADR-0063): the pages the vision model reads again — those Docling is unsure about, or that hold
maths — at most 15 % of a document, the least sure first; each rendered as a PNG for the notes context to send through
the AI gateway. No model is called here."""

from __future__ import annotations

import io
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

#: Docling grades a page "fair" or "poor" below this, from its lowest score (OCR, layout, parse, tables)
UNSURE_BELOW = 0.8
#: At most this share of a document's pages is read again (ADR-0028: "~15 %"); at least one when any is unsure
MAX_SHARE = 0.15
#: Pages render at twice PDF size (144 dpi): enough for handwriting and formulas, small enough to send
RENDER_SCALE = 2.0


@dataclass(frozen=True)
class PageSignal:
    #: 1-based, as the document's provenance
    page: int
    #: Docling's lowest page score, or None when it scored nothing
    score: float | None
    #: The OCR's score when the page was read by OCR
    ocr: float | None
    formulas: int


@dataclass(frozen=True)
class Escalation:
    page: int
    #: "low-confidence" or "formula"
    reason: str
    score: float | None
    #: The OCR's own score: the notes context judges a new reading against OCR text only when it is fair or better
    ocr: float | None = None


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(number) else number


def page_signals(confidence: Any, document: dict[str, Any]) -> list[PageSignal]:
    """Each page's scores (Docling's ConfidenceReport) and its formula regions (the document's provenance)."""
    formulas: dict[int, int] = {}
    for item in document.get("texts", []):
        if item.get("label") == "formula":
            for prov in item.get("prov", []):
                page = prov.get("page_no")
                if isinstance(page, int):
                    formulas[page] = formulas.get(page, 0) + 1
    pages = sorted(int(k) for k in document.get("pages", {}))
    scores = getattr(confidence, "pages", {}) if confidence is not None else {}
    signals = []
    for page in pages:
        scored = scores.get(page)
        signals.append(
            PageSignal(
                page=page,
                score=_number(getattr(scored, "low_score", None)) if scored is not None else None,
                ocr=_number(getattr(scored, "ocr_score", None)) if scored is not None else None,
                formulas=formulas.get(page, 0),
            )
        )
    return signals


def choose(signals: list[PageSignal], pages: int) -> list[Escalation]:
    """The pages to read again, least sure first, at most MAX_SHARE of `pages` (at least one if any qualifies)."""
    unsure = [s for s in signals if (s.score is not None and s.score < UNSURE_BELOW) or s.formulas > 0]
    if not unsure:
        return []
    limit = max(1, math.floor(pages * MAX_SHARE))
    ranked = sorted(unsure, key=lambda s: (s.score if s.score is not None else 1.0, -s.formulas, s.page))
    return [
        Escalation(
            page=s.page,
            reason="low-confidence" if s.score is not None and s.score < UNSURE_BELOW else "formula",
            score=s.score,
            ocr=s.ocr,
        )
        for s in ranked[:limit]
    ]


def render_pages(path: Path, pages: list[int], scale: float = RENDER_SCALE) -> dict[int, bytes]:
    """The chosen pages as PNGs (pypdfium2, as triage reads the PDF)."""
    import pypdfium2 as pdfium

    out: dict[int, bytes] = {}
    pdf = pdfium.PdfDocument(str(path))
    try:
        for page in pages:
            if not 1 <= page <= len(pdf):
                continue
            bitmap = pdf[page - 1].render(scale=scale)
            image = bitmap.to_pil()
            buffer = io.BytesIO()
            image.save(buffer, format="PNG", optimize=True)
            out[page] = buffer.getvalue()
    finally:
        pdf.close()
    return out

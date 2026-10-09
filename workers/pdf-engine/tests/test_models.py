"""The engine with Docling's models (slow; models download on first use): the evaluation set must pass."""

from __future__ import annotations

from pathlib import Path

import pytest

from pdf_engine.evaluate import main
from pdf_engine.parse import parse_pdf

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.models
def test_a_digital_chapter_keeps_its_structure() -> None:
    parsed = parse_pdf(FIXTURES / "chapter.pdf", ocr=False)
    labels = [t["label"] for t in parsed.document["texts"]]
    assert "section_header" in labels and "list_item" in labels
    assert len(parsed.document["tables"]) == 1
    assert len(parsed.pictures) == 1 and parsed.pictures[0].png.startswith(b"\x89PNG")
    assert parsed.document["pictures"][0]["image"]["uri"] == "pictures/0.png"


@pytest.mark.models
def test_the_evaluation_set_passes() -> None:
    assert main([str(FIXTURES), "--min-recall", "0.9"]) == 0

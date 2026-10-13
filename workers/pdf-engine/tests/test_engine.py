"""The engine without its models: settings, the job contract and the worker's answers (ADR-0028)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from pdf_engine.config import ConfigError, load
from pdf_engine.escalate import Escalation, PageSignal, choose, page_signals, render_pages
from pdf_engine.evaluate import evaluate_document, found
from pdf_engine.jobs import InvalidJob, ParseJob
from pdf_engine.parse import Parsed, Picture
from pdf_engine.triage import MIN_TEXT_CHARS, Triage, triage_pdf
from pdf_engine.worker import handle, handle_job, triage

ENV = {"REDIS_URL": "redis://localhost:6379/0", "S3_ENDPOINT": "http://s3:9000", "S3_FORCE_PATH_STYLE": "true"}
JOB = {
    "conversionId": "c1",
    "bucket": "files",
    "key": "u/1/source.pdf",
    "outputBucket": "restricted",
    "outputPrefix": "pdf-engine/abc/",
    "ocr": True,
}


class FakeStorage:
    def __init__(self) -> None:
        self.uploads: dict[str, tuple[bytes, str]] = {}
        self.downloads: list[tuple[str, str]] = []

    def download(self, bucket: str, key: str, path: Path) -> None:
        self.downloads.append((bucket, key))
        path.write_bytes(b"%PDF-1.7")

    def upload(self, bucket: str, key: str, body: bytes, content_type: str) -> None:
        self.uploads[f"{bucket}/{key}"] = (body, content_type)


class FakeQueue:
    def __init__(self) -> None:
        self.jobs: list[tuple[str, dict[str, Any], dict[str, Any]]] = []

    async def add(self, name: str, data: dict[str, Any], opts: dict[str, Any]) -> None:
        self.jobs.append((name, data, opts))


def test_settings_come_from_the_environment() -> None:
    config = load(ENV)
    assert config.parse_queue == "notes.pdf-parse" and config.result_queue == "notes.pdf"
    assert config.s3_force_path_style and config.concurrency == 1 and config.ocr_languages == ("en",)
    assert load({**ENV, "PDF_ENGINE_OCR_LANGUAGES": "en, devanagari"}).ocr_languages == ("en", "devanagari")
    with pytest.raises(ConfigError):
        load({})
    with pytest.raises(ConfigError):
        load({**ENV, "PDF_ENGINE_CONCURRENCY": "0"})


def test_jobs_are_checked() -> None:
    assert ParseJob.parse(JOB).ocr is True
    for bad in ({"key": ""}, {"outputPrefix": "no-slash"}, {"key": "../etc/passwd"}, {"outputPrefix": "a b/"}):
        with pytest.raises(InvalidJob):
            ParseJob.parse({**JOB, **bad})


async def test_a_parsed_pdf_is_stored_and_answered_with_a_map_job() -> None:
    storage, queue = FakeStorage(), FakeQueue()
    seen: dict[str, Any] = {}

    def parser(path: Path, *, ocr: bool, languages: tuple[str, ...]) -> Parsed:
        seen.update(path=path.read_bytes(), ocr=ocr, languages=languages)
        return Parsed(
            document={"texts": [], "pages": {"1": {}}},
            pictures=[Picture(ref="#/pictures/0", png=b"png", width=4, height=3)],
            pages=1,
            seconds=2.5,
        )

    result = await handle(JOB, config=load(ENV), storage=storage, answer=queue, parser=parser)
    assert result == {"pages": 1, "pictures": 1, "escalate": 0}
    assert storage.downloads == [("files", "u/1/source.pdf")]
    assert seen == {"path": b"%PDF-1.7", "ocr": True, "languages": ("en",)}
    assert json.loads(storage.uploads["restricted/pdf-engine/abc/document.json"][0]) == {
        "texts": [],
        "pages": {"1": {}},
    }
    assert storage.uploads["restricted/pdf-engine/abc/pictures/0.png"] == (b"png", "image/png")
    assert (
        json.loads(storage.uploads["restricted/pdf-engine/abc/result.json"][0])["documentKey"]
        == "pdf-engine/abc/document.json"
    )
    assert queue.jobs == [
        (
            "map",
            {
                "conversionId": "c1",
                "documentKey": "pdf-engine/abc/document.json",
                "bucket": "restricted",
                "pictures": [{"ref": "#/pictures/0", "key": "pdf-engine/abc/pictures/0.png", "width": 4, "height": 3}],
                "pages": 1,
                "seconds": 2.5,
                "escalate": [],
            },
            {"jobId": "c1.map"},
        )
    ]


async def test_pages_to_read_again_are_stored_as_pngs_and_named_in_the_map_job() -> None:
    storage, queue = FakeStorage(), FakeQueue()

    def parser(path: Path, *, ocr: bool, languages: tuple[str, ...]) -> Parsed:
        return Parsed(
            document={"texts": [], "pages": {"1": {}, "2": {}}},
            pages=2,
            seconds=1.0,
            escalate=[Escalation(page=2, reason="low-confidence", score=0.41, ocr=0.38)],
            page_images={2: b"page-two-png"},
        )

    result = await handle(JOB, config=load(ENV), storage=storage, answer=queue, parser=parser)
    assert result["escalate"] == 1
    assert storage.uploads["restricted/pdf-engine/abc/pages/2.png"] == (b"page-two-png", "image/png")
    message = queue.jobs[0][1]
    assert message["escalate"] == [
        {"page": 2, "reason": "low-confidence", "score": 0.41, "ocr": 0.38, "key": "pdf-engine/abc/pages/2.png"}
    ]
    # The cache keeps them too: the same PDF converted again reads the same pages again.
    assert json.loads(storage.uploads["restricted/pdf-engine/abc/result.json"][0])["escalate"] == message["escalate"]


class _Scores:
    def __init__(self, low: float, ocr: float = float("nan")) -> None:
        self.low_score, self.ocr_score = low, ocr


class _Confidence:
    def __init__(self, pages: dict[int, _Scores]) -> None:
        self.pages = pages


def test_page_signals_read_docling_scores_and_formula_regions() -> None:
    document = {
        "pages": {"1": {}, "2": {}, "3": {}},
        "texts": [
            {"label": "formula", "prov": [{"page_no": 3}]},
            {"label": "formula", "prov": [{"page_no": 3}]},
            {"label": "text", "prov": [{"page_no": 1}]},
        ],
    }
    signals = page_signals(_Confidence({1: _Scores(0.92), 2: _Scores(0.31, 0.4)}), document)
    assert signals == [
        PageSignal(page=1, score=0.92, ocr=None, formulas=0),
        PageSignal(page=2, score=0.31, ocr=0.4, formulas=0),
        PageSignal(page=3, score=None, ocr=None, formulas=2),
    ]


def test_at_most_fifteen_percent_of_pages_are_read_again_the_least_sure_first() -> None:
    signals = [PageSignal(page=n, score=0.95, ocr=None, formulas=0) for n in range(1, 21)]
    signals[4] = PageSignal(page=5, score=0.62, ocr=0.7, formulas=0)
    signals[9] = PageSignal(page=10, score=0.33, ocr=0.2, formulas=0)
    signals[14] = PageSignal(page=15, score=0.79, ocr=None, formulas=0)
    signals[17] = PageSignal(page=18, score=0.97, ocr=None, formulas=3)
    chosen = choose(signals, 20)
    # 15 % of 20 pages is 3: the three least sure, before a sure page with maths.
    assert [(e.page, e.reason) for e in chosen] == [
        (10, "low-confidence"),
        (5, "low-confidence"),
        (15, "low-confidence"),
    ]
    # A short document still reads its one doubtful page; a sure one reads none.
    assert [e.page for e in choose([PageSignal(page=1, score=0.95, ocr=None, formulas=1)], 1)] == [1]
    assert choose([PageSignal(page=1, score=0.95, ocr=None, formulas=0)], 1) == []


def test_pages_render_as_pngs() -> None:
    pngs = render_pages(Path(__file__).parent / "fixtures" / "chapter.pdf", [1, 9])
    assert list(pngs) == [1]
    assert pngs[1][:8] == bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])


async def test_a_pdf_that_cannot_be_parsed_fails_the_conversion_once() -> None:
    queue = FakeQueue()

    def parser(path: Path, *, ocr: bool, languages: tuple[str, ...]) -> Parsed:
        raise RuntimeError("broken xref")

    result = await handle(JOB, config=load(ENV), storage=FakeStorage(), answer=queue, parser=parser)
    assert result == {"failed": "broken xref"}
    assert queue.jobs == [
        (
            "parse-failed",
            {"conversionId": "c1", "error": "The PDF could not be read. It may be damaged or protected."},
            {"jobId": "c1.failed"},
        )
    ]


async def test_an_invalid_job_fails_its_conversion() -> None:
    queue = FakeQueue()
    with pytest.raises(InvalidJob):
        await handle({**JOB, "key": "../x"}, config=load(ENV), storage=FakeStorage(), answer=queue)
    assert queue.jobs[0][0] == "parse-failed" and queue.jobs[0][1]["conversionId"] == "c1"


def test_the_evaluation_finds_labels_even_in_slightly_wrong_ocr() -> None:
    assert found("Chapter 4: Respiration", ["Chapter 4 Respiration"])
    assert found("Cells use this energy to grow", ["Cells use thls energy to grow, move"])
    assert not found("Photosynthesis", ["Respiration releases energy"])
    doc = {
        "texts": [
            {"label": "section_header", "text": "3.1 What a plant needs"},
            {"label": "text", "text": "Water from the soil"},
        ],
        "tables": [],
        "pictures": [{}],
    }
    headings, phrases, tables, pictures, missing = evaluate_document(
        doc, {"headings": ["3.1 What a plant needs", "3.2 Light"], "phrases": ["water from the soil"], "pictures": 1}
    )
    assert (
        headings == (1, 2)
        and phrases == (1, 1)
        and tables == (0, 0)
        and pictures == (1, 1)
        and missing == ["heading: 3.2 Light"]
    )


FIXTURES = Path(__file__).parent / "fixtures"


def test_triage_counts_pages_and_scans() -> None:
    chapter = triage_pdf(FIXTURES / "chapter.pdf")
    assert (chapter.pages, chapter.scanned_pages, chapter.encrypted) == (1, 0, False)
    assert chapter.sha256 == __import__("hashlib").sha256((FIXTURES / "chapter.pdf").read_bytes()).hexdigest()
    assert triage_pdf(FIXTURES / "scanned.pdf").scanned_pages == 1
    assert MIN_TEXT_CHARS > 0


async def test_triage_answers_with_the_facts() -> None:
    queue = FakeQueue()
    result = await triage(
        {"conversionId": "c1", "bucket": "files", "key": "k.pdf"},
        storage=FakeStorage(),
        answer=queue,
        measure=lambda _p: Triage(pages=12, scanned_pages=3, sha256="ab", encrypted=False),
    )
    assert result == {"pages": 12, "scannedPages": 3}
    assert queue.jobs == [
        (
            "triaged",
            {"conversionId": "c1", "pages": 12, "scannedPages": 3, "sha256": "ab", "encrypted": False},
            {"jobId": "c1.triaged"},
        )
    ]


async def test_jobs_are_routed_by_name() -> None:
    with pytest.raises(InvalidJob):
        await handle_job("unknown", JOB, config=load(ENV), storage=FakeStorage(), answer=FakeQueue())

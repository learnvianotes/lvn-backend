"""The evaluation set (ADR-0028): how well the engine reads labelled PDFs.

    python -m pdf_engine.evaluate <folder> [--min-recall 0.9] [--json report.json]

Each `<name>.pdf` in the folder has a `<name>.expected.json`:

    {"ocr": false, "headings": ["Chapter 3: Photosynthesis"], "phrases": ["green plants turn light energy"],
     "tables": 1, "pictures": 1}

Headings must come out as headings and phrases anywhere in the text (both compared without case, spacing or
punctuation; OCR'd text may differ by a little, see FUZZY). Tables and pictures are counted. The run fails when the
recall of headings or phrases over the whole set is below --min-recall.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .parse import parse_pdf

#: How close an OCR'd line must be to a label to count (difflib ratio)
FUZZY = 0.85
HEADING_LABELS = {"title", "section_header"}


def normalise(text: str) -> str:
    return re.sub(r"[^\w]+", " ", text.lower()).strip()


def found(label: str, candidates: list[str]) -> bool:
    want = normalise(label)
    for text in candidates:
        have = normalise(text)
        if want in have:
            return True
        # A window of the candidate as long as the label, for OCR'd text that is nearly right.
        words, size = have.split(), len(want.split())
        for i in range(max(1, len(words) - size + 1)):
            if difflib.SequenceMatcher(None, want, " ".join(words[i : i + size])).ratio() >= FUZZY:
                return True
    return False


@dataclass
class FileResult:
    name: str
    pages: int
    seconds: float
    headings: tuple[int, int]
    phrases: tuple[int, int]
    tables: tuple[int, int]
    pictures: tuple[int, int]
    missing: list[str] = field(default_factory=list)


def evaluate_document(
    document: dict[str, Any], expected: dict[str, Any]
) -> tuple[tuple[int, int], tuple[int, int], tuple[int, int], tuple[int, int], list[str]]:
    texts = document.get("texts", [])
    headings = [t["text"] for t in texts if t.get("label") in HEADING_LABELS]
    everything = [t["text"] for t in texts] + [
        c.get("text", "") for tb in document.get("tables", []) for c in tb.get("data", {}).get("table_cells", [])
    ]
    missing: list[str] = []
    h_ok = 0
    for h in expected.get("headings", []):
        if found(h, headings):
            h_ok += 1
        else:
            missing.append(f"heading: {h}")
    p_ok = 0
    for p in expected.get("phrases", []):
        if found(p, everything):
            p_ok += 1
        else:
            missing.append(f"phrase: {p}")
    return (
        (h_ok, len(expected.get("headings", []))),
        (p_ok, len(expected.get("phrases", []))),
        (len(document.get("tables", [])), int(expected.get("tables", 0))),
        (len(document.get("pictures", [])), int(expected.get("pictures", 0))),
        missing,
    )


def main(argv: list[str] | None = None) -> int:
    args = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    args.add_argument("folder", type=Path)
    args.add_argument("--min-recall", type=float, default=0.9)
    args.add_argument("--json", type=Path)
    args.add_argument("--languages", default="en")
    opts = args.parse_args(argv)
    results: list[FileResult] = []
    for expected_path in sorted(opts.folder.glob("*.expected.json")):
        pdf = expected_path.with_name(expected_path.name.replace(".expected.json", ".pdf"))
        expected = json.loads(expected_path.read_text())
        parsed = parse_pdf(pdf, ocr=bool(expected.get("ocr")), languages=tuple(opts.languages.split(",")))
        h, p, t, pic, missing = evaluate_document(parsed.document, expected)
        results.append(FileResult(pdf.stem, parsed.pages, round(parsed.seconds, 2), h, p, t, pic, missing))
    if not results:
        print(f"No *.expected.json in {opts.folder}", file=sys.stderr)
        return 2
    h_ok, h_all = sum(r.headings[0] for r in results), sum(r.headings[1] for r in results)
    p_ok, p_all = sum(r.phrases[0] for r in results), sum(r.phrases[1] for r in results)
    pages = sum(r.pages for r in results)
    seconds = sum(r.seconds for r in results)
    print(f"{'file':<28} {'pages':>5} {'s/page':>7} {'headings':>9} {'phrases':>8} {'tables':>7} {'pictures':>8}")
    for r in results:
        print(
            f"{r.name:<28} {r.pages:>5} {r.seconds / max(r.pages, 1):>7.1f} {r.headings[0]:>4}/{r.headings[1]:<4} {r.phrases[0]:>3}/{r.phrases[1]:<4} {r.tables[0]:>3}/{r.tables[1]:<3} {r.pictures[0]:>3}/{r.pictures[1]:<3}"
        )
        for m in r.missing:
            print(f"    missing {m}")
    heading_recall = h_ok / h_all if h_all else 1.0
    phrase_recall = p_ok / p_all if p_all else 1.0
    print(
        f"\nheadings {heading_recall:.0%}  phrases {phrase_recall:.0%}  {pages} pages in {seconds:.1f}s ({seconds / max(pages, 1):.1f}s a page)"
    )
    if opts.json:
        opts.json.write_text(
            json.dumps(
                {
                    "headingRecall": heading_recall,
                    "phraseRecall": phrase_recall,
                    "pages": pages,
                    "seconds": seconds,
                    "files": [asdict(r) for r in results],
                },
                indent=2,
            )
        )
    return 0 if heading_recall >= opts.min_recall and phrase_recall >= opts.min_recall else 1


if __name__ == "__main__":
    sys.exit(main())

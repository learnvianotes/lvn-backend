"""Stage 3 of ADR-0028: a PDF into a DoclingDocument — layout, reading order, tables, pictures, and OCR (RapidOCR) for
the pages without a text layer. No business rules here: the notes context decides what becomes a card."""

from __future__ import annotations

import io
import time
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

#: Pictures are kept at twice the page's resolution: sharp enough for a note, small enough to store
PICTURE_SCALE = 2.0


@dataclass
class Picture:
    #: The picture's JSON pointer in the document, e.g. "#/pictures/0"
    ref: str
    png: bytes
    width: int
    height: int


@dataclass
class Parsed:
    #: DoclingDocument as JSON, pictures' image URIs replaced by `pictures/<n>.png`
    document: dict[str, Any]
    pictures: list[Picture] = field(default_factory=list)
    pages: int = 0
    seconds: float = 0.0


@lru_cache(maxsize=4)
def _converter(ocr: bool, languages: tuple[str, ...]) -> DocumentConverter:
    """Converters load their models once; there are two kinds (with and without OCR) per language set."""
    options = PdfPipelineOptions(
        do_ocr=ocr,
        do_table_structure=True,
        generate_picture_images=True,
        images_scale=PICTURE_SCALE,
    )
    if ocr:
        options.ocr_options = RapidOcrOptions(lang=list(languages))
    return DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)})


def parse_pdf(path: Path, *, ocr: bool, languages: tuple[str, ...] = ("en",)) -> Parsed:
    """Parses one PDF. `ocr` is decided by triage (ADR-0028 stage 2): only PDFs with pages lacking text pay for it."""
    started = time.monotonic()
    result = _converter(ocr, languages).convert(path)
    doc = result.document
    pictures: list[Picture] = []
    for index, item in enumerate(doc.pictures):
        image = item.get_image(doc)
        if image is None:
            continue
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        pictures.append(
            Picture(ref=f"#/pictures/{index}", png=buffer.getvalue(), width=image.width, height=image.height)
        )
    document = doc.export_to_dict()
    # The pictures travel as files; the document only names them.
    for index, picture in enumerate(document.get("pictures", [])):
        image = picture.get("image")
        if isinstance(image, dict):
            image["uri"] = f"pictures/{index}.png"
    return Parsed(
        document=document, pictures=pictures, pages=len(document.get("pages", {})), seconds=time.monotonic() - started
    )

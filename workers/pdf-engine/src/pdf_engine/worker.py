"""The engine as a BullMQ worker (ADR-0028) on `notes.pdf-parse`:

- `triage`: facts about the PDF (pages, scans, checksum), answered as `triaged` on `notes.pdf`;
- `parse`: the PDF read with Docling; the document, its pictures and `result.json` (what the next conversion of the
  same PDF reuses) written to storage, answered as `map` (or `parse-failed`) on `notes.pdf`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any, Protocol

from .config import Config
from .jobs import InvalidJob, ParseJob, TriageJob, failed_message, parsed_message, triaged_message
from .parse import Parsed, parse_pdf
from .triage import Triage, triage_pdf

log = logging.getLogger("pdf_engine")


class Storage(Protocol):
    def download(self, bucket: str, key: str, path: Path) -> None: ...
    def upload(self, bucket: str, key: str, body: bytes, content_type: str) -> None: ...


class Answer(Protocol):
    async def add(self, name: str, data: dict[str, Any], opts: dict[str, Any]) -> Any: ...


class Parser(Protocol):
    def __call__(self, path: Path, *, ocr: bool, languages: tuple[str, ...]) -> Parsed: ...


async def handle_job(
    name: str, data: dict[str, Any], *, config: Config, storage: Storage, answer: Answer
) -> dict[str, Any]:
    if name == "triage":
        return await triage(data, storage=storage, answer=answer)
    if name == "parse":
        return await handle(data, config=config, storage=storage, answer=answer)
    raise InvalidJob(f"no such job: {name}")


async def triage(
    data: dict[str, Any], *, storage: Storage, answer: Answer, measure: Callable[[Path], Triage] = triage_pdf
) -> dict[str, Any]:
    """Facts about the PDF for the notes context to decide on."""
    job = TriageJob.parse(data)
    try:
        with tempfile.TemporaryDirectory(prefix="pdf-engine-") as tmp:
            path = Path(tmp) / "source.pdf"
            await asyncio.to_thread(storage.download, job.bucket, job.key, path)
            facts = await asyncio.to_thread(measure, path)
    except Exception:
        log.exception("triage %s failed", job.conversion_id)
        await answer.add(
            "parse-failed",
            failed_message(job.conversion_id, "The PDF could not be read. It may be damaged."),
            {"jobId": f"{job.conversion_id}.failed"},
        )
        return {"failed": True}
    message = triaged_message(
        job.conversion_id,
        pages=facts.pages,
        scanned_pages=facts.scanned_pages,
        sha256=facts.sha256,
        encrypted=facts.encrypted,
    )
    await answer.add("triaged", message, {"jobId": f"{job.conversion_id}.triaged"})
    return {"pages": facts.pages, "scannedPages": facts.scanned_pages}


async def handle(
    data: dict[str, Any], *, config: Config, storage: Storage, answer: Answer, parser: Parser = parse_pdf
) -> dict[str, Any]:
    """One parse job. Failures are answered, not retried: a PDF that fails to parse fails the same way again."""
    try:
        job = ParseJob.parse(data)
    except InvalidJob as err:
        conversion = data.get("conversionId")
        if isinstance(conversion, str) and conversion:
            await answer.add(
                "parse-failed",
                failed_message(conversion, f"The conversion request was not valid: {err}"),
                {"jobId": f"{conversion}.failed"},
            )
        raise
    try:
        with tempfile.TemporaryDirectory(prefix="pdf-engine-") as tmp:
            path = Path(tmp) / "source.pdf"
            await asyncio.to_thread(storage.download, job.bucket, job.key, path)
            parsed = await asyncio.to_thread(parser, path, ocr=job.ocr, languages=config.ocr_languages)
        pictures = []
        for index, picture in enumerate(parsed.pictures):
            key = f"{job.output_prefix}pictures/{index}.png"
            await asyncio.to_thread(storage.upload, job.output_bucket, key, picture.png, "image/png")
            pictures.append({"ref": picture.ref, "key": key, "width": picture.width, "height": picture.height})
        escalate = []
        for item in parsed.escalate:
            key = f"{job.output_prefix}pages/{item.page}.png"
            await asyncio.to_thread(storage.upload, job.output_bucket, key, parsed.page_images[item.page], "image/png")
            escalate.append(
                {"page": item.page, "reason": item.reason, "score": item.score, "ocr": item.ocr, "key": key}
            )
        body = json.dumps(parsed.document, ensure_ascii=False).encode("utf-8")
        await asyncio.to_thread(
            storage.upload, job.output_bucket, f"{job.output_prefix}document.json", body, "application/json"
        )
        message = parsed_message(job, pages=parsed.pages, seconds=parsed.seconds, pictures=pictures, escalate=escalate)
        # Kept beside the document: the same PDF converted again is mapped from it without parsing (the cache).
        result = json.dumps({k: v for k, v in message.items() if k != "conversionId"}).encode("utf-8")
        await asyncio.to_thread(
            storage.upload, job.output_bucket, f"{job.output_prefix}result.json", result, "application/json"
        )
        await answer.add("map", message, {"jobId": f"{job.conversion_id}.map"})
        log.info(
            "parsed %s: %d pages in %.1fs, %d pictures, %d to read again",
            job.conversion_id,
            parsed.pages,
            parsed.seconds,
            len(pictures),
            len(escalate),
        )
        return {"pages": parsed.pages, "pictures": len(pictures), "escalate": len(escalate)}
    except Exception as err:
        log.exception("parse %s failed", job.conversion_id)
        await answer.add(
            "parse-failed",
            failed_message(job.conversion_id, "The PDF could not be read. It may be damaged or protected."),
            {"jobId": f"{job.conversion_id}.failed"},
        )
        return {"failed": str(err)[:200]}

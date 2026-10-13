"""The engine's typed input and output (ADR-0028): what the notes context sends on `notes.pdf-parse` (`triage`, then
`parse`) and what this service answers on `notes.pdf` (`triaged`, `map` or `parse-failed`). The TypeScript side of
the same shapes is contexts/notes pdf-conversion.service.ts."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

_KEY = re.compile(r"^[A-Za-z0-9!_.*'()/-]{1,900}$")


class InvalidJob(ValueError):
    pass


@dataclass(frozen=True)
class ParseJob:
    conversion_id: str
    #: The PDF to read
    bucket: str
    key: str
    #: Where to write `document.json` and `pictures/<n>.png` (a prefix ending in "/")
    output_bucket: str
    output_prefix: str
    #: Whether any page lacks a text layer (triage)
    ocr: bool

    @staticmethod
    def parse(data: dict[str, Any]) -> ParseJob:
        def text(name: str) -> str:
            value = data.get(name)
            if not isinstance(value, str) or not value:
                raise InvalidJob(f"{name} is required")
            return value

        job = ParseJob(
            conversion_id=text("conversionId"),
            bucket=text("bucket"),
            key=text("key"),
            output_bucket=text("outputBucket"),
            output_prefix=text("outputPrefix"),
            ocr=bool(data.get("ocr", False)),
        )
        for name, value in (("key", job.key), ("outputPrefix", job.output_prefix)):
            if not _KEY.match(value) or ".." in value:
                raise InvalidJob(f"{name} is not a storage key")
        if not job.output_prefix.endswith("/"):
            raise InvalidJob("outputPrefix must end with /")
        return job


@dataclass(frozen=True)
class TriageJob:
    conversion_id: str
    bucket: str
    key: str

    @staticmethod
    def parse(data: dict[str, Any]) -> TriageJob:
        job = ParseJob.parse({**data, "outputBucket": "-", "outputPrefix": "-/", "ocr": False})
        return TriageJob(conversion_id=job.conversion_id, bucket=job.bucket, key=job.key)


def triaged_message(
    conversion_id: str, *, pages: int, scanned_pages: int, sha256: str, encrypted: bool
) -> dict[str, Any]:
    """The `triaged` job: the facts the notes context decides on."""
    return {
        "conversionId": conversion_id,
        "pages": pages,
        "scannedPages": scanned_pages,
        "sha256": sha256,
        "encrypted": encrypted,
    }


def parsed_message(
    job: ParseJob,
    *,
    pages: int,
    seconds: float,
    pictures: list[dict[str, Any]],
    escalate: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """The `map` job the notes context runs next. `escalate`: the pages to read again with the vision model, each
    `{page, reason, score, key}` with its PNG at `key` (stage 4, ADR-0063)."""
    return {
        "conversionId": job.conversion_id,
        "documentKey": f"{job.output_prefix}document.json",
        "bucket": job.output_bucket,
        "pictures": pictures,
        "pages": pages,
        "seconds": round(seconds, 2),
        "escalate": escalate or [],
    }


def failed_message(conversion_id: str, error: str) -> dict[str, Any]:
    """The `parse-failed` job: the conversion fails with a reason people can read."""
    return {"conversionId": conversion_id, "error": error[:500]}

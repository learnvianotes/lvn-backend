"""Settings from the environment, checked once at start-up (as apps/api's config is)."""

from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class Config:
    redis_url: str
    s3_endpoint: str | None
    s3_region: str
    s3_access_key_id: str | None
    s3_secret_access_key: str | None
    s3_force_path_style: bool
    #: The queue this service takes jobs from, and the notes context's queue it answers on (ADR-0028)
    parse_queue: str
    result_queue: str
    concurrency: int
    #: PP-OCR recognisers for pages without a text layer (ADR-0028: English first; Hindi is `devanagari`)
    ocr_languages: tuple[str, ...]


def load(env: dict[str, str] | None = None) -> Config:
    e = dict(os.environ if env is None else env)

    def need(name: str) -> str:
        value = e.get(name, "").strip()
        if not value:
            raise ConfigError(f"{name} is required")
        return value

    concurrency = e.get("PDF_ENGINE_CONCURRENCY", "1")
    if not concurrency.isdigit() or not 1 <= int(concurrency) <= 8:
        raise ConfigError("PDF_ENGINE_CONCURRENCY must be a number from 1 to 8")
    languages = tuple(code.strip() for code in e.get("PDF_ENGINE_OCR_LANGUAGES", "en").split(",") if code.strip())
    if not languages:
        raise ConfigError("PDF_ENGINE_OCR_LANGUAGES needs at least one language")
    return Config(
        redis_url=need("REDIS_URL"),
        s3_endpoint=e.get("S3_ENDPOINT") or None,
        s3_region=e.get("S3_REGION", "us-east-1"),
        s3_access_key_id=e.get("S3_ACCESS_KEY_ID") or None,
        s3_secret_access_key=e.get("S3_SECRET_ACCESS_KEY") or None,
        s3_force_path_style=e.get("S3_FORCE_PATH_STYLE", "false").lower() == "true",
        parse_queue=e.get("PDF_ENGINE_QUEUE", "notes.pdf-parse"),
        result_queue=e.get("PDF_ENGINE_RESULT_QUEUE", "notes.pdf"),
        concurrency=int(concurrency),
        ocr_languages=languages,
    )

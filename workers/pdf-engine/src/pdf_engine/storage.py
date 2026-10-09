"""S3-compatible storage (RustFS on the local VM, S3 in AWS), with the API's settings."""

from __future__ import annotations

from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig

from .config import Config


class S3Storage:
    def __init__(self, config: Config) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=config.s3_endpoint,
            region_name=config.s3_region,
            aws_access_key_id=config.s3_access_key_id,
            aws_secret_access_key=config.s3_secret_access_key,
            config=BotoConfig(
                s3={"addressing_style": "path" if config.s3_force_path_style else "auto"}, retries={"max_attempts": 3}
            ),
        )

    def download(self, bucket: str, key: str, path: Path) -> None:
        self._client.download_file(bucket, key, str(path))

    def upload(self, bucket: str, key: str, body: bytes, content_type: str) -> None:
        self._client.put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type)

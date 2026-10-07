# ADR-0032: RustFS instead of MinIO for local and test object storage

- Status: Accepted
- Date: 2026-10-08
- Deciders: Backend agent; owner (standing instruction to follow the spec, deviations recorded as ADRs)
- Spec sections: §2 (Object storage, Testing), §8, §17

## Context

§2 pins "S3 (prod) / MinIO (dev, test)" and Testcontainers for MinIO. MinIO no longer publishes container images:
`docker pull minio/minio` and `quay.io/minio/minio` both fail (repository removed / unauthorised), and
`@testcontainers/minio` depends on that image. Production is unaffected — it uses Amazon S3.

## Decision

- Development and tests use **RustFS** (`rustfs/rustfs:1.0.1`, Apache-2.0), an S3-compatible server with the same
  role MinIO had: `infra/docker/compose.yaml` runs it on host port 59000 (console 59001), and `libs/testing` starts it
  with Testcontainers' generic container.
- Application code talks only to the S3 API through `@aws-sdk/client-s3` and `libs/storage`. The endpoint, region,
  credentials, path-style flag and bucket names come from the environment (`S3_*`, ADR-0022), so the server can be
  swapped (RustFS, another S3-compatible server, real S3) without code changes.
- Nothing RustFS-specific is used: no admin API, no proprietary extensions, no console automation.

## Consequences

- Local and CI storage behaves like S3 for the calls LVN makes (PutObject via pre-signed URL, HeadObject, GetObject,
  DeleteObject, CreateBucket); the integration tests exercise exactly these.
- If RustFS diverges from S3 behaviour for one of these calls, the fix is another S3-compatible image, not code.
- Revisit if MinIO images return or the spec owner prefers a different server.

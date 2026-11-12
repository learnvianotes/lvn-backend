# Running release on health and GraphQL

- Date: 2026-11-12
- Package: `@lvn/contracts` stays **0.86.0**. This is not a contracts release. The schema file in the repo gains one field; publishing it waits for a `contracts-v*` tag.
- Spec: [VERSIONING.md](../../VERSIONING.md)
- Breaking: no

## Why

The process should say which build is running, as `vX.Y.Z+<shortsha>`: the root `package.json` version, plus `RELEASE` (the 12-character image tag deploy already sets). Traces keep reporting `RELEASE` on its own.

## `Query.version: String!`

No arguments. Anyone, including an anonymous caller. Not the terms date (`termsVersion`).

Example: `v0.5.0+d9d27b2d71f0`. When `RELEASE` is unset the suffix is `dev`.

## `GET /health/ready`

Adds `version` with the same string. `status` and `checks` are unchanged, and so is the status code. `GET /health/live` is unchanged. The worker's `GET /health/ready` adds the same field; its liveness body stays `{ "status": "ok" }`.

## Authorization

None.

## Migration

None.

# The web's connections limited to known origins

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.59.0
- Spec: ADR-0090
- Breaking: no

## What changes for clients

- **`webConfigSchema`** gains an optional `NEXT_PUBLIC_STORAGE_ORIGINS`: the origins pre-signed storage URLs point at,
  space-separated (the local environment's S3 endpoint; on AWS, the region's S3 hosts).
- With it set, the web's Content Security Policy lets the browser connect only to the site, the API and its live
  updates, those storage origins, Google sign-in and Sentry. Unset (development, tests), it connects anywhere, as
  before. `deploy-local.sh` and `deploy.sh` set it.
- The phone is unchanged.

# A per-person rate limit, and reader links that last 15 minutes

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.58.0 (unchanged)
- Spec: ADR-0090
- Breaking: no

## What changes for clients

- **Rate limit.** A signed-in person may send 600 GraphQL operations a minute. Past that, an operation is refused
  before it runs: HTTP 429, a `Retry-After` header in seconds, and an error with `extensions.code: RATE_LIMITED` and
  `extensions.retryAfter`. Clients show "Try again in a moment" and do not retry at once.
- **`noteFile(noteId, fileId).url`** now lasts 15 minutes (was 60). A reader that keeps a PDF open longer asks
  `noteFile` again when a range request is refused (403 or 400), and continues with the new URL.

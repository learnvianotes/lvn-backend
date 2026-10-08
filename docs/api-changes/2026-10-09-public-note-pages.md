# Public note pages (Phase 2, P2d-2)

- Date: 2026-10-09
- Package: `@lvn/contracts` unchanged except two optional API settings (still 0.16.0)
- Breaking: no

## GraphQL

`publicNotes(first, after): NoteConnection!` — notes anyone may read (PUBLIC, published, moderation OK, not in the
trash), newest published first, at most 100 a page. No sign-in. For the sitemap and public pages; a single public
note is still `note(id)` without a token.

## Refreshing public pages

With `WEB_REVALIDATE_URL` and `REVALIDATE_SECRET` set, the API POSTs `{ "tags": ["note:<id>", "public-notes"] }` to
the web app's `/api/revalidate` with the header `x-revalidate-secret` whenever what the public can read of a note
changes: a PUBLIC note is published again, a note becomes or stops being PUBLIC, is held, hidden or approved by
moderation, trashed or restored. Failures are logged; pages then refresh at their revalidation interval.

The local environment sets both (the API calls `http://web:3000` inside the network) and gives the web container
`API_INTERNAL_URL=http://api:4000/graphql`. The AWS sandbox Terraform gets the same settings when the sandbox is built.

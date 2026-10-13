# ADR-0074: Resources — submission, moderation and a safe fetcher

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents
- Spec sections: §3 (resource discovery), §14.4, §15.1, §18 (Phase 7: "moderation on submissions; no commerce
  surface"); ADR-0017 (verified accounts), ADR-0037 and ADR-0051 (moderation), ADR-0070 (topics)

## Context

§14.4 describes a learning catalogue:
- books, courses, tools, software and hardware;
- people submit them, moderators approve them, everyone searches, saves, shares, recommends and discusses them;
- outbound links carry `rel="nofollow ugc"`;
- there are no prices, affiliate links, carts or seller accounts.

Links are where a public site attracts spam. Google asks sites to:
- mark user links `ugc`/`nofollow`;
- hold new users' links for review;
- keep pages without a reputation out of the index.

It also warns that spam on part of a site hurts all of it. A submitted link is also a URL that the server fetches to
fill in a title and a picture. OWASP lists what that needs, so the server never becomes a way into its own network:
- check every address the name resolves to;
- connect to the address that was checked;
- check every redirect again;
- bound the size and the time.

CVE-2026-61704 (link-preview-js before 4.0.4) is the usual mistake: the library checked one address, then fetched
the name again.

This ADR covers submission and moderation (P7a). Discovery (P7b) builds on the same model.

## Decision

1. **The model** (`core` schema, beside comments, reactions and reports).
   - `Resource`:
     - `type` (BOOK, COURSE, TOOL, SOFTWARE, HARDWARE, OTHER) and `title` (3–200 characters);
     - `description` (at most 2,000) and `url` (http or https, at most 2,000);
     - `isbn` (books, kept as ISBN-13) and `author` ("by", at most 200);
     - a cover picture, 1–5 curated topics (`ResourceTopic`) and the submitter;
     - `status` PENDING, APPROVED or REJECTED, with the moderator's `reason`;
     - `decidedAt`, `createdAt`, `updatedAt`.
   - **No commerce fields.** There are no price, currency, store, seller, stock or affiliate fields. A test reads the
     schema and fails if one appears, and the URL normaliser strips known affiliate and tracking parameters (`tag`,
     `affid`, `utm_*` and the like).
2. **Who submits.**
   - A verified account (ADR-0017) that is not suspended and not a child account. A resource is public with its
     submitter's name, and child accounts do not publish in public (§15.2).
   - New action `resource.submit`.
   - Limits: 10 submissions a day, and at most 20 waiting at once.
   - Topics must be curated (a person's own proposed topics are private to them).
3. **Every submission waits for a moderator.**
   - It opens a case in the platform moderation queue (`ReportEntityType.RESOURCE`, a report with no reporter). The
     word scorer's verdict on the title and description goes with it.
   - **Approve:** the resource is public.
   - **Reject:** a reason is required. The resource is REJECTED and the submitter is told why (notification category
     `RESOURCE`).
   - A submitter may edit a pending or rejected resource. Saving a rejected one resubmits it, back to PENDING, with a
     new case.
   - An approved resource is not edited by its submitter. They may delete it.
   - Once approved, people report a resource like other content. Moderators REMOVE it (back to REJECTED, the
     submitter told), APPROVE it again, or DISMISS the reports.
   - Pending and rejected resources are seen only by their submitter and platform moderators. Anywhere else they are
     "not found".
4. **Duplicates.**
   - URLs are normalised:
     - lower-case scheme and host;
     - no default port, fragment or trailing slash;
     - tracking and affiliate parameters removed;
     - remaining query parameters sorted.
   - A URL or ISBN already used by a pending or approved resource is refused (CONFLICT). The refusal names the approved
     one; a pending one is not named.
5. **A safe fetcher** (`libs/safe-fetch`), the only way the server fetches a URL a person gave.
   - http and https on ports 80 and 443 only.
   - Every address the name resolves to is checked at connect time, through the connection's own `lookup`, against a
     block list:
     - loopback, private, shared (CGNAT) and link-local ranges;
     - the cloud metadata address;
     - multicast and reserved ranges;
     - IPv6 unique-local and mapped addresses.
   - At most 3 redirects, each checked again. 5 seconds. At most 1 MB of HTML or 2 MB of picture. Content types are
     checked.
   - A User-Agent that names LearnViaNotes. Tests and the local environment may allow named hosts by configuration
     (`SAFE_FETCH_ALLOW_HOSTS`).
6. **Previews are suggestions.**
   - `resourcePreview` reads a page's title, description, picture and site name from its OpenGraph and meta tags, or a
     book by ISBN from Open Library (`OPEN_LIBRARY_URL`; no key, a named User-Agent, one lookup at a time).
   - The submitter edits everything before sending. Nothing is fetched unless a person asks.
   - 30 previews an hour per person.
7. **Pictures are copied, never hot-linked.**
   - The submitter uploads a cover (purpose COVER), or the server copies the preview's picture into storage when the
     resource is submitted. Pictures are at most 2 MB, JPEG, PNG or WebP.
   - A picture that cannot be copied leaves the resource without one.
8. **Public pages.**
   - An approved resource is readable by everyone, guests included.
   - Its link carries `rel="ugc nofollow noopener"`.
   - Its page is `noindex` until three people have saved it (P7b), as Google's guidance for content without a
     reputation.
9. **Data.**
   - A person's resources go into their data export.
   - Deleting the account deletes their resources, as it deletes their notes.
   - Decisions are moderation actions and audit entries (ADR-0037).

## Consequences

- Moderators work in the queue they already use. No second admin screen.
- Every resource costs a moderator's look before anyone sees it. This is deliberate for links: if the queue grows,
  trusted submitters can skip it later (a separate decision, with data on approval rates).
- The safe fetcher is shared: Skills import (P7c) fetches personal pages through it.
- Stars and ratings are left out on purpose. Direct evidence on what helps learners choose is thin (see the Phase 7
  plan), so P7b uses saves and short reasons.

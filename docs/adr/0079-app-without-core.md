# ADR-0079: The apps without /core, and subjects pages of their own

- Status: Accepted
- Date: 2026-10-14
- Deciders: owner; Web and Mobile agents
- Spec sections: ADR-0002 (the old notes at /core), ADR-0012 (the curated catalogue), ADR-0076 (board A's Subjects)

## Context

/core serves the old site's notes (DSA, ML and others) to visitors on the web. The landing page, the visitor's header,
the sidebar and the sitemap led there.

On 2026-10-14 the owner asked: "redesign web and mobile without need of /core we will use it later dont delete that
code."

The app already has its own catalogue: the curated subjects and topics, with the same slugs as /core. Notes and
resources are tagged with them.

## Decision

1. **/core is switched off, not removed.**
   - `NEXT_PUBLIC_CORE_ENABLED` is off unless `true`. While off, nothing links to /core, and its pages and data
     documents are not built.
   - Its addresses lead to `/subjects`, and the old root subject addresses (`/<subject>[/…]`) to `/subjects/<subject>`.
     These redirects are temporary, so they can point back.
   - The code, the content and its tests stay. The tests run when the switch is on.
2. **The web's own subjects pages, server-rendered for visitors and search engines:**
   - `/subjects`: every subject with its number of topics;
   - `/subjects/<subject>`: its topics and subtopics, and the public notes and resources on it;
   - `/subjects/<subject>/<topic>`: the topic's subtopics, notes and resources. With none, it says so and leads to
     writing a note.
3. **Where Subjects now leads:**
   - The landing's hero link and subject grid, the visitor's header, the phone header link, and the sidebar's Subjects
     go to these pages.
   - The sitemap lists them instead of /core.
4. **On the phone**, Explore's empty state leads to Subjects: each subject's topics, each opening its notes in Explore.
   The phone never reached /core.
5. **Unchanged:** `core:` topic keys and the old site's imported progress stay in the backend. Recommendations and
   history already send them to search.

## Consequences

- The product stands on its own catalogue. A topic's page is only as rich as the notes and resources people share on
  it, so early on many will be empty, and each says so.
- Turning /core back on is a configuration change; the redirects then go back to /core.

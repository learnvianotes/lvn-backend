# ADR-0049: Feeds — the Following feed and the activity of one's groups and classes

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend agent (Phase 3, slice P3g); web and mobile follow
- Spec sections: §3, §4.1, §12.1, §13.1; ADR-0014, ADR-0016, ADR-0043, ADR-0045, ADR-0046, ADR-0048

## Context

§3 says `core` builds the Following feed. No store is specified. The phase plan leans towards read-time queries with
keyset pagination while the numbers are small, and a precomputed timeline only when measurements ask for one.

The two feeds draw on two contexts:
- followed people's PUBLIC notes and publications are in `notes`;
- group posts, ideas, doubts and class announcements are in `core`;
- notes shared to groups and classes are in `notes`, behind its read rule.

## Decision

1. **Following feed (`notes`).**
   - `followingFeed(first, after)` returns PUBLIC notes, published and not held back, of every kind (notes,
     projects, blogs, posts) whose owner the viewer follows. Newest published first, keyset over
     `(publishedAt, id)`.
   - It uses the public read predicate (`visibleNotesWhere(null)`) and leaves out anyone the viewer blocks or who
     blocks them.
   - The followed ids come from the new `PEOPLE.followingIds`, capped at 2,000. The spec places this feed in `core`,
     but it is notes' predicate over notes' table, so it is served where the data is. Nothing is copied.
2. **Activity feed (`core`).**
   - `activityFeed(first, after)` merges, newest first, what happened in the viewer's groups and classes:
     - group posts and ideas;
     - doubts in project workspaces;
     - class announcements;
     - notes shared to those groups and classes.
   - Each source is read with the same keyset `(at, id)`, `first + 1` rows each, and the sources are merged in
     memory. The cursor is the last item's `(at, id)`.
   - Notes shared to a place come through a new `NOTE_ACCESS.placeShares` facade method. `notes` applies its read rule,
     so a note the viewer cannot read never appears. There is no copy that could go stale when a note is unshared.
   - Left out: the viewer's own doing, and people the viewer blocks or who block them.
   - Items carry ids and the place: `GroupPost`, `ClassroomPost`, `Doubt` or `Note` (resolved by notes), `group`
     or `classroom`, `actor` and `at`. Clients write the sentences.
3. **Limits.** Pages of at most 50 items. The activity feed reads at most 200 groups and 200 classes, the most
   recently active first.
4. **Clients.** The web gets a Community page (`/community`) with both feeds and links to groups and classes; the
   header's Groups and Classes links become one Community link. On the phone, the Community tab gains Following and
   Activity next to groups and classes.

## Consequences

- No fan-out and no timeline tables. A feed costs one indexed query per source.
- When measurements show slow feeds, a precomputed timeline can replace the read-time merge behind the same queries.
- One read rule still decides every note a person sees, including in feeds.

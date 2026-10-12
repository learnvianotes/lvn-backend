# ADR-0056: Search everywhere — groups and classes, filters, more results, recent searches

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P4b)
- Spec sections: §11, §12.2, §13.1, §5; ADR-0045, ADR-0046, ADR-0055

## Context

§11 lists the collections search covers: notes, users, groups, classrooms (members only), resources and topics. It
also asks for filters, a Cmd/K palette with grouped results, and phone search with recent queries kept on the phone.
Since P2e, `search(query, scopes, first)` has answered notes, people and topics in groups; groups and classes were found
only through their own directory pages.

## Decision

1. **Grouped results stay.** §11 says "a union result type". P2e shipped `SearchResults` with one list per kind, and
   every client shows them grouped. Adding the new kinds as lists is not breaking; a union would be, and would give
   nothing the lists do not.
2. **Groups.**
   - Who finds what: signed-in people find PUBLIC groups (community groups and project workspaces), and PRIVATE
     groups only if they are members. A deleted or removed group is never found. Signed out, no groups and no
     classes: their pages need an account.
   - Matching: name and description.
   - Typesense `groups` collection, fed by `core`'s events: GroupCreated, the new GroupUpdated (name, description,
     privacy), GroupDeleted and GroupRestored.
   - The Postgres provider asks `core` through the PLACES facade.
   - Before they are returned, groups and classes are checked against `core`'s live state: an index a moment behind
     never offers one that is gone, or that `core` would not show the viewer.
3. **Classes.** Only for their members (§11 "members only"); matching: name and description. The `classrooms`
   collection is fed by ClassroomCreated, the new ClassroomUpdated, and ClassroomDeleted.
4. **Filters** (`filters: SearchFilters`) narrow notes. Topics take the subject only.
   - `kinds`: NOTE, BLOG, POST, PROJECT.
   - `subjectId`, `topicId`: notes about them.
   - `authorId`: notes by them.
   - `sources`: where a note comes from for the viewer, any of:
     - MINE: owned;
     - SHARED: reached through a share, a group or a class, not owned;
     - PUBLIC: public, not owned.

     Signed out, only PUBLIC applies.

   Filters narrow the read predicate; they never widen it. A search with filters but no words lists the notes they
   allow, newest first: choosing a topic shows its notes.
5. **More results.**
   - `search(after:)` continues the notes of the same query and filters; `notesCursor` is null at the end.
   - A continued page brings notes only, up to 200 notes per search on either provider.
   - The cursor is opaque (an offset); a cursor from another query is refused (VALIDATION).
6. **Recent searches on the phone** are kept in the phone's local database (its `kv` table): the last ten, removable
   one by one or all at once, and wiped with everything else at sign-out. They never leave the phone. The web keeps
   none (browsers are often shared); the palette opens on its hint as before.

## Consequences

- One field still answers everything, and Typesense still decides nothing a reader can see: every hit is opened as
  the viewer.
- The PLACES facade grows search documents and two searches, with a `PlacesService` of its own in `core` (it was
  ClassroomsService), and `core` gains two events.
- Resources join in Phase 7 the same way.

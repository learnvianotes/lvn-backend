# Search everywhere (P4b)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.31.0
- Spec: §11; ADR-0055, ADR-0056
- Breaking: no (new enum values, arguments and fields only)

## What changes for clients

`search(query, scopes, first, filters, after)`:

- **Scopes.** `SearchScope` gains `GROUPS` and `CLASSROOMS`. Without `scopes`, all five kinds come back.
  - `groups`: for signed-in viewers, PUBLIC groups and project workspaces, and PRIVATE groups the viewer is in, most
    members first.
  - `classrooms`: classes the viewer is in.
  - Signed out, both lists are always empty.
- **Filters.** The new `filters: SearchFilters` narrows notes. Topics are narrowed by `subjectId` only. Fields:
  - `kinds: [NoteKind!]`
  - `subjectId`, `topicId`, `authorId`
  - `sources: [NoteSource!]`, any of:
    - `MINE`: the viewer's own;
    - `SHARED`: shared with the viewer, directly or through a group or class of theirs;
    - `PUBLIC`: other people's public notes.

    Signed out, only `PUBLIC` gives anything.
- **Filters without words.** With filters set, `query` may have no words: the notes the filters allow come newest
  first, and their snippet is the start of the note.
- **More notes.**
  - `notesCursor` is set when there are more notes. Pass it as `after`, with the same query and filters, for the next
    `first`.
  - A continued page has notes only.
  - A search reaches at most 200 notes.
  - A cursor from another search is `VALIDATION` (field `after`).
- **Fix: `Note.title` for readers.** Readers (`viewerAccess: READER`) now get the published version's title.
  Before, they got the current draft's title, which the owner might not have published.

## Authorization

The read predicate is unchanged, and filters only narrow it. Groups and classes are checked against `core`'s live
state before they are returned.

## What clients should do

- Show groups and classes in search results: the palette and `/search` on the web, Explore on the phone.
- Offer filters for kind and source. Choosing a topic lists its notes (`topicId` with an empty query).
- Offer "More results" from `notesCursor`.
- Phone: keep recent searches on the device.

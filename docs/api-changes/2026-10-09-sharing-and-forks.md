# Sharing, visibility and forks (Phase 2, P2c-1)

- Date: 2026-10-09
- Package: `@lvn/contracts` unchanged (0.15.0); GraphQL only
- Spec: §4.2, §4.4, §5, §15.2; ADR-0010 (forks), ADR-0013 (teacher network)
- Breaking: no (additions only)

## What and why

Owners decide who reads a note: PRIVATE, SHARED (the people it is shared with) or PUBLIC. People share by handle or
email as VIEWER (reads the published version) or EDITOR (works on the draft). Anyone who may read a note can keep a
PRIVATE copy of it unless the owner turned copies off; the copy names where it came from, for good.

## GraphQL (notes subgraph)

Types: `NoteShareRole` (EDITOR, VIEWER), `NoteShare { user, role, createdAt }`,
`ForkCredit { author, note, title }`; `Note.shares` (owner only, null for anyone else) and `Note.forkedFrom`.

Query: `sharedWithMe(first, after)`, notes other people shared with the viewer that the viewer can still read, most
recently changed first.

Mutations (one `input`, `NotePayload` with `userErrors`):

| Mutation | Rules |
| --- | --- |
| `changeNoteVisibility { noteId, visibility }` | Owner with a verified account. PUBLIC needs a published version, is refused to restricted minors (§15.2) and to copies of notes that were not public when copied |
| `shareNote { noteId, person, role }` | `person` is `@handle`, `handle` or an email. Sharing again changes the role. A PRIVATE note becomes SHARED (shares grant nothing on a PRIVATE note). Teachers share with teachers only once connected (ADR-0013). At most 100 people per note, 200 shares an hour |
| `unshareNote { noteId, userId }` | Owner; the person loses access at once |
| `forkNote { noteId }` | Returns the new PRIVATE copy (new card ids, curated topics kept): the published version, or the live draft for the owner and share editors when nothing is published. NOT_FOUND when the viewer cannot read the note; FORBIDDEN when copies are off (the owner can still copy their own). 100 copies an hour |
| `setNoteForking { noteId, enabled }` | Owner |

`forkedFrom.author` is always shown; `forkedFrom.note` and `forkedFrom.title` are null once the viewer can no longer
read the origin.

Errors are the usual codes: FORBIDDEN (unverified account, minors, teacher rules, copies off), VALIDATION (unknown
person, own note, not published, in the trash), RATE_LIMITED.

## Data

`notes.Note` gains `forkedFromNoteId`, `forkedFromVersionId`, `forkedFromOwnerId`, `forkedFromVisibility` and
`forkedAsRole` (enum `ForkRole`); migration `20261009010000_note_forks`. Visibility changes, shares and unshares are
written to the audit log (`note.visibility`, `note.share`, `note.share.role`, `note.unshare`).

## Clients

Web: share dialog, "Shared with me", "Make a copy" and the credit line (P2c-1 web). Mobile: with the notes screens
(P2f).

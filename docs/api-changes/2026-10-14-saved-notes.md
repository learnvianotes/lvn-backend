# Saved notes (UI-d1)

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.48.0
- Spec: ADR-0076 (item 5)
- Breaking: no

## What changes for clients

- **`saveNote(input: { noteId })` / `unsaveNote(input: { noteId })`** answer the note (`NotePayload`).
  - Saving works for any note the viewer can read, their own included. Saving it again changes nothing.
  - A note the viewer cannot read, or whose owner blocked them or was blocked by them, is NOT_FOUND "Note not
    found.", the same answer as for a note that does not exist.
  - Unsaving always works. The note comes back as `null` when the viewer can no longer read it.
- **`Note.viewerSaved`**: true when the viewer saved it. It is false for everyone else and for visitors.
- **`savedNotes(first, after)`**: the viewer's saved notes, newest saved first.
  - Only notes they can still read are listed. A note made private, trashed, hidden by moderators, or whose owner
    blocked them is left out, and listed again if that changes.
  - Pages follow the saves, so a page can be shorter than asked, and even empty with `hasNextPage` true.
- Saving is private: there is no count, and no one sees who saved what.

## Data

- `notes.NoteSave(noteId, userId, createdAt)`; migration `20261027090000_note_saves`. A deleted note takes its saves
  with it.
- The data export has `notes/saved.json` (`noteId`, `savedAt`). Deleting the account erases the saves.

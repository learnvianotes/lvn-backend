# ADR-0052: Publishing from the phone — kinds, sharing, versions and folders

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend and Mobile agents (P3l); owner ("complete mobile")
- Spec sections: §4.2, §4.4, §13.1, §13.2; ADR-0014, ADR-0038, ADR-0043, ADR-0044

## Context

The phone keeps the account's notes offline (ADR-0038): it pulls what changed, edits locally and pushes an outbox of
operations. Everything about a note beyond its title and cards was on the web:
- publishing a version, and restoring an older one;
- who can read it, sharing with people and with all connections, and whether others may copy it;
- making a copy of someone else's note;
- its folder, tags and topics;
- and its kind: blogs, posts and projects (ADR-0014) could only be started on the web.

The owner asked for the phone to be complete. These actions must still respect offline editing: a version is a copy
of the server's draft, so publishing from a phone with unsent changes would publish something other than what the
person sees.

## Decision

1. **Kinds travel with the note.**
   - `SyncOpInput.noteKind: NoteKind` (CREATE_NOTE only; NOTE when left out). The server applies the same rule as
     `createNote`: blogs and posts are for teachers, a refusal is REJECTED with the API's message.
   - `syncPull` notes carry `kind`, `folder { id name }` and `tags { id name }`. The phone stores them (local schema
     version 2) and filters its list by kind, folder and tag offline.
2. **Note actions are online, on the server's copy.**
   - Publishing, visibility, sharing, copies, versions, folder, tags and topics call the same mutations as the web.
     They are not outbox operations: each needs the server's answer (a refusal, a new version number, a share that
     names a person), and none of them edits the cards.
   - Publishing is offered only when the note has nothing waiting in the outbox and is not new on the phone. While
     changes are unsent, the phone says so and syncs first.
   - Restoring a version replaces the draft on the server; the phone pulls at once so its copy follows.
   - Offline, these actions say they need a connection.
3. **Folder and tag names on the phone can be stale.** A note's folder name is what the last pull brought; renaming a
   folder does not touch its notes, so the phone shows the new name when each note next changes or the list is pulled
   from the start. The details screen always reads the current folders online.

## Consequences

- The sync contract gains one optional field and three note fields; old phones keep working (they send no
  `noteKind` and ignore the fields).
- A teacher's phone can start a blog post offline; if the account stops being a teacher before it is sent, the
  create is REJECTED and shows in Needs attention like any refused change.
- Folder renames reaching the phone late is accepted until folders are part of the pull (revisit if people organise
  mostly on the phone).

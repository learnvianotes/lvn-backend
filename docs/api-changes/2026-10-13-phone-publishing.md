# Note kinds in offline sync (P3l)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.27.0
- Spec: §13.2; ADR-0014, ADR-0038, ADR-0052
- Breaking: no

## What changes for clients

- `SyncOpInput.noteKind: NoteKind` — for `CREATE_NOTE` only; `NOTE` when left out. A blog or a post from someone who
  is not a teacher is REJECTED with code FORBIDDEN and the message "Blogs and posts are for teachers.", as
  `createNote` refuses it. Projects and posts start with copies switched off, as on the web.
- Nothing else in the schema changes. `syncPull` can now usefully select `Note.kind`, `Note.folder { id name }` and
  `Note.tags { id name }`; they were always there.

## What clients should do

- lvn-mobile: send `noteKind` when a blog, post or project is started on the phone; store the kind, folder and tags
  from the pull.
- lvn-web: nothing (it creates notes with `createNote`).

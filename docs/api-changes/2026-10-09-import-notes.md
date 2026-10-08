# Importing notes (Phase 2, P2g; ADR-0018)

- Date: 2026-10-09
- Package: `@lvn/contracts` unchanged; GraphQL only
- Breaking: no

## Upload, then import

1. `createUploadIntent(purpose: IMPORT)` — `application/zip`, `text/markdown` or `text/plain`, at most 200 MB.
2. `importNotes(input: { fileId })` → `NoteImportPayload { noteImport }`; five a day (RATE_LIMITED).
3. Poll `noteImports` (newest five): `status` (PENDING, RUNNING, DONE, FAILED, NEEDS_CONFIRMATION), `progress` (0–100),
   `created`, `notes` (the first 100 made: id, title), `skipped` (path and reason), `error`.
4. NEEDS_CONFIRMATION means the same file (SHA-256) was imported before: `confirmNoteImport(input: { noteId: <import id> })`
   imports it again.

## What is read

- **An LVN export** (`manifest.json` with format `lvn-export/1`): every `notes/**/note.json`, exactly — cards, title,
  kind (PROJECT kept; BLOG and POST only for teachers), folder, tags, topics, pictures and files from `media/`, and the
  fork credit with its rule (a copy of a non-public note never goes public).
- **Markdown** (Obsidian, Notion "Markdown & CSV", Joplin, plain folders) and **text**: YAML front matter (title, tags),
  then cards — headings, text with lists and marks, code (mermaid becomes a diagram), quotes, callouts
  (`> [!TIP] Title`), checklists, tables and pictures (`![](path)`, `![[file]]`), stored through the attachment checks
  (type by content, size by kind, storage quota). Folders follow the archive's folders (a folder every file shares is
  dropped). Raw HTML and links that are not http(s) or mailto are dropped; pictures from the web are not downloaded.

Everything arrives PRIVATE. Nothing social is imported.

## Safety

At most 5,000 files, 1 GB unpacked and a packing ratio of 200 (zip bombs); `..`, absolute and backslash paths fail the
import; hidden files and `__MACOSX` are skipped; front matter that cannot be read is ignored with a note in the report.

## Data

`notes.NoteImport`; migration `20261009080000_note_imports`; queue `notes.import` run by apps/worker.

# ADR-0018: Settings → Data: export everything, import notes

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §8.1, §9.1, §15.2 (Data export), §18, §19
- Amends: §15.2 Data export row; §18 Phase 2; §19 checklist

## Context

The owner wants users to **export all kinds of their data** from Settings → Data, and to **import their notes
only**. §15.2 already promises an export ("notes as Markdown + media + JSON within 24 h").

## Decision

### Export — everything about the user, one archive

**What is included.** Everything the user created or that describes them, across all five contexts:

| Context | Included |
| --- | --- |
| users | Profile, date of birth, institutional email and verification, sign-in providers (never secrets), sessions and devices (metadata), roles, follows and followers, connections, blocks and restrictions, consent records, teacher profile, skills and linked identifiers |
| notes | Every note of every kind (NOTE, BLOG, POST, PROJECT) — current draft and every published version — as Markdown with front matter plus card JSON; attachments and media originals; folders, tags, topics; shares the user granted; fork credits |
| core | Group, classroom and workspace memberships and roles; posts, ideas, doubts and answers the user wrote; their comments and reactions; reports they filed and moderation actions on their content; quizzes, attempts, flashcards and reviews; exams; learning history and events; streaks, achievements, points; resources submitted and saved |
| ai | AI usage records, AI artifacts on the user's notes, their Ask-AI questions and answers |
| communication | Notification preferences and recent notifications; registered devices (tokens masked) |

Other people's content is not included (comments others wrote on your notes are theirs); names and handles appear only
where needed to make sense of the user's own data.

**Format.** A ZIP: `README.html` (a readable index), `notes/<kind>/<slug>/index.md` + `note.json` + `media/`,
`data/<context>/<entity>.json`, and `manifest.json` (format version, counts, checksums). The Markdown front matter
(title, kind, visibility, topics, tags, dates, fork credit) is what the importer reads.

**How.** `requestDataExport` → `users` emits `DataExportRequested`; each context writes its part to temporary storage
(`FileObject`, purpose `EXPORT`) and emits `DataExportPartReady`; `users` assembles the archive and emits
`DataExportReady`; the user is told in-app and by email. Ready within 24 hours (target: minutes), downloadable for
7 days through a pre-signed URL issued per request, then deleted. One export per 24 hours.

**Rule for every future feature:** a context that stores new personal data adds it to its export part in the same
change (§19 checklist).

### Import — notes only

- Settings → Data → **Import notes** accepts an **LVN export** (only its `notes/` folder is read; everything else is
  ignored), **Markdown** files, or a **ZIP of Markdown with images** (Obsidian, Notion "Markdown & CSV", Joplin, plain
  folders), and plain text. Word and PDF come later, with the PDF text extraction of §8.1.
- Markdown becomes cards: headings, text, code (with language), images (through the normal upload pipeline: quota,
  magic bytes, malware scan, resizing), tables, quotes, callouts, checklists. Folders become LVN folders; front-matter
  tags and topics are kept.
- **Everything imported is PRIVATE** and of kind NOTE — except that, from an LVN export, PROJECT notes stay PROJECT and
  teachers' BLOG/POST notes keep their kind. Nothing else is imported: no comments, follows, groups or history.
- **Fork credit survives**: a note whose front matter says it was forked keeps a credit line that cannot be removed
  (ADR-0010) — exporting and re-importing never strips attribution.
- **Safety:** uploaded with `createUploadIntent(purpose: IMPORT)`; at most 200 MB compressed, 1 GB uncompressed and
  5,000 files (zip-bomb guard); path traversal and symlinks rejected; raw HTML in Markdown stripped; storage quotas
  apply. Runs as a background job with progress (`JobStatus`) and a report of created, skipped and failed items.
  Re-importing the same file creates nothing new unless the user confirms duplicates. Five imports a day.

**Permissions** (`@lvn/contracts` 0.7.0): `account.exportData` and `account.importNotes` — any signed-in user,
including unverified and restricted-minor accounts (it is their data). Events `DataExportRequested`,
`DataExportPartReady`, `DataExportReady`, `NotesImportCompleted`.

**Phase.** Both ship in **Phase 2** with the first notes; every later phase extends the export with its data.

## Consequences

- Meets the right of access and portability in §15.2 and DPDP for all data, not only notes.
- Users can bring notes in from other tools on day one, without importing anything social.

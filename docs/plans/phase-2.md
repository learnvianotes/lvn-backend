# Phase 2 — Content: plan

Spec §18: subjects, topics, folders, tags, notes, cards (all types), data export and notes import (ADR-0018), PDF
engine for text-layer PDFs and read aloud (ADR-0025, ADR-0028), editor web + mobile, autosave, drafts, versions,
visibility, user sharing, forking, soft delete, public note SEO page, Postgres search, moderation gate, Terms/consent,
age gate.

**Exit criteria:** the full note lifecycle end to end on web and mobile, including offline edit and sync; leakage tests
pass; Lighthouse ≥ 90 on the public note page. Shown on the local environment (ADR-0036), which is the sandbox until
the owner sets up AWS.

Started 2026-10-08. Each slice lands backend first (schema, migration, `api-changes/` note), then web and mobile
against the generated types; each slice is merged to `main` in every repo it touches, deployed to the local
environment and checked there before the next starts. Nothing is pushed until the owner says so.

## Slices

| Slice | What | Repos |
| --- | --- | --- |
| **P2a Notes core** | Prisma `notes` schema: Subject, Topic, Folder, Tag, Note, Card, NoteVersion, NoteShare, NoteTopic, NoteTag, Attachment, read models. Card content schemas for all 16 types in `@lvn/contracts/validation` (Tiptap JSON for rich text). GraphQL: create/read notes, outline + paged cards, `updateNoteDraft` (card ops with `baseRevision`, fractional positions), `publishNote`, versions and restore, folders, tags, subjects/topics (curated set seeded from the `/core` catalog; user proposals), trash and restore. `visibleNotesWhere`, `PolicyService` on every path, leakage tests in the security suite. Events `NotePublished`/`NoteUnpublished`; jobs: prune versions, empty trash | backend |
| **P2b Web notes and editor** | `(app)` shell, `/notes` with folders, tags and trash; the editor: Tiptap with one extension per card type, slash menu, outline, autosave after 2 s with an IndexedDB mirror until acknowledged, version drawer, restore; read aloud (Web Speech API) | web |
| **P2c Sharing, visibility, forking, media** | `changeNoteVisibility` (PRIVATE ⇄ SHARED ⇄ PUBLIC; publish required for PUBLIC), user shares (EDITOR/VIEWER), `forkNote` with the credit line (ADR-0010), attachments and media cards: `FileObject` grants, read URLs, image variants, audio/video processing, PDF file cards; age gate and consent checks on going public | backend, web |
| **P2d Public notes and the moderation gate** | Anonymous read path (published version only), slug URLs, Redis-cached render payload, sitemap list; web `/n/[slug]-[id]` with ISR, revalidation from the API on publish/unpublish, Open Graph image, Lighthouse CI ≥ 90. Moderation: `reportContent`, `Report`/`ModerationAction`, `PENDING_REVIEW` gate on publish (rule-based scorer behind the interface the AI scorer of Phase 5 will implement), the interim `PLATFORM_ADMIN` queue page. Terms, Privacy Policy and content licence pages, versioned, re-prompt on change | backend, web |
| **P2e Search** | `SearchProvider` with `PostgresSearchProvider` (`tsvector` over published versions + `pg_trgm`), one `search` field (notes, people, topics) filtered by the read predicate, async indexing through the `search` queue; web search page; mobile Explore search | all three |
| **P2f Mobile notes, offline and sync** | Local store and sync engine (ADR below), backend `syncPush`/`syncPull` with the §13.2 conflict rules (CONFLICT versions, fractional order, create wins, rejected deletes); notes list, reader (native rendering of card JSON), editor (ADR below), Create sheet → Note, read aloud (`expo-speech`), "needs attention" list | backend, mobile |
| **P2g Export and import** | `requestDataExport` across contexts (ZIP: Markdown + media + JSON, 7-day link, one a day); `importNotes` from LVN exports, Markdown and ZIPs of Markdown (Obsidian, Notion, Joplin), PRIVATE, with the zip-bomb and path guards; Settings → Data on web and mobile | all three |
| **P2h PDF engine** | `convertPdfToNote` (fork rule, `PDF_PAGES_MONTHLY`), triage in the Node worker (`pdfjs-dist`), `workers/pdf-engine` (Python, Docling; RapidOCR for printed scans), mapping to cards with source page, progress; side-by-side review on web; the evaluation set | backend, web |
| **P2i Exit** | Lifecycle E2E: Playwright (mocked and live) and Maestro incl. offline edit and sync; leakage tests; Lighthouse CI; `docs/releases/phase-2.md` | all three |

## Decisions to record before the slice that needs them

| ADR | Question | Leaning (research, 2026-10-08) |
| --- | --- | --- |
| Mobile local store (P2f) | §2 pins WatermelonDB | Replace with `expo-sqlite` + Drizzle ORM and our own outbox. WatermelonDB's last release is 0.28.0 (2025-04-07); Expo SDK 57 / New Architecture support exists only in community plugin forks. `expo-sqlite` is Expo's own (57.0.4, 2026-10-06); the sync protocol is ours either way (§13.2) |
| Mobile editor (P2f) | Spec leaves it open | Read natively from card JSON; edit text cards with Tiptap — `@10play/tentap-editor` (Tiptap in a WebView with a native toolbar, 1.0.1) or Tiptap 3 in an Expo DOM component (same version as the web) — decided by a spike; structured cards (code, table, quiz, flashcard, media) as native forms |
| Moderation without AI (P2d) | §15.1 assumes AI scoring; the AI gateway is Phase 5 | Rule-based scorer (links, repetition, a word list) + reports + human queue now, behind the scorer interface |
| Media processing scope (P2c) | §8.1: resize, transcode, normalise, ClamAV | Image variants with `sharp`; audio/video with `ffmpeg` in the worker; ClamAV as a container in the local environment |

## Needed from the owner (not blocking the start)

- **Terms of Service, Privacy Policy, public-content licence:** drafts will be written for review; they are legal text
  and need the owner's (or a lawyer's) approval before public notes go live.
- **PDF evaluation set (ADR-0028):** sample PDFs — slides, textbooks, question papers, Hindi and Telugu, printed scans —
  ideally ~200 pages the owner may use for testing.

## Progress

| Slice | State | Evidence |
| --- | --- | --- |
| P2a Notes core | Done 2026-10-09 | contracts 138 tests (card content, positions); notes integration: the read predicate equals the per-note rule on all 24 combinations × 5 viewers; API 145 tests incl. 17 notes e2e and the private-note privacy test; deployed to the local environment, `pnpm smoke` 12/12 |
| P2b Web notes and editor | Done 2026-10-09 | lvn-web: notes home (welcome, templates, note cards, folders, tags, trash), the card editor (bubble menu, card handle, slash menu, outline, focus mode, read aloud), autosave with an IndexedDB mirror and offline retry, history with restore, details, the reader; 70 unit tests, Playwright mocked 12/12 and live 6/6 on the local environment (desktop and phone). Backend additions: `Note.version(id)`, `Note.excerpt`; fixed the version history list without a cursor |
| P2c-1 Visibility, sharing, forks | Done 2026-10-09 | `changeNoteVisibility`, `shareNote`/`unshareNote` by handle or email, `sharedWithMe`, `forkNote` with the credit kept for good (author always, origin only while readable), `setNoteForking`; copies of non-public notes never go public, minors never go public, teachers share with teachers once connected; audit rows. API 24 notes e2e (6 new). Web: share dialog, Shared with me, Make a copy, credit line, visibility badge; Playwright mocked 20/20, live 6/6; deployed, `pnpm smoke` 12/12. Media cards are P2c-2 |

# Phase 2 — Content (closed on the local environment; AWS still deferred by the owner)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18. Plan: [phase-2.md](../plans/phase-2.md).

Scope:
- subjects, topics, folders, tags;
- notes made of 16 card types, with drafts, versions, visibility, sharing, copies and the trash;
- media cards, the moderation gate, public note pages with SEO, Terms and consent;
- Postgres search;
- the phone's offline notes and sync;
- data export and notes import;
- a **PDF reader with study notes** (owner request, ADR-0040);
- the **PDF engine** that converts PDFs into cards (ADR-0025, ADR-0028).

Everything below runs and is tested on the dev machine and on the **local environment** (ADR-0036), the stand-in for
the AWS sandbox, which the owner has deferred.

## Shipped

### lvn-backend

| Area | What | Where |
| --- | --- | --- |
| Notes core (§4) | Notes of 16 card types (Tiptap JSON checked per type in `@lvn/contracts`), fractional positions, drafts with per-card revisions and conflict versions, publish and versions, trash and restore, folders, tags, curated topics | `contexts/notes`, `contracts` |
| Sharing (§4.2, §4.4) | PRIVATE ⇄ SHARED ⇄ PUBLIC; user shares (editor or viewer); copies with a permanent credit; age gate and consent before going public | `contexts/notes` |
| Media (§8) | Uploads to notes, `NoteAttachment` links, media cards checked on save, read URLs; unlinked files purged. Since P2c-3 (ADR-0041): ClamAV scan and quarantine, picture sizes, 720p video with a poster, normalised audio, page counts, nightly reconciliation | `contexts/notes`, `apps/worker` |
| Moderation (ADR-0037) | A rule-based scorer on the way to public; reports (three hold a note); admin queue; one appeal | `contexts/core`, `contexts/notes` |
| Public pages (P2d) | `publicNotes`, on-demand revalidation of the web's ISR pages, sitemap data | `contexts/notes` |
| Search (§11) | `tsvector` over published versions plus trigram titles, filtered by the read rule at query time, indexed by a queue | `contexts/notes`, `apps/worker` |
| Sync (§13.2) | `syncPush` (idempotent operations, APPLIED/REJECTED/RETRY), `syncPull` (cursor with overlap, `liveNoteIds`) | `contexts/notes` |
| Data (ADR-0018) | One-a-day export ZIP (Markdown, JSON, media, manifest) built by the worker and kept 7 days; import from LVN exports, Markdown and ZIPs of Markdown, with zip-bomb and path guards | `contexts/users`, `contexts/notes`, `apps/worker` |
| PDF reader (ADR-0040) | A card `anchor` (page, rectangles, words) on every card type; `NoteHighlight` for the owner and editors; `noteFile` reading links by ranges; `studyPdf` under the rule for copies; anchors and highlights in export and import | `contexts/notes`, `contracts` 0.17.0 |
| PDF engine (ADR-0028) | `workers/pdf-engine` (Python: Docling and RapidOCR on CPU, triage with pdfium, cache by SHA-256); `convertPdfToNote` and its decisions (300 pages, `PDF_PAGES_MONTHLY`, one at a time); Docling JSON to cards with anchors | `workers/pdf-engine`, `contexts/notes`, `apps/worker` |
| Local environment | The engine as a container (3 GB cap); deploys prune old images; storage CORS for range reads and reads from any origin | `infra/` |

### lvn-web

The work splits across four areas.

**Notes:**
- notes home with templates, folders, tags and trash;
- the card editor (slash menu, card handle, outline, focus mode, autosave with an IndexedDB mirror, history);
- the reader, read aloud, sharing and copies;
- media cards, reporting and the moderation admin page.

**Public and account pages:**
- public note pages (`/n/[slug]-[id]`, ISR, Open Graph, JSON-LD) and the sitemap;
- the legal pages and the Terms dialog;
- search (⌘K and `/search`);
- Your data (export and import).

**The PDF reader:** `/notes/[id]/read/[fileId]`, with pdf.js beside the note. It offers highlights, adding passages and
snipped areas to the note, page chips back to the source, find, contents, Read a PDF, and Convert to cards with
progress.

**Quality:** Lighthouse runs in CI. P2i fixed a hydration bug on every public note and took the icon font off every
page.

### lvn-mobile

- **Notes:** offline (expo-sqlite, outbox, sync on open, foreground and reconnect), with "Not sent yet" and Needs
  attention.
- **Editing:** the editor (Tiptap in a DOM component for rich text, native fields for simple cards) and native reading
  of every card type.
- **Around the notes:** read aloud, Explore search, and Your data (export).
- **The PDF reader:** pdf.js in a DOM component, with highlights and adding passages offline as cards. The note opens
  in a sheet, page chips lead back to the PDF, and Convert to cards shows its progress.

## Test evidence (2026-10-09)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck, boundaries | clean (boundaries fixed in P2h: two cycles in notes) | clean | clean |
| Unit / integration / e2e | 518 passing + 9 todo across 17 packages; API 199 (incl. security 30 + 9 todo); contracts 163; notes 19 | 82 unit (Vitest) | 103 (Jest: unit, components, the reader screen) |
| Python | `workers/pdf-engine`: 11 (2 with Docling's models), ruff clean; evaluation 100 % on two generated pages | — | — |
| Browser / device E2E | — | Playwright 141 + 1 skipped on desktop and phone (mocked API, a real PDF) | Maestro 7/7 on `lvn_pixel_7`, including the reader against the VM |
| Lighthouse | — | public note 98 / 100 / 100 / 100 on phones, 100 on desktop; home 98–100 | — |
| Contract | `graphql:check`, `env:check` (45 variables) | codegen + typecheck against the current schema; contracts copies checked | same |
| Migrations | applied to an empty database, no drift | — | — |

### On the local environment (2026-10-09)

Deployed with `infra/scripts/deploy-local.sh` to `http://100.70.234.41:8080` at these commits:
- lvn-backend `c323878`;
- lvn-web `7b3c969` (later commits change tests and page weight only);
- engine image `lvn-pdf-engine:ba7b4eb92070`.

| Check | Result |
| --- | --- |
| `pnpm smoke` | 13/13 (incl. a note written and read back, and a storage CORS preflight) |
| `pnpm lifecycle` (new) | 21/21. A writes and publishes; shares with B; goes public. Anonymous visitors read the page, see it in the sitemap and find it in search. B copies it. A publishes version 2; the page follows and the old address redirects. Going private removes it from the page, search and sitemap, and B keeps the copy. A's phone pulls the note and sends an offline edit. Trash and restore |
| Playwright, live | 14/14 (desktop and phone): sign-up and sessions; a note with cards and autosave; a picture through storage; the PDF reader (highlight and passage kept after a reload); a PDF converted by the real engine (2 pages in 4.8 s cold, 0.9 s warm) |
| Maestro | 7/7 against the VM (the reader flow: a PDF note made through the API, a long press, Add to notes, the anchor on the server) |
| Phone | the development build installed on the owner's phone (arm64), pointed at the VM |
| Footprint | engine 1.6 GB of its 3 GB cap while converting; VM disk 9.4 GB of 40 GB after pruning old images |

Bugs the new suites found and fixed in this phase:
- **Hydration:** read aloud rendered differently on the server and in browsers with speech (React #418 on every public
  note).
- **Icon font:** the 507 KB Tabler font loaded on every page, and some home-page icons never showed.
- **Storage CORS:** RustFS refused uploads whose CORS rule listed its headers.
- **Uploads:** a dialog sat pinned to the top left; BullMQ job ids with colons were refused; an import path traversal
  was hidden by the hidden-file rule.
- **Two dependency cycles** in notes.
- **Settings:** two revalidation settings were missing from `.env.example`.
- **A flaky live test:** it now waits for the save that carries the edit.

## Exit criteria (§18)

- [x] **Full note lifecycle E2E on web and mobile, including offline edit and sync.**
  - On the VM: `pnpm lifecycle` 21/21 and Playwright live 14/14.
  - On the phone: Maestro `notes.yaml` (a note written in airplane mode reaches the server) and `reader.yaml`.
  - Mocked: Playwright `notes`, `public-notes`, `search`, `data` and `reader` specs.
- [x] **Leakage tests pass.** The security suite checks that B cannot reach A's private note by id, through the
  public pages, sitemaps or file links, by copying, studying or converting its PDF, through its highlights, by search,
  or through conversions and exports. A note made private also leaves public search at once.
- [x] **Lighthouse ≥ 90 on the public note.** 98 / 100 / 100 / 100 on phones and 100 / 100 / 100 / 100 on desktop
  (`pnpm lighthouse` in lvn-web, in CI).

## Needed from the owner

- **Legal texts:** the Terms, Privacy Policy and content licence at `/legal/*` are drafts with [bracketed] gaps. They
  need the owner's (or a lawyer's) approval before public notes go live.
- **The first platform admin** is made with one SQL statement (`docs/runbooks/moderation.md`).
- **PDF conversion:**
  - a monthly page limit for the FREE plan (`PDF_PAGES_MONTHLY`; none is set yet, so it is unlimited);
  - the ~200 labelled pages of the evaluation set: slides, textbooks, question papers, Hindi and Telugu, scans;
  - whether Telugu OCR is needed now: RapidOCR's current models have no Telugu, see ADR-0028.
- **AWS (still deferred).** Its Terraform needs the revalidation settings, the web's internal API URL and an ECS
  service for the PDF engine, added when the sandbox is built.

## After the exit: media processing (P2c-3)

The exit left media processing undone; P2c-3 closed it the same day (ADR-0041). Deployed with lvn-backend `26188aa`
and lvn-web `60614c5`:

| Check | Result |
| --- | --- |
| `pnpm lifecycle` | 24/24: the 21 above, then a 1200-pixel picture gets WebP sizes of 320, 960 and 1200 pixels, and an EICAR PDF is quarantined by the real ClamAV (`Eicar-Signature`) and its old read URL stops serving it |
| `pnpm smoke` / Playwright live | 13/13 / 14/14 |
| Tests | API 208 + 9 todo (9 media e2e: sizes, never enlarged, video and audio with real ffmpeg, page counts, quarantine, scanner away, damaged file, reconciliation, the clamd protocol); storage 19; web Playwright 143 and Vitest 83 |
| Footprint | ClamAV 0.96 GB of its 2 GB cap; VM 2.9 GB of 8 GB in use; server image 2.9 GB (was 2.4 GB) |

## Known gaps carried forward

**Media:**
- Not yet: same-owner deduplication by SHA-256, HLS for long videos, PDF text for search and AI (Phase 5).
- On the phone, pictures, video and audio show placeholders; PDFs open in the reader.
- Exports include media up to 300 MB.

**Phone:**
- Structured cards (tables, questions, quizzes, flashcards, diagrams) are edited on the web.
- PDFs and highlights need a connection; cards made from a PDF work offline.
- pdf.js parses on the web view's own thread, which is slower on low-end phones; to be measured on a mid-range phone.

**Not built yet:**
- People search has results but no page.
- Comments, recommendations, Ask AI and subscriptions come in later phases; their leakage checks are todos.
- PDF engine stage 4 (AI escalation for hard pages) and low-confidence flags are Phase 5.

**Infrastructure:**
- The PDF engine image is about 4 GB (CPU PyTorch and models).
- A shared JSON Schema for the engine's messages in `@lvn/contracts` is still to come.

GraphQL schema: `contracts/graphql/schema.graphql` as of `@lvn/contracts` 0.17.0.

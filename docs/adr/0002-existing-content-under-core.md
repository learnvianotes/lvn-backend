# ADR-0002: Serve the existing study content at /core

- Status: Accepted
- Date: 2026-10-08
- Spec sections: §1, §3 ("Nothing is rewritten blindly"), §12.1, §18

## Context

learnvianotes.in today serves 22 subjects (757 topics, 150 interview problems) written and verified over months.
The v2 spec rewrites the product as a community of user notes; its route map (§12.1) has no place for curated
subject notes until the `notes` context owns Subjects and Topics in Phase 2, and "Problems" is removed from scope.
Dropping the content during the rewrite would lose search traffic and the reason students visit today.

The owner asked for the existing pages to move to `learnvianotes.com/core/*` and for the app itself to be a
complete rewrite, without the old sign-in features.

## Decision

- The rewritten Next.js app serves the existing content read-only at `/core`, `/core/[subjectId]` and
  `/core/[subjectId]/[itemId]`, statically generated at build time from `content-build/` (unchanged).
- ~~The old app's code is **not** reused; rendering is re-implemented (`features/core-content/`).~~ **Amended
  2026-10-08 (owner): `/core` must look and behave exactly as before** — see *Amendment* below. No sign-in, progress
  sync, history, notes, read-aloud or focus timer under `/core`.
- Sheet 150 stays as read-only content. No new problem features are built (respects "Problems removed from scope").
- Old root URLs redirect permanently: `/<subject>/<item>` → `/core/<subject>/<item>`.
- `content-src/`, `content-build/` and the extraction scripts stay in this repo until Phase 2.

## Consequences

- Existing readers and search rankings carry over with one redirect hop.
- `/core` adds ~800 static pages to every web build (~10 s today).
- **Phase 2 follow-up:** when `notes` owns Subject/Topic, import `content-build/` into Postgres as curated topics,
  switch `features/core-content/source.ts` to GraphQL, and move the authoring kit to lvn-backend (seed data) or its
  own repo. A new ADR decides whether curated content becomes PUBLIC notes owned by an LVN account.

## Amendment (2026-10-08): `/core` is the old app, not a re-implementation

The first `/core` re-rendered the content in the new design. The owner asked for the old UI back, unchanged.

- lvn-web `core-app/` holds the old site's React app (`src/`, `schema/content.ts`) in **guest mode**. Everything that
  needed an account is removed: Firebase, sign-in pages and banners, progress sync, history, insights, settings,
  focus timer, read-aloud and the study kit. `features/auth/auth.ts` is a stub that always reports "no account";
  telemetry is a no-op. The new logo replaces the old icon files; nothing else in the UI changes.
- It mounts inside Next.js under its own root layout `app/(core)/layout.tsx` (the old `index.html`: fonts, theme
  pre-paint, splash) so none of the new site's styles reach it. Navigating between `/` and `/core` is a full page load.
  `app/(core)/core/[[...slug]]/page.tsx` renders the old app client-side with `react-router` (`basename: '/core'`), as
  the old SPA did, and still generates every path at build time with its own title, description and canonical URL.
- Content comes from static JSON instead of Firestore: `app/(core)/core/data/[...path]/route.ts` serves the same
  documents the old seeder wrote (`meta.json`, `catalog.json`, `topics/<subject>/<topic>.json`,
  `problems/<subject>/<category>.json`), converted at build time with the old `htmlToContent`
  (`core-app/server/`). The old device cache (IndexedDB, versioned by `meta.json`) works unchanged.
- The theme key `cnote:theme` is shared by `/` and `/core`, so the reader's choice carries across.
- `tests/unit/core/content-fidelity.test.ts` runs the old seeder's check on every fragment: rendered by the old
  `ContentView`, it must reproduce the source HTML exactly.
- Known accessibility findings of the old design (code-comment and callout-label contrast just under 4.5:1;
  scrollable code blocks and tables are not focusable) are kept for now so the UI is identical; the E2E test fails
  on anything else. Fixing them is a design change for the owner to approve.


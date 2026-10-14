# Phase 7 — Resources (closed on the local environment; AWS still deferred by the owner)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18, §14.4, ADR-0012 and ADR-0015. Plan:
[phase-7.md](../plans/phase-7.md).

Scope:
- **Resources:** a learning catalogue of books, courses, tools, software and hardware. People submit, moderators
  approve, and everyone searches, saves, shares, recommends and discusses. No cart, prices, affiliate links or seller
  accounts.
- **Skills import:** a teacher fills their Skills tab from public identifiers they prove are theirs, as drafts they
  review.
- **Repository activity:** a GitHub App a project workspace's team installs; commits, pull requests and issues appear
  in the workspace.

Between P7b and P7c the owner asked for both apps to be brought in line with UI board A (ADR-0076), and during P7d for
the apps to work without /core (ADR-0079). Both were built as slices of this phase.

Everything below runs and is tested on the dev machine and on the **local environment** (ADR-0036), the stand-in for
the AWS sandbox, which the owner has deferred.

## Shipped

### lvn-backend

| Slice | What | ADR |
| --- | --- | --- |
| P7a Submit and moderate | `core.Resource` (type, title, description, link and its key, ISBN-13, by, cover, 1–5 curated topics, submitter, PENDING/APPROVED/REJECTED with the moderator's reason). Verified adults submit, 10 a day and 20 waiting. `libs/safe-fetch`: http(s) on ports 80/443 only, every resolved address checked when connecting, redirects checked again (3 at most), 5 s, size bounded after decompression, tracking and affiliate parameters dropped. Previews from OpenGraph and meta tags, or Open Library by ISBN. Pictures copied into storage, never hot-linked. Every submission is a case in the platform queue; three people's reports hold an approved one | 0074 |
| P7b Finding resources | `resources` for everyone (type, topic, words; most saved or newest); saves, `indexable` from three saves; recommending to a person, a group one may post in or a class one teaches, with a reason; comments on approved resources; search's `RESOURCES` scope on Postgres and Typesense; a sixth recommendation kind, resources on exam and weak topics | 0075 |
| UI-d1 Saved notes | `notes.NoteSave`: private saves of any readable note, in the export, erased with the account | 0076 |
| UI-d2 Community feeds | `forYouFeed` (public notes on a person's topics) and `trendingFeed` (most people reacting and commenting in 7 days); `Note.previewPicture`; `StudentProfile.interests` | 0076 |
| UI-e2 Exams and groups | Search by up to 20 topics; a group's picture (`GROUP_PICTURE` uploads) | 0076 |
| P7c Skills import | `users.ExternalIdentity`: a GitHub account proved by a code in its bio or a public gist, a page by a meta tag, read only where robots.txt allows. GitHub's top projects as they are, and skills the new `READ_SKILLS` AI task reads, become drafts the teacher publishes or discards. Monthly re-check; a lost proof hides its items, removal deletes them. The export carries the Skills tab | 0077 |
| P7d GitHub App | Off until all `GITHUB_APP_*` variables are set. Connected only when the admin's own GitHub token lists the installation and it covers the workspace's repository. `POST /webhooks/github`: HMAC-SHA256 over the raw body, each delivery once, 202 at once; the worker keeps titles, logins, links and times, never code. Uninstalling unlinks and forgets | 0078 |
| P7e Exit | The Phase 7 security tests (below); a private address in a page's robots.txt check is refused as such; this note | — |

Contracts 0.46.0 (P7a) to 0.52.0 (P7d). Migrations `20261025090000_resources` to `20261031090000_github_app`. New
worker queues: `users.skills` (imports, and a nightly look for monthly re-checks due) and `core.github` (deliveries,
and deliveries older than 30 days purged).

### lvn-web

- **Resources:** `/resources` (the catalogue), `/resources/new`, `/resources/mine`, `/resources/saved`, and each
  resource's server-rendered page with schema.org data, `noindex` until three saves, and `rel="ugc nofollow noopener"`
  links. Save, Recommend, its discussion, and the platform queue's resource cases.
- **Board A** (ADR-0076): the sidebar shell with search, theme, bell and avatar; the theme-aware landing; Home; the
  note view with its breadcrumb, Fork and Share, tabs, card rail and Ask AI dock; `/saved`; Community's For You and
  Trending; quizzes one question at a time; search tabs; Exams' Upcoming, Study Plan, Progress and Notes; a group's
  floating ＋ and picture.
- **Skills import** on the teacher's Skills tab, and **repository activity** on a workspace (with `/github/setup`).
- **Without /core** (ADR-0079): `/subjects`, `/subjects/<subject>` and `/subjects/<subject>/<topic>`, server-rendered,
  with the public notes and resources on each. /core is kept behind `NEXT_PUBLIC_CORE_ENABLED`, off; its addresses and
  the old root subject addresses redirect, temporarily, to the new pages.

### lvn-mobile

- **Resources:** submit, the catalogue, Saved, recommend and discuss, from the Profile tab and Explore.
- **Board A:** Home's controls all work (search, avatar, Q&A, camera, voice, upload); the Profile tab; Settings; the
  dark focus screen; Saved notes; Community's For You and Trending; quiz paging; Explore's tabs; Exams' tabs; a group's
  floating ＋ and picture.
- **Skills import** and **repository activity**, as on the web.
- **Subjects** from Explore, each topic opening its notes.
- **The keyboard slides the screen up** (Android pan mode), so the box being typed in stays in view everywhere.

## Bugs found and fixed

Found on the way, each fixed and covered by a test:

- **On the local environment:**
  - A cover from Open Library was not copied once, because the image host is slow. Copies now get 10 s and one more
    try (P7b).
  - An exam 21 days away said "In 22 days" at 01:17 IST: countdowns counted learning days (04:00 rollover), and a new
    account's zone was UTC until its first learning events. Countdowns count calendar days in the person's zone now,
    and both apps tell the API their time zone at sign-in (P7b).
  - The entrance sent `/webhooks/*` to the web instead of the API (Caddy and the ALB rule, P7d).
  - The subjects list and the landing's grid were built while the API was away and showed nothing; they render on
    request now (no /core).
- **Lost writes:**
  - Two quick edits to a card could undo each other, on the web and the phone (UI-b, UI-d1).
  - A new flashcard's Front could be typed into the note instead: the editor took the cursor back a frame after the
    card was added. New cards now put the cursor in their first box. The live test had failed about 1 run in 10; it
    passed 80 of 80 repeats after the fix (P7e).
  - Saving the Skills tab by hand wiped imported items (P7c).
- **Forms:** on the web, practice's Cancel submitted the answers, and Next turning into Submit under the same click
  could too (UI-e1).
- **The phone:**
  - Text boxes low on a screen or in a sheet sat under the keyboard: the app draws edge to edge, where Android no
    longer shrinks the window. Android now slides the screen up (pan mode); a new post is a full-screen composer
    (UI-e1, P7e).
  - On a Samsung phone at a larger text size, bold headings sized to their own text lost their last word ("This week"
    showed "This"). Headings beside a badge or link take the row's width now. Found on the owner's phone (P7e).
  - The Profile header did not refresh after saving study details, and the refresh then lost Settings' "Saved"; the
    profile's queries replaced each other's data in the cache (UI-c, UI-d2).
- **Messages:** skills import told a teacher a private address's robots.txt forbade reading it; it now says the
  address is not on the public internet (P7e).
- **Tests:**
  - The exams and recommendations tests failed between midnight and 04:00, when the calendar is a day ahead of the
    learning day (UI-d2).
  - The federation test could not start once the users module needed the skills reader (P7e).

## Test evidence (2026-10-14)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck | clean; dependency boundaries clean | clean | clean |
| Unit / integration / e2e | 950 passing + 1 todo across 18 packages: API 463 + 1 todo, contracts 180, notes 51, users 41, ai 40 (and 23 live tests against the real model, run on their own), safe-fetch 40, core 38, storage 19, communication 15, and the libraries | 111 unit (Vitest) | 318 (Jest: unit and components) |
| Browser / device E2E | — | Playwright 453 on desktop and phone (mocked API; 93 skipped: the live specs, and /core's while it is off) | Maestro on the VM (see below) |
| `pnpm audit --prod --audit-level high` | clean (one advisory ignored with its reason) | clean | clean (two advisories ignored with their reasons) |
| Contract | `graphql:check`; `env:check` (77 variables) | codegen against the current schema; the contracts copy synced | the contracts copy synced |
| Migrations | each applied to a throwaway database, no drift | — | — |

### On the local environment (2026-10-14)

Deployed with `infra/scripts/deploy-local.sh` to `http://100.70.234.41:8080`:
- `lvn-backend:448522daf2cd` (api, worker; deployed with this note still a draft, so its tag says `dirty`);
- `lvn-web:76c4d3337915`;
- `lvn-pdf-engine:35833b87f347`.

| Check | Result |
| --- | --- |
| `pnpm smoke` | 13/13 |
| `pnpm lifecycle` | 103/103. Phase 7 adds: a book looked up on the real Open Library, unseen while it waits, approved from the queue, read by a guest with its cover from storage, found by search, saved, commented on, and deleted; B's save of A's note leaving B's Saved when it is made private; a verified fan's reaction making a note trend; a group's picture from storage; an exam's Notes finding A's note on its topic |
| Playwright, live | 67 passed + 1 skipped (Google is off on the VM), on desktop and phone. Phase 7 adds: a book found by ISBN and unseen by a guest until approved; a course found in the catalogue, saved and discussed; every sidebar entry opened by a new learner; a flashcard typed field by field keeping both sides; For You and Trending; a group's picture chosen in the browser |
| Maestro | 32/32 on this build (31 min), with the keyboard in pan mode. Phase 7 adds `resources` (a verified learner submits a course that waits for moderators), `catalogue` (finds an approved course, saves it, finds it in Saved), `saved-notes`, `community-feeds` (For You, a topic chosen in Settings), and paging in `quiz`, tabs in `search` and `exams` |

Slices were checked as they landed, each recorded in the [plan](../plans/phase-7.md#progress). Against the real
GitHub API and a real page, an unproven teacher's account and page each say what is missing (P7c). The webhook
answers the API's 404 while the App is not configured (P7d).

## Exit criteria (§18)

- [x] **Moderation on submissions.** In the security suite (`resources.security.test.ts`), a waiting resource reaches
  only its submitter and the platform's moderators, and a rejected one too, through every channel:
  - a read by id, the catalogue, search and its discussion;
  - saving, commenting, reporting and recommending it.

  The same channels show it once it is approved, so the test would see a leak. The permission matrix covers who
  submits, edits, decides, recommends and deletes.
- [x] **No commerce surface.**
  - No type, field, argument or enum value in the GraphQL schema prices, sells, stocks or carts anything.
  - The resource table has no such column.
  - Links are stored without tracking or affiliate parameters, and shown with `rel="ugc nofollow noopener"`.
- [x] **SSRF.**
  - `libs/safe-fetch` has 40 tests: blocked addresses, redirects to metadata and to names, decompression bombs,
    timeouts and robots.txt.
  - Through the API:
    - resource previews and pictures never reach this machine or a private network;
    - skills import never reads them either, whatever page a teacher claims (cloud metadata, loopback, private, CGNAT,
      IPv6 unique-local, other ports, `file:`);
    - a GitHub name only becomes `/users/<name>` on the configured API.
- [x] **Webhook signatures.** A delivery counts only with a good HMAC over its raw body, and once (`github-app.e2e`).

## Known gaps

- **Account deletion is not built.** Nothing publishes `UserDeleted`, so the erasure handlers each context has
  (resources, saves and skills among them) are tested but never triggered by a person. Recorded for the privacy phase.
- **A cover copied from a link is not virus-scanned**, unlike an upload. It is a picture checked by type and size, kept
  in storage and never executed.
- **Unattached cover uploads have no sweeper**; they stay in storage until one is added.
- **ORCID and OpenAlex import (P7c2) are not built.** They wait for the owner's ORCID client.
- **Repository activity has not run against GitHub**, only against signed deliveries and a stand-in API, because no
  App is registered yet.
- **/core is off.** Its pages, content and tests are kept; they come back with `NEXT_PUBLIC_CORE_ENABLED=true`.

GraphQL schema: `@lvn/contracts` 0.52.0 (`contracts/graphql/schema.graphql`).

## Needed from the owner (not blocking)

- **GitHub App:** register it with Contents, Pull requests and Issues set to read, and "Request user authorization
  during installation" on. Use the setup URL `${WEB_URL}/github/setup` and the webhook `${PUBLIC_URL}/webhooks/github`,
  then set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`,
  `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`. Until then, workspaces keep the public repository card.
- **ORCID:** is LearnViaNotes non-commercial (the free Public API), or will it need ORCID membership? The client is
  registered under the owner's own ORCID iD. Until then, ORCID import stays off.
- **OpenAlex key (optional):** a free key gives ten times the daily budget.
- **AWS** is still deferred: everything here runs on the local environment.

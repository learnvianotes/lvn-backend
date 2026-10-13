# Phase 7 — Resources: plan

Spec §18, §14.4, ADR-0012 (Skills import) and ADR-0015 (repository activity). Scope:
- **Resources:** a learning catalogue of books, courses, tools, software and hardware that people submit, moderators
  approve, and everyone searches, saves, shares, recommends and discusses. No cart, prices, affiliate links or seller
  accounts.
- **Skills import:** a teacher fills their Skills tab from public identifiers they prove are theirs. The result is a
  draft they review.
- **Repository activity:** a GitHub App a project workspace's team installs. Commits, pull requests and issues appear
  in the workspace.

**Exit criteria:**
- moderation on submissions;
- no commerce surface.

As in Phase 6, every slice is built and shown on the **local environment** (owner, 2026-10-13). The AWS sandbox
stays deferred.

Started 2026-10-13. The way of working is unchanged:
- each slice lands backend first, then web and mobile;
- it is merged to `main` in every repo it touches;
- it is checked on the local environment: smoke, lifecycle, live web and Maestro.

Nothing is pushed.

## What earlier phases left for this one

- **Resource enums** (`ResourceType`, `ResourceStatus`) are in `@lvn/contracts/domain` since Phase 1. `FileParentType`
  has `RESOURCE` for cover pictures.
- **Polymorphic targets** lack resources:
  - comments (`CommentTargetType`: NOTE, GROUP_POST, CLASSROOM_POST);
  - reactions;
  - reports (`ReportEntityType`);
  - search scopes.
- **Skills tab** (ADR-0012, Phase 3): `TeacherSkill` with `source` MANUAL only, and `TeacherProfile`. No
  `ExternalIdentity` yet.
- **Workspace repositories** (ADR-0015, Phase 3): `GroupRepository` with public details from the provider's REST API,
  refreshed nightly. No webhooks.
- **Recommendations** (ADR-0071): five kinds in score bands. Resources can join as a sixth kind.
- **Teacher onboarding** (ADR-0073): verified teachers are the ones whose Skills tab is public.

## Research this plan rests on

Sources gathered 2026-10-13.
- **ORCID:**
  - The free Public API is for individuals and **non-commercial use only**. A revenue-generating service needs ORCID
    membership ([public client terms](https://info.orcid.org/public-client-terms-of-service/)).
  - Credentials are registered under a person's own ORCID iD.
  - Production redirect URIs must be HTTPS.
  - Ownership is proven by 3-legged OAuth with the `/authenticate` or `openid` scope.
  - Only items the person made public are returned.
  - Limits: 12 requests/s and 25k/day anonymous.
- **OpenAlex:**
  - CC0 data. A key is optional again (docs of 12 Oct 2026).
  - Without a key, the budget is $0.10/day. Single-entity lookups are free; search is $1 per thousand.
  - Only about 1 author in 10 has an ORCID iD, so an OpenAlex author is proven through a linked ORCID or not at all
    ([rate limits](https://help.openalex.org/how-to-use-the-api/rate-limits-and-authentication),
    [author object](https://help.openalex.org/api-entities/authors/author-object)).
- **GitHub REST:** 60 requests/hour per IP unauthenticated, 5,000 per token. `GET /users/{u}` is public.
- **GitHub App webhooks:**
  - Permissions: Contents: read for `push`, Pull requests: read and Issues: read. Metadata: read is implied.
  - Every delivery is signed with HMAC-SHA256 (`X-Hub-Signature-256`) and must be answered in 10 s.
  - Deliveries are de-duplicated on `X-GitHub-Delivery`. GitHub never redelivers on its own.
  - The setup URL's `installation_id` can be spoofed and must be confirmed with the user's token.
  - App JWTs are RS256 and last at most 10 minutes; installation tokens last 1 hour.
  - Webhooks need a public HTTPS address. smee.io serves development
    ([webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks),
    [validating](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)).
- **Website ownership:**
  - A meta tag in the home page's `<head>`, re-checked over time, as Search Console does.
  - robots.txt is obeyed (RFC 9309): a 4xx allows everything, a 5xx disallows everything, and it is cached for at
    most a day.
- **Not fetched:**
  - **LinkedIn:** the User Agreement §8.2 forbids scraping.
  - **Google Scholar:** no API. robots.txt disallows `/scholar`, and Google's terms forbid automated access that breaks
    it.
- **User-submitted links:**
  - Google asks for `rel="ugc nofollow"`, holding new users' links for review, and `noindex` for content from users
    without a reputation. Spam on part of a site hurts the whole site
    ([qualify outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links),
    [prevent abuse](https://developers.google.com/search/docs/monitor-debug/prevent-abuse)).
- **Fetching a submitted URL (OWASP SSRF):**
  - http(s) only.
  - Every address the name resolves to is checked: no loopback, private, link-local, metadata or IPv6 unique-local
    addresses.
  - The connection goes to the address that was checked, which defeats DNS rebinding.
  - Every redirect is checked again. Size and time are bounded.
  - CVE-2026-61704 (link-preview-js < 4.0.4) checked one address and then fetched the name.
- **Book details:** Open Library needs no key: 1 request/s, or 3 with a User-Agent naming the app and a contact.
  `/isbn/{isbn}.json` looks a book up; covers by ISBN are limited to 100 per 5 minutes per IP.
- **What learners value:**
  - Direct evidence is thin. 76.6 % of students in one TUM survey used peer recommendations to choose courses.
  - Medical students ignored most of the resources recommended to them
    ([PMC5643842](https://pmc.ncbi.nlm.nih.gov/articles/PMC5643842)).
  - **Unvalidated:** whether ratings or written reasons help more. The plan uses short reasons ("why I recommend
    it") and saves counts, not stars. To validate, compare how often saved resources are opened with each.

## Slices

| Slice | What | Repos |
| --- | --- | --- |
| **P7a Resources: submit and moderate** | `core.Resource` (type, title, description, url, author or maker, cover picture, topics, submitter, status PENDING/APPROVED/REJECTED with a reason). Verified accounts submit. One safe URL fetcher fills the title, description and picture from the page's OpenGraph tags, and a book is looked up by ISBN on Open Library. Duplicates are caught on the normalised URL and the ISBN. Platform moderators approve or reject in the moderation queue. Approved resources are public: links carry `rel="ugc nofollow"`, and pages of resources with fewer than three saves are `noindex`. No price, store or affiliate field exists, and a test proves it. Web `/resources/new` and the queue; the phone's submit screen | all three |
| **P7b Discover: search, save, share, recommend, discuss** | `/resources` and the phone's Resources screen (from Explore). Filters by type and topic; search through Postgres and Typesense (a `RESOURCES` scope). `ResourceSave` and "Saved"; share to a person, a group or a class; `ResourceRecommendation` with a short reason; comments, reactions and reports on resources; a resource page (server-rendered on the web, with schema.org `Book`/`Course`/`SoftwareApplication`). Recommendations gain a sixth kind: resources on a person's weak and exam topics | all three |
| **P7c Skills import** | ADR-0012. `users.ExternalIdentity` (kind, value, proof, verifiedAt). Proofs: a meta tag on a personal or faculty page; a code in the GitHub profile's bio or a public gist (no credentials needed); ORCID sign-in once configured (off until the owner registers a client); OpenAlex through a linked ORCID. A worker job fetches public data, the `ai` context cleans it into `TeacherSkill` drafts (`source` ORCID/OPENALEX/GITHUB/WEBSITE, `sourceUrl`, `fetchedAt`, status DRAFT/PUBLISHED), and the teacher publishes what they choose. Monthly refresh, removal of an identifier and all its data, export and erasure. Verified teachers only | all three |
| **P7d Repository activity** | A new ADR for the GitHub App: permissions, installation per workspace, and webhooks. `POST /webhooks/github` checks the signature, records each delivery once and answers in under 10 s; the worker turns pushes, pull requests and issues into workspace activity. Installation is confirmed with the user's token. Off until the owner creates the App (app id, private key, webhook secret). Tested with payloads signed locally; on the VM, a script replays signed deliveries | all three |
| **P7e Exit** | Moderation on submissions in the security suite (a pending resource is visible only to its submitter and moderators; a rejected one to its submitter only); no commerce surface (schema and UI checks); SSRF tests for the fetcher; live web and Maestro on the local environment; `docs/releases/phase-7.md` | all three |

## Between P7b and P7c: the apps as board A draws them (owner's ask)

On 2026-10-13 the owner sent UI board A again and chose to bring both apps in line with it right after P7b (ADR-0076).
It is built in five slices, each checked on the local environment like a phase slice:
- **UI-a:** the web shell (sidebar, top bar), the theme-aware landing, and web Home.
- **UI-b:** the web note view.
- **UI-c:** the phone's Home, Profile and focus screen.
- **UI-d:** saved notes, and Community's For You and Trending.
- **UI-e:** quiz paging, Exams tabs, search tabs, and the group page's floating ＋.

## Decisions to record before the slice that needs them

| ADR | Question | Leaning |
| --- | --- | --- |
| Resources (P7a), ADR-0074 | Which context; who submits; how moderation runs; what is fetched | `core` (beside comments and reactions). Verified accounts submit, at most 10 a day. Every submission waits for a platform moderator, since links are the spam risk. One `SafeFetcher` in a library (DNS checked, connect to the checked address, redirects re-checked, 1 MB and 5 s). Pictures are copied into storage and never hot-linked |
| Discover (P7b), ADR-0075 | Ratings or reasons; recommending to groups | Saves counts and short reasons, no stars (see research). Recommending to a group or class goes to its feed, and to a class only by staff |
| Skills import (P7c) | Proofs without paid APIs; how AI cleaning is bounded | Meta tag and GitHub bio/gist codes need no credentials. ORCID stays off until the owner chooses free non-commercial use or membership. AI sees only the fetched public text; drafts never publish themselves |
| GitHub App (P7d) | Permissions and what is stored | Read-only Contents, Pull requests and Issues. Store the activity (title, author login, link, time), never code. Uninstalling removes the installation and stops the feed |

## Needed from the owner (not blocking)

- **ORCID:** is LearnViaNotes non-commercial (the free Public API) or will it need ORCID membership? The client is
  registered under the owner's own ORCID iD. Until then, ORCID import is off.
- **GitHub App:** create the App on GitHub (the plan gives the permissions and the webhook path) and put its id,
  private key and webhook secret in the environment. Until then, repository activity is off and workspaces keep
  today's public repository card.
- **OpenAlex key (optional):** a free key gives ten times the daily budget.

## Progress

| Slice | State | Evidence |
| --- | --- | --- |
| P7a Resources: submit and moderate | Done 2026-10-13 | ADR-0074. `core.Resource` (type, title, description, link and its key, ISBN-13, by, cover, 1–5 curated topics, submitter, PENDING/APPROVED/REJECTED with the moderator's reason); no commerce columns, checked by a test. `libs/safe-fetch`: http(s) on 80/443 only, every resolved address checked at connect time (loopback, private, CGNAT, link-local and metadata, multicast, reserved, IPv6 unique-local, mapped and tunnelled), redirects checked again (3 at most), 5 s, size bounded after decompression; links normalised (tracking and affiliate parameters dropped). `resourcePreview` reads a page's OpenGraph and meta tags or Open Library by ISBN (authors from the work when the edition has none); `submitResource` (verified adults; 10 a day, 20 waiting), `updateResource` (resubmits a rejected one), `deleteResource`, `resource` (guests read approved ones), `myResources`, `resourceTopicOptions` (curated only); pictures copied into storage, never hot-linked; COVER uploads opened. Every submission is a case in the platform queue; APPROVE, REMOVE (reject, reason required) and DISMISS; three people's reports hold an approved one; the `RESOURCE` notification; export and erasure. Web: `/resources/new`, `/resources/mine`, `/resources/<id>` (noindex; `rel="ugc nofollow noopener"`), edit, the queue's resource cases. Phone: the same screens from Account, and resource cases in its platform queue. API note `2026-10-13-resources.md`; contracts 0.46.0; new env `OPEN_LIBRARY_URL`, `OPEN_LIBRARY_COVERS_URL`, `SAFE_FETCH_ALLOW_HOSTS` (refused in production). Tests: safe-fetch 35 (blocked addresses, redirects to metadata and to names, gzip bomb, timeouts), resources e2e 9 (preview, Open Library, moderation, duplicates, SSRF through the API, no commerce columns), the permission matrix and the security matrix (resources); backend 922 + 1 todo across 19 packages (API 437 + 1 todo; the learning-history /core check failed once under the full run's load and passed alone); web unit 105, Playwright 399; phone Jest 285 (seven component tests timed out once under load and passed on the rerun). Local environment: smoke 13/13; lifecycle 95/95 (a book looked up on the real Open Library, waiting unseen, approved from the queue, read by a guest with its cover from storage, deleted); live 57/57 + 1 skipped (a book found by ISBN, unseen by a guest until approved); Maestro 29/29, with a new `resources` flow (a verified learner adds a course with a curated topic from the Profile tab, and it waits for moderators) |
| P7b Finding resources | Done 2026-10-14 | ADR-0075. `resources(filter: type, topic, words; sort POPULAR or NEWEST)` for everyone, guests included, blocked people's left out; `ResourceSave` (`saveResource`, `unsaveResource`, `savedResources`, `saveCount`, `viewerSaved`, `indexable` from three saves); `ResourceRecommendation` to a person (followed, connected, or sharing a group or class; a child account only from their classes), a group one may post in, or a class one teaches, with a reason through the word check, removed by its sender, recipient or the place's moderators; a `RESOURCE` notification (`kind: RECOMMENDED`); comments on approved resources (`CommentTargetType.RESOURCE`, as public notes, no reactions); search's `RESOURCES` scope on Postgres and Typesense (a `resources` collection fed by `ResourceChanged` through the new `RESOURCE_SEARCH` facade; only approved resources are found, checked again when shown); a sixth learning-recommendation kind `RESOURCE` (the most saved resources on exam and weak topics). Found on the local environment: a cover from Open Library was not copied once (the image host is slow); picture copies now get 10 s and one more try, and a failure is logged. At 01:17 IST the `exams` flow saw "In 22 days" for an exam 21 dates away: countdowns counted learning days (04:00 rollover) and a new account's zone was UTC until its first batch of learning events. Countdowns now count calendar days in the person's zone, and both apps tell the API their time zone at sign-in. Web: `/resources` (catalogue, server-rendered page with schema.org data and `noindex` until three saves), `/resources/saved`, Save and Recommend on a resource, its discussion, Resources tabs on groups and classes, resources in ⌘K and on `/search`, in Recommended. Phone: the same, from the Profile tab and Explore. API note `2026-10-14-resource-catalogue.md`; contracts 0.47.0. Tests: resource catalogue e2e 7, Typesense resources parity, the security matrix (recommend); backend 932 + 1 todo (API 446 + 1 todo); web unit 105, Playwright 409 (the signed-in header overflowed at 768 px until the Resources link moved to laptop widths); phone Jest 289. Local environment: smoke 13/13; lifecycle 96/96 (search finds the approved book, a save and a comment); live 59/59 + 1 skipped (a learner finds an approved course in the catalogue, saves it and comments); Maestro 29/30 in the full run, with a new `catalogue` flow (a verified learner finds an approved course, saves it, and finds it in Saved); `exams` failed at 01:17 IST (the countdown above) and passed after the fix at 01:45 IST |
| UI-a Web shell, landing and Home (board A) | Done 2026-10-14 | ADR-0076. Signed-in pages: the sidebar from 1024 px, a menu drawer below, with Home, My Notes, Explore, Subjects, Groups, Classrooms, Exams, Rhythm, Resources, Community, AI Assistant, Bookmarks, Upload a PDF and Create Note; the top bar has search, the theme, the bell and the avatar. Public pages show the same frame to someone signed in, and the server still renders the visitor's frame. The landing's hero follows the theme (lavender, or the night sky): Get Started Free, Google with the terms line, six feature tiles, and Features, Subjects and Community for visitors. Home: a greeting by time of day, Continue learning, the next exam with View Plan, the weekly goal, today and the week, recommendations as pictures, and Your rooms. The owner's no-dead-controls ask, and the sweep's web findings: Ask AI from the search field, labels for the Rhythm buddies and Resources settings, buddy notification text, no `mailto:[…]` links, and no greyed-out /core video button. Tests: `shell.spec.ts` (every sidebar entry leads to a page that exists; Create Note, Upload a PDF to the reader, search, the avatar, the menu on phones, the frame on public pages, every landing link) and a live crawl (a new learner opens every sidebar entry on the deployed stack: a heading on each page and no failed query); web unit 107, Playwright 422 (one groups test timed out under load and passed 3/3 alone). Local environment: live 61 passed + 1 skipped (52 in the full run; the 9 that clicked the old header's "My notes" or expected the old greeting were updated and passed on the rerun). One accessibility fix found live: Home had two regions named "Today" |
| UI-c Phone: every control works, Profile and focus (board A) | Done 2026-10-14 | ADR-0076. Home: the search bar opens Explore ready to type; the avatar (the person's initial, not a fixed "M") opens the Profile tab; Q&A opens Ask AI; Camera turns a photo into notes; Voice records a voice note; Upload puts a PDF, picture, video or recording in a new note named after it (a PDF opens in the reader). The create sheet's Upload, Quiz and Flashcards did nothing: Upload is the above, and Quiz and Flashcards start a note with that card. Recommendations to revise a topic or be quizzed on it open its notes in Explore. The Profile tab: the person, department and year, notes, followers and following, then My notes, Saved resources, My groups, My classrooms, Learning history and the rest; the account moves to Settings behind the gear (export and import notifications open it). Focus mode's dark screen: a large timer and ring, Pomodoro, Short Break and Long Break, Pause (the time so far counts) and Resume. Labels for the Rhythm buddies and Resources settings, buddy notification text, and the prototype's unused placeholder screen and mock data removed. Tests: phone Jest 303 (the create actions and Home's controls, the Profile tab's rows and counts, Settings, the focus screen, Explore's entry points, every recommendation opening something, notification routes, settings labels). Local environment: Maestro 32/32. 30 passed in the full run (home, create-sheet, focus, account, auth and tabs updated for the new screens); `smoke` timed out on the first launch after install and passed on the rerun. `account` found two real bugs, both fixed and covered by a component test: the Profile header did not refresh after saving study details, and the refresh then remounted Settings' form, losing "Saved" (the two queries cached the id-less profile with different fields). It passed after the fixes |
| UI-b Web note view (board A) | Done 2026-10-14 | ADR-0076. The breadcrumb (subject › topic › note); Fork and Share (copies the link) for readers; tabs Content · AI Summary · Flashcards · Quiz · Discussions, each offered only with something in it or a way to make it (Summarise / Make flashcards / Make a quiz with AI; Add a flashcard / Add a quiz for editors; studying a note's flashcards from its tab), kept in `?tab=` (a comment's notification opens Discussions); the card rail with Previous and Next in place of the outline column; Ask AI docked from 1280 px with one-tap suggestions (each an existing task), a question about the note and the viewer's results. Fixes found on the way: the card editors' stale writes (two quick edits undid each other) and public pages mounted again when the app's frame arrived. Tests: `note-view.spec.ts` (breadcrumb, offered tabs, Add a flashcard saved, keyboard and `?tab=`, Summarise and every docked suggestion, no dock below 1280 px or on phones, Fork, Share, the rail, Discussions, an edit kept across tabs, a flashcard typed field by field keeps both sides — 16/16 repeated), a frame-switch test on Unsubscribe; web unit 111, Playwright 438. Local environment: live 61 passed + 1 skipped (the full run found the stale-write and frame bugs and two checks that read the dock's or an old queue page; after the fixes 60 passed, and a learning-events check that timed out under load passed twice alone) |

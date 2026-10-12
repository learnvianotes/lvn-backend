# Phase 3 — Community (closed on the local environment; AWS still deferred by the owner)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18. Plan: [phase-3.md](../plans/phase-3.md).

Scope:
- notifications and live updates;
- people: follows, block and restrict; teachers: connections and the Skills tab;
- groups with roles; classrooms with the teacher role; project workspaces with mentors;
- comments and reactions; the Following and activity feeds;
- push, email and notification preferences;
- reporting and moderation in the scope of each group, class and the platform.

Everything below runs and is tested on the dev machine and on the **local environment** (ADR-0036), the stand-in for
the AWS sandbox, which the owner has deferred.

## Shipped

### lvn-backend

| Slice | What | ADR |
| --- | --- | --- |
| P3a Notifications | `comms.Notification` written from integration events; `notifications`, `unreadNotificationCount`, `markNotificationsRead`; a graphql-ws endpoint at `/graphql/live` beside the gateway, one `live` subscription carrying ids, Redis pub/sub between API instances | 0042 |
| P3b People and teachers | Follows (never a restricted minor), remove follower, block, restrict; profiles by handle with `relation.viewerCan`; exact counts for oneself, milestones for others. Teacher connections by request, sharing with connections kept live, teacher blogs, posts and projects, the Skills tab | 0043, 0044 |
| P3c Groups | Privacy and join policy, requests, roles below one's own, mute, hand-over, pinned posts, notes shared to a group through notes' read model | 0045 |
| P3d Classrooms | Eight-character codes that admit nobody, requests answered by staff, invites, roles and hand-over, announcements, notes shared to a class | 0046 |
| P3e Comments and reactions | Comments on notes, group posts and announcements (one read rule through `NOTE_ACCESS`), one level of replies, class threads between a student and the staff, approval for restricted people; Like, Helpful, Celebrate | 0047 |
| P3f Project workspaces | `PROJECT` groups: a repository card from GitHub or GitLab, ideas ranked by reactions, doubts with answers, mentor invites, a showcase note that credits the team | 0048 |
| P3g Feeds | The Following feed and the activity feed of one's groups and classes, read-time with keyset pages, without blocked people | 0049 |
| P3h Push and email | Devices, preferences per category, quiet hours; FCM HTTP v1 with ids-only data; class announcement emails and a weekly digest with one-click unsubscribe | 0050 |
| P3i Scoped moderation | Reports on comments, posts, ideas, announcements, doubts and groups, each in its scope's queue (a group's moderators and mentor, a class's staff, the platform's admins); hide, remove, warn, dismiss, approve; held comments; one appeal; MODERATION notifications | 0051 |

Notifications cover shares, verification, exports and imports, follows, connections, join requests and answers,
class invites and announcements, comments and replies, mentor invites, doubts and moderation.

### lvn-web

- **People:** server-rendered profiles at `/u/[handle]` (teachers indexed), Follow, Connect and the menu to restrict,
  block or report; Your people; people in search and ⌘K.
- **Places:** `/groups`, `/classes` (with join by code or link), project workspaces with ideas, doubts and credits,
  `/community` with the Following and activity feeds.
- **Talking:** discussions under notes, posts, announcements and public note pages, with reactions.
- **Notifications:** the live bell, `/notifications`, notification settings, the unsubscribe pages.
- **Moderation:** report on everything one can see; Reports tabs for group moderators and class staff; the platform
  queue with every scope; authors see why and appeal once.

### lvn-mobile

- **Community tab:** Activity, Following, Groups & classes; group, class, workspace and doubt screens; join by code.
- **People:** profiles with follow, connect, block, restrict and report (a sheet: Android's alert holds three buttons).
- **Talking:** discussions and reactions on notes, posts and announcements.
- **Notifications:** the live bell and list, push registration when allowed, "Turn on" in context, notification
  settings.
- **Moderation:** report sheets, author notices with the appeal, Reports tabs for group moderators and class staff.

## Test evidence (2026-10-13)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck | clean (61 tasks) | clean | clean |
| Unit / integration / e2e | 634 passing + 3 todo across 17 packages: API 299 (security 46 + 3 todo), contracts 167, users 41, notes 21, storage 19, communication 15, and the libraries | 91 unit (Vitest) | 151 (Jest: unit and components) |
| Browser / device E2E | — | Playwright 249 on desktop and phone (mocked API) | Maestro 11/11 on `lvn_pixel_7` against the VM |
| Contract | `graphql:check` and `env:check` (51 variables; it had failed since P3f, fixed in P3j) | codegen and typecheck against the current schema; contracts copies checked | same |
| Migrations | applied to an empty database, no drift | — | — |

### On the local environment (2026-10-13)

Deployed with `infra/scripts/deploy-local.sh` to `http://100.70.234.41:8080`:
- `lvn-backend:1131bcd4d2b4` (api ×2, worker), the P3i code; later commits change tests, documents and `.env.example`;
- `lvn-web:4cf737e0ff42`, the P3i code; later commits add tests;
- `lvn-pdf-engine:ba7b4eb92070`.

| Check | Result |
| --- | --- |
| `pnpm smoke` | 13/13 |
| `pnpm lifecycle` | 55/55. Phase 2's note lifecycle; four sockets of one person, held by both API instances, all hear of a share; follows and blocks; two teachers connect and share; a private group and a class, with requests, announcements and shared notes only their members read; comments and replies with their notifications; a workspace with a mentor and a doubt; the Following and activity feeds; a held comment removed by a TA; a workspace post hidden, appealed and put back; B cannot report inside a private workspace |
| Playwright, live | 26/26 on desktop and phone: Phase 2's flows; a learner joins a class with its code, comments privately, unsubscribes from the announcement email through Mailpit; a project workspace with a mentor and a doubt; a learner finds a public group, joins it and posts; a group's owner hides a reported post from the Reports tab and puts it back after the appeal |
| Maestro | 11/11 against the VM, with a new community flow: a verified learner finds a public group, joins it, posts and reports the owner's post (`--vm` makes the accounts) |

Bugs the new suites found and fixed in this phase:
- **Live updates:** Hermes has no `Intl.RelativeTimeFormat`; the web header overflowed on 360–412 px phones (P3a).
- **Read models:** concurrent writes raced; they now insert with `createMany skipDuplicates` (P3c).
- **Class roles:** the membership event carried the contract role instead of the stored one (P3d).
- **Data export:** groups, classes, posts, comments and reactions were missing (P3e).
- **"Show older":** posts, announcements, comments and feeds replaced the page instead of appending it (P3g).
- **Push:** fetching the token fired the token-change event, which fetched it again: an endless loop of
  registrations (P3h).
- **Android menus:** a profile menu of four actions lost one, since the native alert holds three buttons (P3i).
- **Settings:** five settings from P3f and P3h were missing from `.env.example` (P3j).

## Exit criteria (§18)

- [x] **Join, post and moderate flows end to end.**
  - On the VM: lifecycle 55/55 (joins, posts, comments, a held comment, a hide, an appeal); Playwright live (a class
    joined by code, a public group joined and posted in, a reported post hidden and put back from the Reports tab).
  - On the phone: Maestro `community.yaml` (join, post, report), `classes.yaml`, `people.yaml` (report a person).
  - Mocked: Playwright `groups`, `classes`, `workspaces`, `discussion`, `community`, `moderation` specs; Jest
    components for each screen.
- [x] **Subscription fan-out across two API instances.** On the VM, four sockets of one person through the entrance
  are held by both API instances and all four hear of a share (lifecycle check 6); in the API suite, two instances on
  one Redis.
- [x] **The permission matrix fully tested.**
  - `can()` row by row in `@lvn/contracts` (167 tests).
  - Through the API, action by action (`apps/api/test/security/matrix.security.test.ts`): every community action
    (groups, workspaces, classrooms, people, teachers, reports and moderation) is refused to someone the matrix
    refuses and allowed to someone it allows. A new action without cases fails the suite. Quizzes and class
    performance arrive in Phase 4.
  - The leakage suite: B sees nothing of a group or class B is not in; a post moderators hid reaches no other member;
    an author never learns who reported them; no role is taken through any mutation.

## Needed from the owner

- **Push:** the Firebase project's service account (`FCM_SERVICE_ACCOUNT_JSON`) and `google-services.json`. Until
  then push is built and tested against a stand-in FCM, and in-app notifications work without it.
- **Limits** in the FREE plan: `GROUPS_OWNED`, `GROUP_MEMBERS`, `CLASSROOMS_OWNED`, `CLASSROOM_MEMBERS`,
  `PROJECT_WORKSPACES`. Without rows there are no limits.
- **Optional:** a GitHub token for repository cards (60 requests an hour without one).
- **To confirm:** follower counts as milestones for others (ADR-0043); TAs admitting students (encoded: yes).
- Carried from Phase 2: the legal texts, the PDF page limit and evaluation set, Telugu OCR, the AWS sandbox.

## Known gaps carried forward

**Moderation:**
- Account warnings are recorded but not shown to the person, and suspension is not built (ADR-0037).
- A removed group's owner is told it was removed but not why; groups cannot be appealed.
- The platform queue is on the web only (the phone has the group and class queues).

**Phone:**
- Group settings, roles and member removal are changed on the web.
- Blogs, posts and projects are started on the web.

**Not built yet:**
- Mentions in comments.
- Feeds are read-time queries; a precomputed timeline waits for measurements.
- Quizzes and class performance (Phase 4).
- The owner's notes for Phase 5 are recorded in ADR-0025: quizzes, flashcards and revision sheets generated from notes.

GraphQL schema: `contracts/graphql/schema.graphql` as of `@lvn/contracts` 0.26.0.

# Phase 8 — Engagement (closed on the local environment; AWS still deferred by the owner)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §18 Phase 8, as amended by ADR-0030. Plan:
[phase-8.md](../plans/phase-8.md), with the research it rests on.

Scope:
- achievements, a points ledger and contributor levels;
- weekly tasks;
- cooperative goals for a class and for Rhythm buddies, in place of leaderboards;
- weekly contests and a Quizzes page;
- the mock-interview data model, with no feature on it.

Everything below runs and is tested on the dev machine and on the **local environment** (ADR-0036), the stand-in for
the AWS sandbox, which the owner has deferred.

## Shipped

### lvn-backend

| Slice | What | ADR |
| --- | --- | --- |
| P8a Achievements, points and contributor levels | `core.PointsEntry`, an append-only ledger in which every award and reversal happens once. Points come only from other people's actions on public work: a reaction on a public note (+1), a fork of it (+5), a resource moderators approve (+10). Trust gates: a verified, unsuspended account at least a week old, not blocked either way, at most five times a week towards one person; reactions earn at most 50 a day. Points are taken back with the reaction, the note's publicity or the resource. Levels: Contributor at 50 and Trusted at 250 (20 resources a day). `core.Achievement`: topics mastered, quiz master, exam ready, Rhythm weeks and subject contributor, each tier once, checked by the `core.engagement` job and told in the app only (`ACHIEVEMENT`, never pushed). Private unless an adult shows them | 0080 |
| P8b Weekly tasks and cooperative goals | `core.WeeklyTask`: up to three a week with a when-and-where plan, progress read from learning, and suggestions from exams, weak topics and cards due. `core.ClassGoal`: a pooled weekly goal of counted days, set or sized from the class, each student counting up to a share; the total for everyone and each part for teachers. Buddies see their week together | 0081 |
| P8c Weekly contests | `core.Contest`, `ContestQuestion`, `ContestAttempt` and `ContestAnswer`. Platform admins write and publish. One attempt each, timed by the server, with its own question and choice order. The answer key comes only once the attempt is over. Scores and personal bests are the person's. An adult who asks gets a band among adults once the window closes; nobody under 18 is in a band or given one. Participants show as milestones | 0082 |
| P8d Mock interviews, the data model only | Templates, questions, rubric criteria, slots, interviews and feedback, with no API and nothing about companies or hiring | 0083 |
| P8e Exit | The engagement security tests (below); this note | — |
| Owner ask: notes from up to ten photos and PDFs | A quick note reads up to 10 photos and the text of up to 10 PDFs and makes one note across them. With more than four photos, each is first read on its own, as a local model's context fits about four. Pictures are resized on the device | 0084 |
| Owner ask: AI reads photos, PDFs and recordings | Every AI tool and Ask AI read a note's words with what its photos say (read once, kept 30 days), its PDFs' text and the asker's transcripts | 0085 |
| Owner ask: proper translations | Plain text in pieces of about 1,500 characters, each checked to be in the chosen script and asked again if not; LaTeX mended in every answer | 0086 |
| Owner ask: Home's line for the day | `dailyLine`: a headline and a sentence written by AI for the person once a learning day, from their week, next exam, last note and a topic to strengthen; one of 21 chosen lines until then or with AI off | 0087 |

Contracts 0.53.0 (P8a) to 0.57.0 (the line for the day). Migrations `20261101090000_engagement` to
`20261104090000_mock_interviews`. New worker queue: `core.engagement` (achievements, a little after learning or
points change).

### lvn-web

- **Achievements** at `/achievements`: the level and how far the next is, the badges, the points history (each line
  opening what earned it), and showing them on the profile for an adult. A profile shows an adult's shown achievements
  and level, and the account links to the page.
- **Rhythm:** this week's tasks (from suggestions or chosen, with a plan); each buddy's week together.
- **Classes:** the class goal on the Rhythm tab, with each part and the target for teachers.
- **Board A's Quizzes and Contests** in the sidebar.
  - Contests shows the open one as the board's card. A contest is started, answered against the clock, and explained
    after.
  - Quizzes gathers the contest, class quizzes waiting, practice and recent results.
  - Platform admins write contests at `/admin/contests`.
- **Notes from photos** on Notes: up to ten photos and PDFs, dropped or chosen, compressed in the browser, then one
  note with its AI panel open.
- **Home's night-sky card** shows the day's line.

### lvn-mobile

- The Profile tab's **achievement row** and the Achievements screen.
- **Rhythm:** weekly tasks and buddies' week together.
- **Classes:** the class goal.
- **Contests:** from Explore, and Home's card while one is open. A contest is started, answered against the clock, and
  explained after.
- **Photo** on the create sheet opens a tray: the camera again and again, several photos from the library, files; up to
  ten, compressed, uploaded with progress and resumed after a failure, then one note.
- **Home's hero card** shows the day's line.
- **Bottom sheets** ease in without a bounce. A group's Posts and Notes have Select (or a long press) to delete
  several posts, or take out one's own shared notes, at once.

## Bugs found and fixed

Found on the way, each fixed and covered by a test:

- **AI on notes made from photos or recordings:** Translate and every AI tool said "This note has nothing to work on
  yet" on a note of photos (its quick note not kept) or a voice note, because tasks read only typed words. They now
  read what the photos say, the PDFs' text and the transcripts (ADR-0085).
- **Translations:** a Telugu translation of a photo note came back in English but for its title, with broken LaTeX.
  Translate now answers in plain text, in checked pieces, each confirmed to be in the language's script (ADR-0086).
- **The phone:** bottom sheets rose on a spring that overshot, so they jumped; they ease in now.
- **Tests:**
  - A live test vouched for a new teacher before people search had indexed them; it waits for search now (P8b).
  - Maestro's `focus` waited for the week card that weekly tasks now push down, and `home` scrolled past an open
    contest's card (P8b, P8c). Flows wait for Home's card by id since the day's line changes daily.
  - The translation unit test imported a module dynamically without the `.js` extension, which `typecheck` refused
    (found at the exit; now a static import).
  - The API suite ran out of memory as one Jest run; it runs in four chunks of two workers now. The phone suite
    timed out in four suites while a build ran alongside; alone, all passed.

## Test evidence (2026-10-14)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck | clean; dependency boundaries clean | clean | clean |
| Unit / integration / e2e | 985 passing + 1 todo across 19 packages: API 488 + 1 todo, contracts 180, notes 51, ai 45 (and 23 live tests against the real model, run on their own), users 41, safe-fetch 40, core 38, storage 19, communication 15, and the libraries | 114 unit (Vitest) | 332 (Jest: unit and components) |
| Browser / device E2E | — | Playwright 473 on desktop and phone (mocked API; 93 skipped: the live specs, and /core's while it is off) | Maestro on the VM (see below) |
| `pnpm audit --prod --audit-level high` | clean (one advisory ignored with its reason) | clean | clean (two advisories ignored with their reasons) |
| Contract | `graphql:check`; `env:check` | codegen against the current schema; the contracts copy synced | the contracts copy synced |
| Migrations | each applied to a throwaway database, no drift | — | — |

### On the local environment (2026-10-14)

Deployed with `infra/scripts/deploy-local.sh` to `http://100.70.234.41:8080`:
- `lvn-backend:5cfe66b19bc0` (api, worker; deployed with this note still a draft, so its tag says `dirty`);
- `lvn-web:350fe4e03c65`;
- `lvn-pdf-engine:35833b87f347`.

| Check | Result |
| --- | --- |
| `pnpm smoke` | 13/13 |
| `pnpm lifecycle` | 108/108. Phase 8 adds: a trusted reader's reaction earning the author a point, taken back when the note goes private; a weekly task with a plan; a class goal whole for a student and in parts for its teacher; an admin publishing a contest that a learner takes without the answer key, then reads every answer explained |
| Playwright, live | 67 passed + 1 skipped (Google is off on the VM), on desktop and phone |
| Maestro | 36/36 on this build (33 min), every flow. Phase 8 adds `achievements`, `tasks`, `contests` and `capture` (two photos with the emulator's camera, then one note), and Home's flows wait for the hero card by id |

Slices were checked as they landed, each recorded in the [plan](../plans/phase-8.md#progress). Against the real model
(gemma4 on the local environment): six photos and a PDF made one note in 15 s, and were translated into Telugu in 6 s;
Home's line for the day was the person's own 6 s after the chosen one.

## Exit criteria (§18)

- [x] **Anything ranked excludes minors by default.**
  - The only ranked thing is a contest band, and only for an adult who asks, once the window has closed.
  - In the security suite (`engagement.security.test.ts`), a band never goes to an under-18 and never counts one,
    whatever is stored. The test is built so that counting the minors would change the adult's band.
  - A minor's achievements and level are never shown to anyone else.
  - Nothing else ranks: class and buddy goals are totals (ADR-0081), and there is no leaderboard (ADR-0030).
- [x] **No company features.**
  - No type, field, argument or enum value in the GraphQL schema is about companies, jobs, hiring, careers, referrals
    or interviews.
  - The mock-interview tables exist with no API (ADR-0083), and nothing about companies or hiring is among them.

## Known gaps

- **Achievements are checked by a worker job** a little after learning or points change. The API tests run the check
  directly; on the local environment it follows the job.
- **A ring of verified, week-old accounts** can still trade a few points. The weekly limit per pair and the daily cap
  keep it small; ring detection is for Phase 9's review.
- **Republishing doesn't bring points back.** A note made private loses its points; republished, it earns anew from new
  reactions.
- **Contests have no questions until someone writes them.** Writing them is admin work; until then the Contests page
  says none is open.
- **A contest attempt past its deadline** is marked when it is next read, not at the deadline.
- **Mock interviews:** the tables exist, with no feature on them.
- Carried over from Phase 7:
  - account deletion is not built;
  - covers copied from links are not virus-scanned;
  - unattached covers have no sweeper.

GraphQL schema: `@lvn/contracts` 0.57.0 (`contracts/graphql/schema.graphql`).

## Needed from the owner (not blocking)

- **Counsel on India's DPDP Act s.9(3):** whether achievements and points for under-18s count as "behavioural
  monitoring". Until then, a minor's are visible only to them.
- **Contest questions:** who writes the first contests (platform admins write them at `/admin/contests`).
- **AWS** is still deferred: everything here runs on the local environment.

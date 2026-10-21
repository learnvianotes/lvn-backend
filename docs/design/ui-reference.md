# UI reference

Two mock-up boards were shared by the owner on 2026-10-08. They set the visual direction for lvn-web and lvn-mobile.
They are **references, not specs**: anything they show that the architecture spec does not cover is listed under
"Needs a decision" and is not built until an ADR accepts it.

> Board A is [`reference-a-learnvianotes.jpeg`](reference-a-learnvianotes.jpeg) (the owner sent it again on
> 2026-10-13). Board B, when found, goes in `docs/design/reference-b-studysphere.png`.

| Board | What it is | Use |
| --- | --- | --- |
| **A — LearnViaNotes** (primary) | Web landing, web app shell, note view, mobile home, editor, community, group, AI assistant, quiz, profile, focus mode, exam prep, contest, global search, admin analytics | Brand, layout and screen inventory |
| **B — "StudySphere"** (secondary) | An unbranded sample: onboarding, feed, notes list, note detail with AI summary, upload, community, live room, AI assistant, profile | Layout ideas only. The product name is **LearnViaNotes** everywhere |

## Brand

- **Name:** LearnViaNotes — app name, web title, store listing, emails — always written in full in headers, with
  "Notes" in the brand colour. Development builds are "LearnViaNotes Dev" and "LearnViaNotes Sandbox".
- **Logo (2026-10-08):** an open notebook with smooth curved pages, note lines, a check ("learned") and a small spark
  ("insight") on the blue gradient tile *[ADR-0094: was indigo]*. One set of shapes, `logo-paths.json`, lives in lvn-mobile
  (`assets/brand/`, renders the app icon, adaptive/monochrome icons and splash) and lvn-web (`branding/`, renders the
  favicons and PWA icons); both copies stay identical until the shapes move into `@lvn/contracts`.
- **Feel:** light, soft and rounded; cool, quiet backgrounds, white cards, one blue accent, warm illustrations,
  dark night-sky hero cards for focus and live moments. **No purple, lavender, indigo or violet anywhere** (owner,
  2026-10-21, ADR-0094); the board's indigo is replaced by the brand blue.
- **Tokens** (read off the boards; confirm against the source files):

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `accent` | `#2563EB` | `#60A5FA` | Primary buttons, active tab, links |
| `accent-soft` | `#EFF6FF` | `#172554` | Chips, selected rows, icon tiles |
| `bg` | `#F6F8FB` | `#0D1117` | Page background |
| `surface` / `surface-2` | `#FFFFFF` / `#F1F4F8` | `#161B22` / `#1F2630` | Cards, sheets |
| `fg` / `muted` | `#111827` / `#5B6475` | `#F4F4F5` / `#A1A1AA` | Text |
| `border` | `#E3E8EF` | `#2D3440` | Card and input borders |
| definitions | teal `#0F766E` | `#5EEAD4` | Definition cards |
| streak / exam / success | orange `#F97316`, red `#EF4444`, green `#16A34A` | lighter tints | Status tiles |
| hero dark | `#0B1220` → `#1E3A8A` | same | Focus mode, live room, contest cards |

  *[ADR-0094: the board's indigo tokens are replaced by these.]* Radius: 12 px controls, 16 px cards, full pills for
  chips. Type: Inter (already in lvn-web). Contrast: every text/background pair must pass WCAG 2.1 AA (§12.2):
  `accent` on `accent-soft` is 4.75:1 (light) and 5.8:1 (dark), and the lowest pair is `accent` on `surface-2`, at
  4.7:1.

## Screen inventory → spec

| Screen (board) | Platform | Spec | Phase |
| --- | --- | --- | --- |
| Landing: hero, feature tiles, sign-up CTA (A) | Web `(public)/` | §12.1 | 0 (exists, restyle) – 1 (CTA) |
| Onboarding / welcome, Get started, Log in (B) | Mobile | §7, §13 | 1 |
| Registration: name, date of birth, optional college or organisation email, 6-digit code; "verify to post, follow and join" banner until verified (owner request) | Both | ADR-0017, ADR-0019 | 1 |
| Settings → **Verification**: institutional email, or "Ask a teacher" (search, message), or "Send proof to LearnViaNotes" (upload with masking guidance); request status (owner request) | Both | ADR-0019 | 1 |
| Teacher: **Verification requests** list — approve / decline, no documents (owner request) | Both | ADR-0019 | 1 |
| **Settings → Data**: Export all my data (history, download for 7 days), Import notes (file picker, progress, report) (owner request) | Both | ADR-0018 | 2 |
| App shell with sidebar: Home, My Notes, Explore, Subjects, Groups, Classrooms, Calendar, Quizzes, Contests, Community, AI Assistant, Bookmarks, Upload, Create Note (A) | Web `(app)/` | §12.1 | 1 (shell) – grows per phase |
| Home dashboard: greeting, day streak, continue learning, upcoming exam, weekly goal, recommended, your rooms (A) | Web + mobile | §14.2, §14.3 | 6 (streak, exam, recommendations); 3 (rooms = groups) |
| Mobile tabs Home · Explore · ＋ · Community · Profile with centre create button (A) | Mobile | §13.1 — **matches the spec exactly** | 1–3 |
| Create Note editor: blocks (text, image, code), Add Card, Publish, "Draft saved" (A) | Both | §4.1, §4.3, §12.2 editor | 2 |
| Note view: Content · AI Summary · Flashcards · Quiz · Discussions tabs, Fork, Share, Ask-AI panel, quick actions (A, B) | Both | §4.4, §10, §10.3 | 2 (content, fork, share) – 5 (AI) |
| Upload notes: file, title, subject, description, "make public → AI summary" (B) | Both | §8.1, §10.3 | 2 (upload) – 5 (pipeline) |
| Notes list: For You / Most Popular / Recent / Subjects, subject filter chips (B) | Both | §11, §14.3 | 2–6 |
| Community feed: For You / Trending / Following, posts with likes, comments, save (A, B) | Both | §3 core (comments, reactions, feed) | 3 |
| Group page: "CSE 3rd Year · Private Group", Notes / Discussions / Resources / Events, pinned (A) | Both | §5 groups | 3 |
| AI Assistant chat with sources, generate quiz / flashcards (A, B) | Both | §10.1–10.2 | 5 |
| Quiz player (A) | Both | §4.1 Quiz | 3 (classroom) / 5 (generated) |
| Profile: avatar, stats, achievements, My Notes / Saved / Groups / Classrooms / Learning history (A, B) | Both | §14.2, Phase 8 achievements | 2 – 8 |
| Student profile tabs **Notes · Projects**, follower count, Follow; block / restrict / remove follower in the profile menu (owner request) | Both | ADR-0015, ADR-0016 | 3 |
| **Project workspace**: repo card, members and mentor, Ideas board, Doubts (open / answered / resolved), shared notes, showcase (owner request) | Both | ADR-0015 | 3 (AI on doubts 5, repo activity 7) |
| Teacher profile tabs **Notes · Blog · Projects · Posts · Skills**, follower count, Follow / Connect buttons (owner request) | Both | ADR-0012, ADR-0013, ADR-0014 | 3 (Skills import 7) |
| Following feed: followed teachers' public content (owner request; board A's "Following" tab) | Both | ADR-0014 | 3 |
| Teacher profile **Skills** tab: subjects, skills, qualifications, imported items with source (owner request, not on the boards) | Both | ADR-0012 | 3 (manual) – 7 (import) |
| Group settings: join policy Open / Approval; join-request queue (not on the boards) | Both | ADR-0009, ADR-0011 | 3 |
| Fork credit line "Forked from … by …" on every fork (not on the boards) | Both | ADR-0010 | 2 |
| Focus mode (Pomodoro timer) (A) | Mobile + web | §18 Phase 6 "focus mode" | 6 |
| Exam preparation: upcoming exam, study plan, today's tasks (A) | Both | §14.2 exam planner | 6 |
| Weekly contest (A) | Both | §18 Phase 8 | 8 |
| Global search ⌘K with All / Notes / Topics / Problems / Groups / Users (A) | Web; mobile Explore | §11 | 2 (Postgres) – 4 (Typesense) |
| Admin analytics (A) | **Admin app** | §1, §20 — never in the student app | Later, separate app |

## Needs a decision before it is built

| # | Shown on the boards | Conflict with the spec | Options |
| --- | --- | --- | --- |
| 1 | "Pricing" in the landing nav | Payments are out of scope (§1, §20) | **Decided** (ADR-0024): removed; plans with limits later, limits already stored as data |
| 2 | Followers / Following counts, a "Following" feed tab | **Decided** (ADR-0013, ADR-0014): anyone follows teachers, teachers connect with teachers; follower counts on teacher profiles only; the Following feed shows followed teachers' public notes, blogs, posts and projects | Students follow students too (ADR-0016), with block and restrict |
| 3 | Group "Events" tab, upcoming events with Register, live study rooms (B) | No event or live-room entity; live rooms need real-time audio/video | **Decided:** no live rooms — Google Meet links can be attached to events and posts; events need their own ADR when wanted |
| 4 | "Problems" filter in global search | "Problems" removed from scope; Sheet 150 is read-only content under `/core` | **Decided:** dropped; `/core` content is searched as Topics |
| 5 | PDF-first notes with download counts | Notes are card documents; PDFs are attachment cards (§4.1, §8); downloads are not tracked | **Decided** (ADR-0025): file cards with download counts, plus the PDF engine that converts PDFs into editable notes |
| 6 | "Translate" and "Read aloud" quick actions | Not in the spec; English-only UI (§12.2) | **Decided** (ADR-0025): read aloud with device TTS (Phase 2); Translate and more as AI tasks (Phase 5) |
| 7 | Branch chips (CSE, ECE, ME…) and "CSE · 3rd Year" under names | No department / year on `User` (§4) | **Decided** (ADR-0026): department, year and interests on the student profile |
| 8 | "Join 50,000+ students" | Must be a real number | **Decided** (ADR-0027): nothing until 1,000 active learners, then milestones only |
| 9 | "Weekly goal" tile | Not specified | Fold into §14.2 streaks/exam planner, or ADR |

## Implications

- **Mobile UI kit:** proposed in ADR-0029 — Uniwind + react-native-reusables + our own brand components, animated
  with Reanimated 4, sharing one token source with the web. (Research ruled out Tamagui — tokens don't map to the
  web's Tailwind and v3 changes syntax again — and React Native Paper, which is Material 3.)
- **Web:** Tailwind tokens in `app/globals.css` carry the palette above; shadcn primitives take their colours from it.
- Screens are built in the phase listed above, each with its backend (§20) — the boards do not move work earlier.

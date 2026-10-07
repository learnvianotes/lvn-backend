# UI reference

Two mock-up boards were shared by the owner on 2026-10-08. They set the visual direction for lvn-web and lvn-mobile.
They are **references, not specs**: anything they show that the architecture spec does not cover is listed under
"Needs a decision" and is not built until an ADR accepts it.

> Image files: save the boards as `docs/design/reference-a-learnvianotes.png` and
> `docs/design/reference-b-studysphere.png` so every agent sees the same pictures.

| Board | What it is | Use |
| --- | --- | --- |
| **A — LearnViaNotes** (primary) | Web landing, web app shell, note view, mobile home, editor, community, group, AI assistant, quiz, profile, focus mode, exam prep, contest, global search, admin analytics | Brand, layout and screen inventory |
| **B — "StudySphere"** (secondary) | An unbranded sample: onboarding, feed, notes list, note detail with AI summary, upload, community, live room, AI assistant, profile | Layout ideas only. The product name is **LearnViaNotes** everywhere |

## Brand

- **Name:** LearnViaNotes — app name, web title, store listing, emails. Short mark: **LVN** wordmark (board A).
  Development builds are "LearnViaNotes Dev" and "LearnViaNotes Sandbox".
- **Feel:** light, soft and rounded; lavender-tinted backgrounds, white cards, one indigo accent, warm illustrations,
  dark night-sky hero cards for focus and live moments.
- **Tokens** (read off the boards; confirm against the source files):

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `accent` | `#4F46E5` | `#818CF8` | Primary buttons, active tab, links |
| `accent-soft` | `#EEF2FF` | `#1E1B4B` | Chips, selected rows, icon tiles |
| `bg` | `#F7F7FB` | `#0E0E12` | Page background |
| `surface` | `#FFFFFF` | `#17171C` | Cards, sheets |
| `fg` / `muted` | `#1E1B2E` / `#5F5F73` | `#F4F4F5` / `#A1A1AA` | Text |
| `border` | `#E6E6EF` | `#2C2C35` | Card and input borders |
| streak / exam / success | orange `#F97316`, red `#EF4444`, green `#16A34A` | lighter tints | Status tiles |
| hero dark | `#1C1A3A` → `#2B2560` | same | Focus mode, live room, contest cards |

  Radius: 12 px controls, 16 px cards, full pills for chips. Type: Inter (already in lvn-web). Contrast: every
  text/background pair must pass WCAG 2.1 AA (§12.2) — `accent` on `accent-soft` is 5.6:1 (light) and 5.4:1 (dark); the lowest pair is 5.4:1.

## Screen inventory → spec

| Screen (board) | Platform | Spec | Phase |
| --- | --- | --- | --- |
| Landing: hero, feature tiles, sign-up CTA (A) | Web `(public)/` | §12.1 | 0 (exists, restyle) – 1 (CTA) |
| Onboarding / welcome, Get started, Log in (B) | Mobile | §7, §13 | 1 |
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
| 1 | "Pricing" in the landing nav | Payments are out of scope (§1, §20) | Remove the link (recommended) |
| 2 | Followers / Following counts, a "Following" feed tab | **Decided** (ADR-0013, ADR-0014): anyone follows teachers, teachers connect with teachers; follower counts on teacher profiles only; the Following feed shows followed teachers' public notes, blogs, posts and projects | Students do not follow students |
| 3 | Group "Events" tab, upcoming events with Register, live study rooms (B) | No event or live-room entity; live rooms need real-time audio/video | ADR for events (core); live rooms out of scope for now |
| 4 | "Problems" filter in global search | "Problems" removed from scope; Sheet 150 is read-only content under `/core` | Search `/core` content as Topics, no Problems filter |
| 5 | PDF-first notes with download counts | Notes are card documents; PDFs are attachment cards (§4.1, §8); downloads are not tracked | Show attachments as file cards; add a `FILE_DOWNLOADED` learning event if counts are wanted |
| 6 | "Translate" and "Read aloud" quick actions | Not in the spec; English-only UI (§12.2) | ADR for read-aloud (device TTS, no backend) and translate (AI task) |
| 7 | Branch chips (CSE, ECE, ME…) and "CSE · 3rd Year" under names | No department / year on `User` (§4) | Profile fields in `users`, or derive from classroom/organisation membership |
| 8 | "Join 50,000+ students" | Must be a real number | Show live counts only, or no figure |
| 9 | "Weekly goal" tile | Not specified | Fold into §14.2 streaks/exam planner, or ADR |

## Implications

- **Mobile UI kit (open):** the boards' soft, rounded, non-Material look is closer to Tamagui (or a small custom set on
  plain React Native) than to React Native Paper's Material 3. Recommendation: Tamagui — decided in the UI-kit ADR
  before the first Phase 1 screen.
- **Web:** Tailwind tokens in `app/globals.css` carry the palette above; shadcn primitives take their colours from it.
- Screens are built in the phase listed above, each with its backend (§20) — the boards do not move work earlier.

# Phase 8 — Engagement: plan

Spec §18 Phase 8, as amended by ADR-0030 (no global leaderboards; cooperative class and buddy goals instead). Scope:
- **Achievements:** markers of what someone has learned or given, private by default.
- **Points and contributor levels:** points come from what other people do with your work.
- **Tasks:** a few weekly goals a learner picks.
- **Cooperative goals:** for a class and for Rhythm buddies.
- **Weekly contests.**
- **Mock interviews:** the data model only.

**Exit criteria:**
- anything ranked excludes minors by default;
- no company features.

Board A draws a Contests entry, a weekly contest card ("DSA Battle #12 · 10 problems · 20 minutes · Join now"), a
Quizzes entry and Profile achievements ("7 Day Streak", "DSA Contributor", "Quiz Master", "Top 10% Learner").
ADR-0076 left them out until this phase. Three of them conflict with decisions already taken and are drawn differently
here:
- the streak is replaced by Rhythm weeks (ADR-0030);
- "Top 10%" is a rank, and becomes a personal best;
- "Win rewards" has no reward, since nothing is sold or given away (§1).

As before, every slice is built and shown on the **local environment**; the AWS sandbox stays deferred. Each slice
lands backend first, then web and mobile. It is merged to `main` in every repo it touches and checked on the local
environment with smoke, lifecycle, live web and Maestro. Nothing is pushed.

## What earlier phases left for this one

- **Learning signals (Phase 6):**
  - `CardReview` (FSRS stability and recall per card);
  - `TopicQuizResult` (quiz answers per topic);
  - `LearningDay` and `LearningDayTopic` (minutes and reviews per day);
  - `RhythmWeek` (weeks met);
  - `Exam` with Readiness.
- **What others do with someone's work:**
  - `Reaction` on notes, posts and comments (ADR-0047);
  - `NoteForked` and `NotePublished`/`NoteUnpublished` events;
  - `ResourceDecided` (ADR-0074).
- **Cooperative pieces (ADR-0072):**
  - Rhythm buddies (up to five, mutual consent);
  - the classroom ring (totals, and names only of students who share);
  - class performance for staff.
- **Age:** a minor is anyone under `DIGITAL_CONSENT_AGE`, 18 by default, which matches India's DPDP Act (a child is
  under 18). `isRestrictedMinor` adds whether a parent consented. Ranking needs the age alone.
- **Public counts** are shown only as milestones (ADR-0027): "1,000+", never an exact number.

## Research this plan rests on (2026-10-14)

Each decision below comes from one of these findings.

**Achievements**
- **Rewards for doing an activity lower interest in it, most of all in children.** Positive, informational feedback
  raises it.
  - Deci, Koestner and Ryan's meta-analysis of 128 studies:
    - rewards for engaging in a task, d = −0.40;
    - rewards for completing it, d = −0.36;
    - verbal feedback, d = +0.33.
  - Rewards given in a controlling way do more harm than the same rewards given informationally.
  - Source: [Deci et al. 1999](https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf).
  - The classic study: children promised a "Good Player" certificate drew less afterwards; unexpected rewards did not
    have this effect ([Lepper et al. 1973](https://doi.org/10.1037/h0035519)).
- **Badges pull effort towards what they count, briefly.** On Stack Overflow, activity on the action a badge targets
  rises before the badge is reached and returns to near its earlier level right after it
  ([Anderson et al. 2013](https://archives.iw3c2.org/www2013/proceedings/p95.pdf)). Only about 20 % of users respond
  to badges at all ([re-analysis](https://arxiv.org/abs/2002.06160)).
- **Competence feedback meets the need for competence; cooperation meets the need for relatedness**
  ([Sailer et al. 2017](https://epub.ub.uni-muenchen.de/53202)).
- Khan Academy says its energy points measure effort, "not mastery or ability"
  ([help centre](https://support.khanacademy.org/hc/en-us/articles/202487710-What-are-energy-points-)).

**Points and levels**
- **Stack Overflow:**
  - Reputation comes from other people's votes.
  - Votes earn at most 200 a day.
  - Serial voting is detected and reversed.
  - Votes on deleted posts stop counting.
  - Privileges are earned in steps, and lost when reputation falls below them.
  - Sources: [reputation](https://stackoverflowteams.com/help/whats-reputation),
    [serial voting](https://stackoverflowteams.com/help/serial-voting-reversed).
- **Wikipedia** gates rights on edits plus account age: autoconfirmed at 10 edits and 4 days
  ([user access levels](https://en.wikipedia.org/wiki/Wikipedia:User_access_levels)).
- **Recognition from a peer works.** A barnstar from another editor raised editors' productivity by 60 % in a
  randomised trial ([Restivo and van de Rijt 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3315525/)).
- **Karma is farmed.** About 100 karma per account can be built in a few weeks
  ([2025 study](https://arxiv.org/pdf/2507.06561)).
- **Award once:** an idempotency key on every award ([Stripe](https://stripe.com/blog/idempotency)).

**Cooperative goals**
- **Cooperation beats competition.** Cooperation beat both competition and individual work on achievement in 122
  studies, and cooperation without competition between groups did best
  ([Johnson et al. 1981](https://maaw.info/ArticleSummaries/ArtSumJohnsonMaruyama1981.htm)). Among college students,
  cooperative learning beat competitive learning, g = .42, with a larger effect on how students relate, g = .88
  ([Johnson et al.](https://conservancy.umn.edu/items/5e0a2b70-7901-443a-ac5e-2f787065e056)).
- **Gamification in education works modestly.** Effects: cognitive g = .49, motivational g = .36, behavioural g = .25.
  Collaboration combined with competition did best for behaviour
  ([Sailer and Homner 2020](https://link.springer.com/article/10.1007/s10648-019-09498-w)).
- **Competition costs weaker learners.** In a competitive maths game, high achievers dominated and low achievers then
  took part less ([GaLA 2020](https://trepo.tuni.fi/bitstream/10024/130150/1/GaLA_Conf_2020_paper_leaderboard.pdf)).
- **Duolingo's cooperative features** (company data):
  - Friends Quests pair only active friends, so that no one carries the quest alone
    ([Duolingo](https://blog.duolingo.com/friends-quests/)).
  - People with a Friend Streak (at most five friends) are 22 % more likely to finish their daily lesson
    ([Duolingo](https://blog.duolingo.com/product-lessons-friend-streak/)).

**Contests**
- **A contest teaches as retrieval practice.** Practice tests beat restudying in 118 studies
  ([Adesope et al. 2017](https://journals.sagepub.com/doi/10.3102/0034654316689306)). So a contest should be a quiz
  followed by the explanations.
- **Competition raises anxiety**, and its effect on scores is mixed
  ([2024 review](https://pmc.ncbi.nlm.nih.gov/articles/PMC11047602)).
- **Formats for school students:**
  - Bebras, for students aged 8–18, runs 40–55 minutes within a set week ([bebras.org](https://bebras.org)).
  - UKMT gives banded certificates, not public ranks
    ([UKMT](https://en.wikipedia.org/wiki/United_Kingdom_Mathematics_Trust)).
- **AI during contests.** Codeforces bans pasting the problem into AI and treats identical answers that did not exist
  publicly before the round as evidence of cheating ([2024 rule](https://codeforces.com/blog/entry/133941)).

**Tasks**
- **Goals:** specific, hard goals beat "do your best" when there is commitment and feedback
  ([Locke and Latham 2002](https://goal-lab.psych.umn.edu/orgpsych/2020/readings/5.%20Motivation/Locke%20&%20Latham%20(2002).pdf)).
- **Plans:** "when X, I will Y" plans improve goal attainment, d ≈ 0.65 over 94 tests
  ([Gollwitzer and Sheeran 2006](https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes)).
- **Khan Academy** links learning 2–3 skills a week to about 30 % more growth (observational,
  [Khan Academy](https://2023-2024.annualreport.khanacademy.org/efficacy-results)).

**Children's data**
- **India, DPDP Act 2023, s.9:**
  - a parent's verifiable consent is needed for a child (under 18);
  - no processing likely to harm a child's well-being;
  - no "tracking or behavioural monitoring of children".
  - The DPDP Rules were notified on 13 Nov 2025; parental consent (Rule 10) applies from 13 May 2027
    ([summary](https://ssrana.in/articles/meity-notifies-final-digital-personal-data-protection-rules-2025/)).
- **UK Age Appropriate Design Code:**
  - a child's data is shown to others only if the child changes the setting
    ([standard 7](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/7-default-settings/));
  - no features that use personal data to automatically extend use
    ([standard 5](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/5-detrimental-use-of-data/)).

**Not yet validated:**
- whether points and achievements computed for a child count as "behavioural monitoring" under DPDP s.9(3) (needs
  counsel; the owner is asked below);
- the caps (points a day, a student's share of a class goal), to be tuned from use;
- the best contest window for Indian students;
- whether class goals raise learning (FSRS recall), not only activity.

## Slices

| Slice | What | Repos |
| --- | --- | --- |
| **P8a Achievements, points and contributor levels** | ADR-0080. `core.PointsEntry`, an append-only ledger. Each award has a unique key (rule, source, actor), and a removal adds a reversing entry. Points come only from other people: a reaction on a public note (+1), a fork of it (+5), a resource moderators approve (+10). Actors count only if verified and at least 7 days old. Nobody earns from themselves or someone they blocked, and the same actor counts at most 5 times a week towards the same person. Reactions earn at most 50 a day. Levels are derived from points: Contributor at 50 and Trusted contributor at 250. Trusted contributors may submit 20 resources a day instead of 10. `core.Achievement`, from code-defined rules evaluated by a worker job after the events that feed them, each tier once. Rules mark competence or what others found useful: topics mastered (FSRS), Quiz master (accuracy over enough answers on a topic), Exam ready (Readiness at target before the exam), Rhythm weeks met, and "<subject> contributor" (points from notes on a subject). Private by default; an adult may show them on their profile, and a minor's are never public. An in-app note when one is earned, with no push. Web: Profile's achievements and level, Settings' visibility. Phone: the Profile tab's Achievements row | all three |
| **P8b Weekly tasks and cooperative goals** | ADR-0081. Up to three tasks a week, picked from suggestions built from exam plans, weak topics and reviews due. Each has a target (reviews, quiz answers, focus minutes on a topic) and an optional "when and where" plan. Progress comes from learning events; an unfinished task just ends with the week, with no penalty. A class goal: the teacher turns on a pooled weekly target for the class (counted days), sized from the class's recent weeks. Each student counts up to their share. Classmates see the total; staff see each student's part in class performance. A buddy goal: each pair of Rhythm buddies, who already see each other's week, sees their counted days together against their targets together. No goal can be failed: a missed one shows how far it got. Web: Rhythm and Home; the class's Rhythm tab. Phone: the same | all three |
| **P8c Weekly contests and Quizzes** | ADR-0082. A platform admin writes a contest: a subject, a window (by default Saturday 10:00 to Sunday 22:00 IST), a length (default 20 minutes), how many questions are asked, and a pool of multiple-choice questions with explanations. A person makes one attempt: the server keeps the time, picks and orders the questions and their options, and takes answers only until the deadline. The explanations show at once. Everyone sees their score and their personal best for the subject. An adult who opts in sees, once the window closes, a band (top 10 %, 25 % or 50 %) among adults. There is no rank list. Under-18s are left out of every band, by the query. Participants are shown as milestones (ADR-0027). Web: Contests and Quizzes in the sidebar. Quizzes gathers the week's contest, class quizzes due, practice from one's notes and recent results. The admin page writes contests. Phone: the contest card on Home and Explore, the contest screen and Quizzes | all three |
| **P8d Mock interviews: the data model only** | ADR-0083. Templates, questions, rubrics and criteria, slots, interviews and feedback, in `core`, with no GraphQL, routes or UI, and no company, job, application or referral entity. A schema test proves no company feature is exposed | backend |
| **P8e Exit** | In the security suite: no under-18 appears in any band or ranked answer, whatever they ask; achievements and levels are private by default; points cannot be farmed by oneself, by a new or unverified account, or by repeating the same person. The no-company-features check over the schema. Live web and Maestro on the local environment; `docs/releases/phase-8.md` | all three |

## Decisions to record before the slice that needs them

| ADR | Question | Leaning |
| --- | --- | --- |
| 0080 Achievements and points (P8a) | What earns points; how they are protected; what levels unlock; which achievements | Only other people's independent actions on public work; an idempotent ledger with reversals, caps and trust gates; levels unlock a small responsibility and are lost below the threshold; achievements mark competence, private by default |
| 0081 Tasks and cooperative goals (P8b) | How many tasks; where suggestions come from; how a pooled goal avoids exposing weak students | At most three a week, chosen; suggestions from the plan, weak topics and reviews; pooled targets with a per-person share, totals only for peers, no fail state |
| 0082 Contests (P8c) | Who writes them; timing; what is shown to whom | Platform admins; a weekend window in IST with a timer kept by the server; scores and personal bests for all, opt-in bands for adults only, no rank list |
| 0083 Mock-interview model (P8d) | Which entities, and how they stay unused | Template, question, rubric, slot, interview and feedback in `core`; no GraphQL; adults only when built |

## Needed from the owner (not blocking)

- **Counsel on DPDP s.9(3):** whether achievements and points for under-18s count as "behavioural monitoring". Until
  then, a minor's achievements are visible only to them, and are computed only from learning they do in the app.
- **Contest questions:** the first contests need questions. Admins write them; the owner may want to name who writes
  them.

## Progress

| Slice | State | Evidence |
| --- | --- | --- |
| P8a Achievements, points and contributor levels | Done 2026-10-14 | ADR-0080. `core.PointsEntry` (append-only, unique `awardKey` per rule, source, actor and entry count) and `core.Achievement` (each tier once per person). Points only from others: a reaction on a public note +1, a fork +5, a resource approved +10. Actors count when verified, unsuspended, a week old and not blocked, at most 5 times a week towards one person; reactions at most 50 a day; reversals when the reaction is taken back, the note stops being public or the resource leaves the catalogue. Levels Newcomer, Contributor (50), Trusted (250: 20 resources a day). Achievements: topics mastered, quiz master, exam ready, Rhythm weeks, subject contributor, checked by a `core.engagement` job after learning and points change; `AchievementEarned` becomes an in-app `ACHIEVEMENT` notification, never pushed. Private unless an adult shows them; a minor's never are (`setAchievementsShown`). Export and erasure. Web `/achievements` (level, badges, points history, showing them), the account link, achievements on a profile. Phone: the Profile tab's row and the Achievements screen. API note `2026-10-14-achievements-points.md`; contracts 0.53.0; migration `20261101090000_engagement`. Tests: API `engagement.e2e` 5 (trust gates, once, reversal, the pair cap, resource points and levels, the trusted limit, tiers once with notifications, privacy, minors); web `achievements.spec`, `people.spec`; phone Jest achievements 2. Local environment: smoke 13/13, lifecycle 105/105 (a trusted reader's reaction earns the author a point, taken back when the note goes private), live 67 + 1 skipped, Maestro `achievements`, `account`, `tabs`, `notifications` 4/4 |
| P8b Weekly tasks and cooperative goals | Done 2026-10-14 | ADR-0081. `core.WeeklyTask`: up to three a week (reviews, quiz answers on a topic or any, minutes on a topic) with a when-and-where plan; progress read from the week's learning days and quiz results; suggestions from the next exam's weakest topic, topics answered under 60 % right in four weeks and the cards due; an unfinished task just ends with the week, earning nothing. `core.ClassGoal`: teachers turn on a pooled weekly goal of counted days, set or sized from the class's last four weeks (else six tenths of the planned days, at least a day a student); each student counts up to `ceil(1.5 × target ÷ students)`; classmates see the total, teachers each part. Buddies see their week together (`RhythmBuddy.together`), which they already saw of each other, so it needs no setting. Web: tasks on Rhythm, the class goal on a class's Rhythm tab, the pair's week on buddies. Phone: the same. API note `2026-10-14-tasks-goals.md`; contracts 0.54.0; migration `20261102090000_tasks_goals`. Tests: API `tasks-goals.e2e` 4; web `tasks.spec`, `focus.spec`; phone Jest tasks 3 (phone suite 323). Local environment: smoke 13/13, lifecycle 107/107 (a task with a plan; a class goal whole for a student and in parts for its teacher), live 65 + 1 skipped in the full run, and the two that failed passed alone: learning events (load) and the teacher vouch (the picker searched before people search had indexed the new teacher; the test now waits for it); Maestro `tasks`, `rhythm`, `classes`, `focus` 4/4 (`focus` waited for the week card, which tasks now push off screen) |
| P8c Weekly contests and Quizzes | Done 2026-10-14 | ADR-0082. `core.Contest`, `ContestQuestion`, `ContestAttempt` (one per contest and person), `ContestAnswer`. Platform admins write a contest (a title, a subject, a window by default Saturday 10:00 to Sunday 22:00 India time, 5–60 minutes, 3–30 questions drawn from a pool of multiple-choice questions with explanations) and publish it. Everyone signed in makes one attempt while it is open: the server draws the questions and orders their choices for that person and keeps the time; answers change until the deadline or submission; the answer key and explanations only once it is over; an attempt past its deadline is marked when next read. Scores and personal bests are the person's; an adult who asks sees a band among adults once the window closes, and no under-18 is in a band or given one. Participants as milestones; no points, rewards or notifications. Web: Quizzes and Contests in the sidebar (board A), the contest page, `/quizzes` (the contest, class quizzes waiting, practice, recent results), `/admin/contests`. Phone: Contests from Explore and Home's card while one is open, the contest screen. API note `2026-10-14-contests.md`; contracts 0.55.0; migration `20261103090000_contests`. Tests: API `contests.e2e` 4; web `contests.spec`, `shell.spec`; phone Jest contests. Local environment: smoke 13/13, lifecycle 108/108 (an admin publishes a contest; a learner takes it without the answer key and reads every answer explained), live 67 + 1 skipped (the teacher vouch test now waits for people search to find the new teacher), Maestro `contests`, `home`, `smoke` 3/3 (`home` scrolled past an open contest's card) |
| P8d Mock interviews: the data model only | Done 2026-10-14 | ADR-0083. `MockInterviewTemplate`, `MockInterviewQuestion`, `InterviewRubricCriterion`, `InterviewSlot`, `MockInterview` and `InterviewFeedback` in `core`, with no GraphQL, routes or UI, and nothing about companies or hiring; migration `20261104090000_mock_interviews`. Merged with P8c |
| Owner ask: notes from up to ten photos and PDFs | Done 2026-10-14 | ADR-0084. A quick note reads up to 10 photos (4 go with the request; with more, each is first read on its own with `read-page`, as a local model's 4,096-token context fits about four at 1,280 px, ~540 tokens each, measured) and the text layer of up to 10 PDF file cards (60 pages each, `unpdf`); prompt `quick-note` v2 asks for one note across them. Contracts 0.56.0 `QuickNoteLimits` (10 files, PDFs up to 20 MB, pictures resized to 2,048 px JPEG on the device). Phone: Photo opens a tray (camera again and again, photo library several at once, files), pictures compressed with `expo-image-manipulator`, Make notes uploads each with progress and resumes after a failure. Web: "Notes from photos" on Notes, a dialog with drop and canvas compression, opening the note with its AI panel. API note `2026-10-14-quick-note-batch.md`. Tests: API `voice-quick.e2e` 5 (ten photos read one by one, the eleventh left out, a PDF's words); web `capture.spec` (a 3,000 px picture uploaded at 2,048, a 21 MB PDF turned away) plus notes, AI, reader, note view 101 passed, Vitest 114; phone Jest tray 3 + capture 2 + create 19. Local environment: smoke 13/13, lifecycle 108/108, live 67 + 1 skipped, Maestro `capture` (two photos with the emulator's camera, then Make notes), `create-sheet`, `home`, `smoke` 4/4. Real model (gemma4): six photos and a PDF made one note of three sections in 15 s |
| Owner ask: AI reads photos, PDFs and recordings | Done 2026-10-14 | ADR-0085. Translate and every AI tool said "This note has nothing to work on yet" on a note of photos (its quick note not kept) or a voice note: tasks read only typed words. Every words task and Ask AI now read the note's words with what its photos say (read once with `READ_PAGE`, kept in Redis 30 days), its PDFs' text and the asker's transcripts; a recording-only note asks for a transcript first; what a kept quick note or transcript put into the note is not read again (`options.read`, `options.keptInNote`). Tests: API `ai-note-material.e2e` 5 with the AI suites 47. Local environment: smoke 13/13, lifecycle 108/108, live 67 + 1 skipped, Maestro `capture`, `ai`, `voice` 3/3 |
| Owner ask: proper translations | Done 2026-10-14 | ADR-0086. A Telugu translation of a photo note came back in English but for its title, with broken LaTeX. Translate now answers in plain text (JSON made the local model copy), at temperature 0.2, in pieces of 1,500 characters, each checked to be mostly in the language's script and asked once more if not; photo readings make LaTeX symbols plain; every structured answer mends unescaped backslashes; translations leave out "Photo n:" labels. Tests: unit `translate` 5, API translation in pieces, live `tasks.live` 15 against gemma4 (Telugu and Hindi script shares over 0.5). Real model on the local environment: six photos and a PDF into Telugu in 6 s |
| Owner ask: Home's line for the day | Done 2026-10-14 | ADR-0087. Home's night-sky card said the same thing daily. `dailyLine` gives a headline and a sentence written by AI for the person once a learning day (job `daily-line` on `core.engagement`, facade `DAILY_LINES`, prompt `daily-line`), from the week's rhythm, the next exam, the note last worked on and a topic to strengthen; kept in Redis for the day; until then, or with AI off, one of 21 chosen lines, also daily. Contracts 0.57.0. Web Home and the phone's hero card show it and ask again while it is written. Tests: API `daily-line.e2e` 3, web `home-dashboard.spec`, phone Jest hero 2. Local environment: smoke 13/13, lifecycle 108/108, live 67 + 1 skipped, Maestro `home`, `capture`, `ai`, `manage`, `create-sheet` 5/5 (flows now wait for the card by id). Real model: the person's own line 6 s after the chosen one |
| Owner ask: sheets that do not jump; choosing in groups | Done 2026-10-14 | Phone only. Bottom sheets rose on a spring that overshot (damping ratio about 0.67), so they jumped; they now ease in without a bounce (`SHEET_IN`). A group's Posts and Notes have Select (or a long press) to choose several posts to delete, or one's own shared notes to take out, with a bar to act after asking; a single post's delete asks first; Settings has its own "Delete this group" section. Tests: phone Jest groups 12. Maestro `manage` passed |
| P8e Exit | Done 2026-10-14 | The engagement security tests (`engagement.security.test.ts`): no minor in or given a contest band, whatever is stored; a minor's achievements and level shown to nobody; points that cannot be farmed (the pair cap, the daily cap, reversal); no company, job, hiring or interview type, field or value in the schema. Release notes [phase-8.md](../releases/phase-8.md). Backend 985 passing + 1 todo (API 488 + 1 todo), typecheck (a translation test's dynamic import fixed), lint, boundaries, audit, `env:check`; web Vitest 114, Playwright 473 (93 skipped); phone Jest 332. Local environment: smoke 13/13, lifecycle 108/108, live 67 + 1 skipped, Maestro 36/36 (33 min) |

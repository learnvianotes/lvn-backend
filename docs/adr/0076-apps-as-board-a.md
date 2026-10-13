# ADR-0076: The apps as board A draws them

- Status: Accepted (owner ask, 2026-10-13)
- Date: 2026-10-14
- Deciders: the owner; Web and Mobile agents, Backend where data is missing
- Spec sections: §12 (web), §13 (mobile), §14.2; `docs/design/ui-reference.md`, board A
  (`docs/design/reference-a-learnvianotes.jpeg`); ADR-0027 (no fake numbers), ADR-0030 (Rhythm, not streaks)

## Context

The owner sent board A again ("UI and the features in the UI") and asked for the apps to match it, right after P7b. An
audit (2026-10-13) found the phone close to the board and the web far from it.

The audit's ten gaps, most visible first:
1. The web has no left sidebar or "Create Note".
2. Dead controls on phone Home.
3. The web landing.
4. The phone Profile tab.
5. The web note view.
6. Community's For You and Trending tabs.
7. The focus screen.
8. Pictures on recommendations, and "Your Rooms".
9. Saved notes.
10. Smaller pieces: quiz paging, exam tabs, search tabs, the group page's floating ＋.

For the landing hero, the owner chose "based on the theme selected".

## Decision

The board sets **layout and features**, not a spec. Its conflicts were already decided in `ui-reference.md` and stay
decided:
- no Pricing;
- no "Join 50,000+" until real numbers exist;
- Rhythm in place of streaks;
- no Problems search;
- contests and achievements in Phase 8;
- admin analytics in a separate app.

1. **Web shell.** Signed-in pages get the board's left sidebar from 1024 px up. Below that, a menu button opens the same
   list as a drawer.
   - The entries are:
     - Home and My Notes;
     - Explore (search) and Subjects (`/core`);
     - Groups, Classrooms, Resources and Community;
     - AI Assistant (Ask AI) and Saved;
     - Exams (the board's Calendar: the exam calendar and the plan);
     - **Create Note**, as a button.
   - The board's Quizzes and Contests entries are left out until their features exist (Phase 8). Nothing links to a
     page that does not work.
   - The top bar has a search field ("Search notes, topics, people, or ask AI… ⌘K") that opens the palette, the bell
     and the avatar.
2. **Landing.** The hero follows the theme:
   - Light theme: the board's light lavender hero, with its illustration and the headline "Your Learning Community
     for a Brighter Tomorrow".
   - Dark theme: the night-sky hero, with the same headline.
   - Both have Get Started Free and the six feature tiles: Smart Notes, AI Learning, Study Groups, Exam Prep, Quizzes
     & Flashcards, Community.
   - The top nav has Features, Subjects and Community. "Watch Demo" waits for a demo video, and no avatar row is shown
     (ADR-0027).
3. **Web Home.**
   - A "Good morning / afternoon / evening, <name>" greeting.
   - The Rhythm ring as the "day" tile and the week as the weekly goal (5/7 days).
   - Continue learning, with the share of the note's cards seen.
   - Upcoming exam with View Plan.
   - Recommended cards with pictures: a resource's cover, or an illustration chosen by kind and subject.
   - **Your Rooms**: the person's groups and classes, with member counts.
4. **Web note view.**
   - A breadcrumb (subject › topic › note).
   - Fork and Share in the header.
   - Tabs: **Content · AI Summary · Flashcards · Quiz · Discussions**. The first is the editor or reader; the others
     show what the note already has (its AI summary, its flashcards and review, its quiz cards, its discussion).
   - A card rail with a pager on wide screens.
   - The Ask-AI panel docks on the right from 1280 px up, with the board's suggestion chips as one tap each. Every
     chip is one of the existing AI tasks (ADR-0059–0063).
5. **Saved notes.** People save notes they can read to a Saved list (`notes.NoteSave`). The web "Saved" page and the
   phone's Profile show saved notes and saved resources together. Saving is private.
6. **Phone Home.** Every control works:
   - search opens Explore;
   - **Q&A** opens Ask AI;
   - **Camera** scans a page into a note (ADR-0062);
   - **Voice** starts a voice note (ADR-0066);
   - **Upload** imports a PDF or file (ADR-0025, ADR-0040).

   Continue learning shows its progress.
7. **Phone Profile tab.**
   - A profile header: avatar, name, department · year, bio.
   - Stats: Notes, Followers and Following (as on the public profile).
   - Then My Notes, Saved, My Groups, My Classrooms and Learning History.
   - Settings move behind a gear button.
   - Achievements wait for Phase 8; until then the row is not shown.
8. **Community.**
   - **For You:** public posts and notes on the person's topics and interests.
   - **Trending:** the most reacted and commented public posts and notes of the last 7 days.
   - **Following:** today's feed.
   - Post cards show the author and their department, time, title, preview picture, topic chip, reactions, comments
     and Save.
9. **Focus mode** gets its own dark screen:
   - the topic and a large timer with pause and resume;
   - Pomodoro (25), Short Break (5) and Long Break (15) presets;
   - the server still counts only focus time (ADR-0072).
10. **Smaller pieces:**
    - the quiz player pages one question at a time (3/10, Previous, Next);
    - Exams has Upcoming, Study Plan, Progress and Notes tabs, with today's tasks as a checklist and Continue Plan;
    - search has All, Notes, Topics, Groups, Users and Resources tabs;
    - the group page has a floating ＋ (new post) and its picture.

## Consequences

- The web stops looking like a document site and starts looking like the app the owner drew. Every board entry either
  works or is not shown.
- New data:
  - `NoteSave`;
  - Community's For You and Trending queries;
  - the note's "cards seen" share for Continue learning.
- Each needs its tests, its export and its erasure.
- Built as slices UI-a…UI-e, each checked on the local environment like a phase slice.

## Implementation notes (UI-a, UI-c; 2026-10-14)

The owner added, during UI-a: "make sure we don't have dead buttons or dead views in the app and website after phase 7
with the new UI implementation i asked for". So every slice:
- wires each control, or does not show it;
- has tests that its controls lead somewhere real;
- leaves a full sweep of both apps for the Phase 7 exit.

What the slices settled:
- **The sidebar's "Saved" is called "Bookmarks"**, so it is not mistaken for the editor's "Saved" status. Until saved
  notes arrive (UI-d) it opens saved resources.
- **Public pages keep a signed-in person in the app's frame.** These are the catalogue, a resource, a public note, a
  profile and the legal pages.
  - The server still renders the visitor's header, so the pages stay static and indexable.
  - The tab switches to the sidebar and top bar once it knows the session.
  - The landing page keeps the visitor's frame.
  - Without this, Resources in the sidebar dropped a learner out of the app, and on a phone the menu was gone.
- **"…or ask AI"**: the top bar's search promises AI, so the palette offers "Ask AI: “…”". It opens Ask AI with the
  words filled in as a question. Nothing is sent until the person sends it, because AI has a daily allowance.
- **The phone's Profile tab** shows the person, their department and year, and counts of notes, followers and
  following.
  - Notes are the person's own notes on the phone; the phone keeps them all.
  - The account moves to Settings, behind the gear: verification, college email, study details, old-site data, AI,
    notification settings, data, imports and sign-out.
  - On the phone, data-export and import notifications (`/profile` on the web) open Settings. The new-terms screen
    leads there to sign out.
- **Home's tiles and the create sheet share one set of actions.**
  - Upload puts a PDF, picture, video or recording in a new note named after the file; a PDF opens in the reader.
  - Quiz and Flashcards start a note with that card. Before, they did nothing.
- **Recommendations always open something.** A topic to revise or be quizzed on opens its notes in Explore, by the
  topic or, for a core subject's topic, by its name.
- **Focus mode's pause** ends the session, so its time counts. Resume starts a new session for what was left. Breaks
  are timed on the phone and never sent, so the server's rule (ADR-0072) is unchanged.
- **Placeholders that were not data are gone:**
  - the draft legal pages' "mailto:[…]" links are text until the owner fills them in;
  - a /core problem without a video has no greyed-out video button;
  - the phone prototype's placeholder screen and mock data, never rendered, are removed.

# ADR-0082: Weekly contests and the Quizzes page

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web and Mobile agents
- Spec sections: §18 Phase 8 ("weekly contests"; exit: ranked things exclude minors by default), ADR-0030 (no
  global leaderboards), ADR-0027 (public counts as milestones), ADR-0076 (board A's Quizzes and Contests entries);
  research in [plans/phase-8.md](../plans/phase-8.md#research-this-plan-rests-on-2026-10-14)

## Context

Board A draws a "Weekly Contest" card ("DSA Battle #12 · 10 problems · 20 minutes · 500+ participants · Join now")
and Quizzes and Contests entries in the sidebar.

What the research behind the Phase 8 plan says:
- **A contest teaches as retrieval practice.** Practice tests beat restudying (118 studies), and feedback straight
  after an attempt is what makes them work.
- **Competition has a cost.** It raises anxiety, and its effect on scores is mixed.
- **School contests avoid public ranks.**
  - Bebras runs a set window of 40–55 minutes.
  - UKMT gives certificates by band, not a rank list.
- **Children's data:**
  - India's DPDP Act forbids tracking and behavioural monitoring of children.
  - The UK children's code keeps a child's data from others by default.

## Decision

1. **Platform admins write contests.** A contest has:
   - a title and an optional notes subject;
   - a window, by default Saturday 10:00 to Sunday 22:00 in India;
   - a length of 5–60 minutes (default 20);
   - how many questions each attempt gets (3–30, default 10);
   - a pool of at least that many multiple-choice questions. Each question has 2–6 choices, exactly one of them right,
     and an explanation.

   A contest is a draft until it is published. Only a draft can be changed or deleted.
2. **One attempt each, timed by the server.**
   - Anyone signed in may take part while the window is open, child accounts included: a contest is learning.
   - **Starting:** the server picks the attempt's questions from the pool and orders their choices for that person.
     The deadline is the earlier of the start plus the length, and the window's end.
   - **Answering:** answers may change until the deadline or until the person submits. After that, the attempt is
     marked as it stands.
   - **Answer keys:** the right choices and explanations are only ever sent to someone whose attempt is submitted or
     over.
3. **What is shown, and to whom.**
   - **Everyone who took part:**
     - their score;
     - every question with their choice, the right one and the explanation;
     - their personal best on the subject's contests.
   - **Adults who opt in ("Show me how I compare"):** once the window has closed, a band among adult participants:
     top 10 %, 25 % or 50 %, or nothing outside them.
   - **Never shown:**
     - a rank;
     - a list of names;
     - anyone's score but one's own.
   - **Under-18s:**
     - They are left out of every band's population.
     - They are never given a band, decided by their age in the query, whatever any setting says.
   - **Participants:** shown only as milestones (ADR-0027), so "1,000+" and never an exact number.
4. **No rewards and no notifications.**
   - A contest earns no points. A perfect score earns nothing new: achievements already mark mastery.
   - Nobody is pushed or told to come back for a contest.
5. **The Quizzes page** gathers in one place, from what already exists:
   - this week's contest;
   - the class quizzes the person has not taken yet, from each class;
   - ways to practise (flashcards due, and an exam's weak topics);
   - recent results.
6. **Data rights:**
   - A person's attempts and answers are in their export, and erased with the account.
   - Contests and questions belong to the platform.

## Consequences

- A weekly, time-boxed set of questions with explanations: retrieval practice with a reason to come back, never a
  table to fall down.
- The board's "Win rewards!" is not built, and "500+ participants" shows only from 1,000.
- **Writing contests is admin work.** The owner chooses who writes them; until someone does, the Contests page says
  none is open.
- **Cheating stays possible.** A shared screen or a search engine still helps. Explanations come only after the
  attempt, and nothing ranks, so there is little to gain.

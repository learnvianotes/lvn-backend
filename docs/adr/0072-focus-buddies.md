# ADR-0072: Focus sessions, Rhythm buddies, the classroom ring and class performance

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents
- Spec sections: §14.2, §18 (Phase 6: focus mode); ADR-0030 (buddies, classroom ring), ADR-0042 (live updates),
  ADR-0046 (classrooms), ADR-0064 (class quizzes), ADR-0069

## Context

Phase 6 ends with the social side of Rhythm and the teacher's view of a class.

ADR-0030 asks for:
- **Focus mode:** Pomodoro, 25 minutes of work and 5 of rest by default. Ten minutes or more on a topic counts.
- **Rhythm buddies:** up to five, by mutual consent, from people followed or connected. They see "studying now"
  during each other's sessions, and a session may carry a Google Meet link.
- **A classroom ring** of shared weekly progress, where minors appear by first name only.

The Phase 6 plan adds **class performance** for staff: per-student quiz results, and the topics the class finds hard.
ADR-0064 left per-student results to this phase.

Facts that shape the design:
- **Learning time already counts.** A `TIME_SPENT` event with activity `FOCUS` is learning time on its day and topics
  (ADR-0067). A focus session only has to end in one.
- **Live updates exist.** A person's sockets get a kind and an id (ADR-0042), never content; clients fetch what
  changed.
- **Classes know their staff and members.** Class quizzes keep each attempt and each answer (ADR-0064), and a quiz
  keeps the note it was made from, whose topics are known (ADR-0070's `TOPICS`).

## Decision

1. **Focus sessions.**
   - `core.FocusSession(id, userId, topicKey?, noteId?, plannedMinutes, breakMinutes, meetUrl?, startedAt,
     endedAt?, focusedSeconds)`.
   - `startFocusSession`: 5–90 minutes of work (default 25), 0–30 of rest (default 5), on a topic or a note the person
     may read. A session already open ends first.
   - `endFocusSession` counts the time from its start, at most the planned minutes. The server records it as a
     `TIME_SPENT` `FOCUS` event on the session's topic (and the note's topics), so ten minutes make the day count.
   - A session left open past its planned time and its rest is ended by the worker at its planned length.
   - A Meet link must be `https://meet.google.com/abc-defg-hij`. Only buddies see it, and only during the session.
2. **Rhythm buddies.**
   - `core.RhythmBuddy(id, requesterId, addresseeId, status PENDING | ACCEPTED, createdAt, acceptedAt)`.
   - A person can invite someone they follow or are connected with: not someone they blocked or who blocked them, and
     not a child account.
   - Each person has at most five buddies and five invites out. The addressee accepts or declines; either can end it.
   - The invite is a notification (`RHYTHM_BUDDY`), which can be turned off.
   - A buddy sees, of the other:
     - whether they are studying now, with the session's topic title and Meet link;
     - this week's counted days and target.

     Nothing else: no history, no notes.
   - Starting and ending a session tells each buddy's sockets (`BUDDY_PRESENCE`, the person's id); their apps fetch
     the list again.
3. **The classroom ring** (`Classroom.rhythmRing`, members only):
   - totals for this week: members, members whose week is met, counted days of all, and the sum of their targets;
   - names only of members who chose to share their Rhythm with their classes (`LearnerSettings.shareRhythm`, off by
     default), with their counted days. A child account shows its first name only, and only if it shares.
4. **Class performance** (`Classroom.performance`, staff only):
   - each student's first score on each published quiz, and their mean;
   - the class's hard topics: right answers over answers on each quiz's source-note topics, under 60 %, hardest
     first;
   - only staff see it. Students keep seeing only their own attempts.

## Consequences

- **Presence carries no content.** A socket hears "a buddy's presence changed"; the list it fetches is filtered by
  the buddy relation on the server.
- **Sharing is opt-in.** The ring is useful with totals alone; names appear only for those who chose it.
- **Focus time is the server's record.** The apps show a timer, but the time counted is what the server measured
  between start and end, capped at the plan. A client cannot inflate it.

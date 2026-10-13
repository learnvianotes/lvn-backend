# Focus sessions, Rhythm buddies, the classroom ring and class performance (P6g)

- Date: 2026-10-13
- Package: `@lvn/contracts` (minor bump at merge)
- Spec: §14.2, §18; ADR-0030, ADR-0072
- Breaking: no

## What changes for clients

- **Focus sessions:**
  - `startFocusSession(input: { topicKey?, noteId?, minutes?, breakMinutes?, meetUrl? })`: 5–90 minutes of work
    (default 25) and 0–30 of rest (default 5), on a topic or a note the viewer can read. A Meet link must look like
    `https://meet.google.com/abc-defg-hij`. A session already open ends first.
  - `endFocusSession(input: { id })` ends it. The server counts the time since it started, at most the planned
    minutes, as focus time on the session's topic and the note's topics.
  - `focusSession` gives the viewer's open session. A session left open past its work and rest is ended by the server
    at its planned length.
  - `FOCUS_LIMITS` and `meetUrlSchema` join `@lvn/contracts`.
- **Rhythm buddies:**
  - `rhythmBuddies` gives `buddies` (`user`, `studyingNow`, `studyingSince`, `topicTitle`, `meetUrl`, `countedDays`,
    `target`, `met`), `invites` (to the viewer) and `sent`.
  - `inviteRhythmBuddy(input: { handle })` asks someone the viewer follows or is connected with. It answers
    `VALIDATION` otherwise, `NOT_FOUND` for no such person (or a child account, or a block), and `CONFLICT` when an
    invite or a link exists. There are at most 5 buddies and 5 invites out.
  - `answerRhythmBuddy(input: { id, accept })` and `removeRhythmBuddy(input: { id })` (either side; the asker takes an
    invite back).
  - The live channel gains `BUDDY_PRESENCE` (a buddy started or ended a session; the id is the buddy's): refetch
    `rhythmBuddies`.
  - Notifications gain `RHYTHM_BUDDY` (`data.kind`: `REQUESTED` or `ACCEPTED`, opening `/rhythm`), which can be turned
    off.
- **Sharing with classes:** `Rhythm.shareRhythm` and `setRhythmSharing(input: { share })`, off by default.
- **`Classroom.rhythmRing`** (members only): this week's `students`, `metCount`, `countedDays` and `targetDays`, and
  `people`, only students who share: `user`, `name` (a child account's first name only), `countedDays`, `target`,
  `met`.
- **`Classroom.performance`** (staff only):
  - `quizzes`;
  - `students`: each with `user`, `name`, `scores` (first attempt per quiz: `quizId`, `quizTitle`, `score`, `total`,
    `submittedAt`), `submitted` and `average`;
  - `topics`: by the quizzes' source-note topics, `key`, `topic`, `title`, `accuracy`, `answers` and `hard` (under
    60 %), hardest first.
- The data export gains `learning/focus-sessions.json` and `learning/rhythm-buddies.json`.

## Authorization

- Sessions, buddies and sharing are the viewer's own; signed out answers `UNAUTHENTICATED`.
- A buddy sees only what is listed above, and a Meet link only during a session.
- `rhythmRing` is null for non-members; `performance` is null for anyone but the class's staff.

## What clients should do

- Show the timer from `startedAt`, `plannedMinutes` and `breakMinutes`; end the session when the person stops.
- Refetch `rhythmBuddies` on `BUDDY_PRESENCE`.
- Ask before turning on sharing; say who sees what.

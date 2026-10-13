# ADR-0064: Classroom quizzes

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P5g)
- Spec sections: §4.1 (permission matrix), §6.1 (`core`), §9 (events), §18 (Phase 5); ADR-0009, ADR-0018, ADR-0046,
  ADR-0059

## Context

Phase 5 owes classroom quizzes.
- **The phase plan:** "A teacher publishes a quiz to a class (`CLASSROOM_PUBLISH_QUIZ`, `QuizPublished`), made by hand
  or generated from notes; students take it and see their score; attempts are stored (`QuizAttempt`) for Phase 6's
  performance views".
- **The owner:** "The Quiz should be AI generated from the notes and people can add easily."

What is already there:
- **Permissions:** `CLASSROOM_PUBLISH_QUIZ` is in the matrix, for the class's teacher and TAs, and blocked while
  suspended. `CLASSROOM_VIEW_PERFORMANCE` lets staff see anyone's results and a student their own.
- **Events and notifications:** `QuizPublished` v1 (`quizId`, `classroomId`) is declared but nothing sends it. The
  `QUIZ_PUBLISHED` notification category exists but cannot be set yet.
- **The quiz card:** the question, two to eight choices with short ids, the correct ones, single or multiple answer,
  and an optional explanation. It is checked by `@lvn/contracts`, and both clients render and edit it.
- **The AI `QUIZ` task:** makes such cards from any note the person can read (ADR-0059).

The architecture has `core` own quizzes: `Quiz ──< Question ──< Choice; QuizAttempt ──< Answer`, with
`QuizAttempt.clientOpId` unique, quizzes in the 30-day trash, and "weak topics" from accuracy over the last three
attempts. That implies people take a quiz more than once. Nothing sets time limits, due dates or how a score is counted.

## Decision

1. **The model, in `core`:**
   - `ClassQuiz`: the class, its author, a title, an optional source note, `publishedAt` and `deletedAt`.
   - `ClassQuizQuestion`: a position and the question as **quiz card content**, checked with the contracts' quiz
     schema (any page anchor dropped).
     - The architecture's `Choice` is not a table: choices live in the question's content with their short ids, as
       on every quiz card. Clients reuse their renderers, and the AI's cards and a note's quiz cards need no
       conversion.
     - The source is the note (`sourceNoteId`), not one of its versions: a teacher composes from their own draft.
   - `QuizAttempt`: the quiz, the person, `clientOpId` (unique), the score and the number of questions.
   - `QuizAnswer`: the attempt, the question, the chosen ids, and whether they were right.
2. **Publishing:** `publishClassQuiz` (staff, `CLASSROOM_PUBLISH_QUIZ`) takes a title and 1–50 questions in one go.
   There is no server-side draft: clients compose and publish.
   - **"Generated from notes":** clients run the AI `QUIZ` task on one of the teacher's notes, offer its cards to keep
     or drop, and add questions by hand. They may pass the note as the source; it is kept only if the teacher can
     read it (`NOTE_ACCESS`).
   - A published quiz is not edited: its attempts would no longer match. Staff delete it, which puts it in the trash.
   - Publishing sends `QuizPublished` with `authorId` and up to 1,000 `memberIds` per event, as `ClassroomPosted`
     does. The two fields are optional and additive in v1, as ADR-0045 did. `communication` tells the other members
     (`QUIZ_PUBLISHED`, now settable, with its own push text), linking to the quiz.
3. **Taking it:** every member may take it; a student's attempts are the ones that count.
   - Questions come without the correct answers or explanations until the viewer has submitted once.
   - `submitQuizAttempt` scores on the server. A question is right when the chosen ids are exactly the correct ones.
     The score is the number right out of the number of questions; unanswered questions are wrong.
   - The answer gives each question's result, the correct answers and the explanations.
   - The same `clientOpId` returns the same attempt: phones retry safely (§11's append-only rule).
   - Attempts may be repeated, for practice. **The first attempt is the score:** the one Phase 6's performance views
     will use. Later attempts are kept too, for the weak-topics rule.
4. **What staff see now:** how many students have submitted. Per-student results are the performance view, which
   waits for Phase 6 (ADR-0046). Their permission is already in the matrix.
5. **Data:**
   - A person's attempts and the quizzes they published are in their data export (`data/core`, ADR-0018).
   - Their attempts are deleted with their account (`UserDeleted`). Quizzes they published stay with the class, as its
     announcements do.
   - Leaving a class keeps the attempts.
   - A class's quizzes go with the class.
6. **Limits** (constants beside the service): a title of 120 characters, 50 questions, 30 quizzes an hour per person,
   and 60 attempts an hour per person.

## Consequences

- The matrix test's "not yet" entry for `CLASSROOM_PUBLISH_QUIZ` becomes real allowed and refused cases.
- Quizzes are class content like announcements: reports and moderation of their words reuse ADR-0051 when they are
  first needed. Nothing is scored for moderation at publish.
- Time limits, due dates and reordering questions are not part of this; they can be added to `ClassQuiz` without
  changing attempts.

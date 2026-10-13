# Classroom quizzes (P5g)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.39.0
- Spec: §4.1, §6.1, §9; ADR-0064
- Breaking: no

## What changes for clients

- **`ClassroomActions.publishQuiz`**: the class's teacher and TAs.
- **`Classroom.quizzes(first)`**: members only (empty otherwise); the newest first.
- **`classQuiz(id)`**: a quiz of a class the viewer is in, or null.
  - It has its `title`, `author`, `publishedAt` and `questionCount`.
  - `questions` come in order. Each has `question` (rich text), `choices` (`id`, inline `content`) and `multiple`.
  - `correct` and `explanation` are null until the viewer has submitted once. Staff always see them.
  - `myAttempts`: the viewer's own, newest first. The last one in the list is their score.
  - `submittedCount`: staff only, the number of the class's students who have submitted.
  - `viewerCanDelete`.
- **`publishClassQuiz(input: { classroomId, title, questions, sourceNoteId })`**: staff only.
  - Each question is quiz card content (`question`, `choices`, `correct`, `multiple`, `explanation`). A page anchor is
    dropped.
  - 1–50 questions; titles up to 120 characters.
  - VALIDATION names the first incomplete question (`field: ['input', 'questions', '<index>']`).
  - The class's other members get a `QUIZ_PUBLISHED` notification whose `path` is
    `/classes/<classroomId>/quizzes/<quizId>`. The category can now be set in notification settings.
- **`submitQuizAttempt(input: { quizId, clientOpId, answers: [{ questionId, choiceIds }] })`**: any member.
  - The server scores it: a question is right when exactly its correct choices are chosen. Questions left out are
    wrong.
  - It returns the `attempt` (score, total, each answer's result) and the `quiz` again, now with its answers.
  - Sending the same `clientOpId` again returns the same attempt.
  - Attempts may be repeated; the first is the score.
- **`deleteClassQuiz(input: { quizId })`**: staff only; the quiz goes to the trash.
- **Data export:** `data/core/class-quizzes.json` (quizzes the person published) and `data/core/quiz-attempts.json`.

## What clients should do

- **A Quizzes tab on the class:** every member sees the list with their score; staff get "New quiz".
- **The quiz builder (staff):**
  - "Make questions from a note" runs the AI `QUIZ` task on one of the teacher's notes and offers its cards as
    questions.
  - "Add a question" by hand.
  - Remove questions, then publish with the note as `sourceNoteId`.
- **Taking a quiz:** answer, submit with a new `clientOpId` (keep it until the answer arrives, so a retry is the same
  attempt), then show the score and each question's result and explanation. Offer "Try again".
- **Notifications:** `QUIZ_PUBLISHED` opens the quiz; add it to the notification settings list.

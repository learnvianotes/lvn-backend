# ADR-0070: Exams, weak topics and Exam Readiness

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents
- Spec sections: §14.2 (weak topics, exam planning), §18 (Phase 6); ADR-0030, ADR-0067, ADR-0068, ADR-0069

## Context

§14.2 asks for two things:
- **Weak-topic detection:** a topic with quiz accuracy under 60 % over its last 3 attempts, or with no revisit in the
  14 days before an exam.
- **Exam planning:** a learner enters an exam's name, date and topics. The planner spreads revision sessions back from
  the date and reminds through notifications.

ADR-0030 adds **Exam Readiness**: a % per exam from topic mastery (FSRS recall strength and quiz accuracy), with a
target line to the exam date, and a suggestion of a higher weekly target three weeks out. Its Today ring takes today's
plan tasks and one weak topic (ADR-0069 left both to this slice).

Facts that shape the design:
- **Topics have one key everywhere.** Learning events and history name a topic `topic:<uuid>` (a notes topic) or
  `core:<subject>/<topic>` (a /core page, ADR-0023). Time per topic per day is already rolled up
  (`core.LearningDayTopic`).
- **Recall strength exists.** Each studied card has FSRS state (`core.CardReview`, ADR-0068); its retrievability now
  is one call. Cards belong to notes, and notes to topics (`notes.NoteTopic`).
- **Quiz results exist, but not by topic.** Class quizzes (ADR-0064) record `QUIZ_COMPLETED` with the score; the quiz
  cards inside notes are checked in the apps and recorded nowhere.
- **/core is read signed out** (ADR-0002 amendment), so /core topics have no cards and, for now, no quiz results.

## Decision

1. **Exams.**
   - `core.Exam(id, userId, name, date, createdAt)` and `core.ExamTopic(examId, topicKey)`, 1–20 topics an exam, at
     most 10 upcoming exams a person.
   - The date is a learning day in the person's zone, today or later; a past exam stays in the list for 7 days, then
     only in the export.
   - Topics are the notes topics the person may use: curated ones and their own proposals. The curated topics came
     from the /core catalog, so a curated topic is also a /core page: time on `core:<subject>/<topic>` counts for
     `topic:<id>`. The notes context answers through a new `TOPICS` facade.
   - The server records `EXAM_CREATED`.
2. **Quiz results by topic.**
   - `QUIZ_COMPLETED` carries the topics of what was quizzed and `{ answered, correct }` (and `total`, when questions
     can be left unanswered: those count as not known).
     - A class quiz takes its source note's topics.
     - A quiz card checked in a note is sent by the app, with the note's topics: one answer, right or wrong.
   - A flashcard review now carries its note's topics too, so its time counts on them.
   - On ingest, each such event adds a row per topic to `core.TopicQuizResult(userId, topicKey, eventId, at,
     answered, correct)`.
3. **Weak topics** (§14.2), per person:
   - **low accuracy:** the last 3 results on a topic have under 60 % right in all;
   - **not revisited:** a topic of an exam in the next 14 days with no learning or reading time in the last 14 days.

   Each weak topic carries its reason. Computed when asked, from the rollups. A topic with any results counts; it
   does not wait for three. Every topic of an exam in the next 14 days starts weak until it is visited.
4. **The plan.**
   - Revision sessions go on the days from today to the day before the exam, at most one session a day for each exam.
   - Each topic gets one session; a weak topic gets two. Weak topics come first.
   - The sessions are spread evenly back from the exam. When there are more sessions than days, a session takes
     several topics.
   - `core.ExamPlanTask(id, examId, userId, day, topicKeys[])`.
   - Changing the exam's date or topics plans the days from today again; past days keep their tasks.
   - A task is **done** when, on its day, the person spent 10 minutes on its topics (reading, focus, reviews and
     quizzes all count), or answered a quiz on them. It is done by learning, as ADR-0030 asks: there is no "mark done".
5. **Exam Readiness.**
   - Per topic:
     - recall: the mean FSRS retrievability now of the person's studied cards in the topic's notes;
     - accuracy: right answers over answers in the topic's last 3 quiz results.
   - The topic's mastery is 0.6 × recall + 0.4 × accuracy. A topic with only one of them takes it whole; a topic with
     neither counts 0.
   - Readiness is the mean mastery of the exam's topics, as a whole %.
   - The **target line** rises evenly from the day the exam was added to 80 % on the exam's day. Each exam shows where
     the line is today.
6. **Suggestions.**
   - From 21 days before an exam, Rhythm suggests one more planned day a week, up to 6, until the exam is past.
   - It is only a suggestion: the person applies it, or not. Nothing changes by itself.
7. **Today ring** (ADR-0069 item 7) gains two kinds of item:
   - `PLAN_TASK`: today's tasks done of today's tasks;
   - `WEAK_TOPIC`: one weak topic (the one with the nearest exam, then the lowest accuracy), done at 10 minutes on
     it today.
8. **Reminders.**
   - From 18:00 in the person's zone, a person with an exam task left today gets one notification,
     `REVISION_REMINDER` (a category kept for this since Phase 4, now one people can turn off). It opens the exam.
   - The worker checks hourly. The notification goes through the communication context, so quiet hours and the
     person's choices apply to its push. The push says only "Today's revision for your exam is waiting" (ADR-0021: no
     user text in a push).
   - It never speaks of loss; there is none on a day without a task.
9. **API:**
   - `exams` and `exam(id)` give each exam its topics, plan tasks, Readiness and the target today;
   - `createExam`, `updateExam` and `deleteExam`;
   - `weakTopics` lists weak topics with their reasons;
   - `examTopicOptions(query)` finds the topics to choose from;
   - `rhythm.suggestion` carries the weekly-target suggestion.

## Consequences

- **The apps record quiz cards they check.** This is the first time an answer inside a note is recorded. It is the
  person's own result, and it feeds only their weak topics and Readiness.
- **Readiness starts low and honest.** A new exam whose topics have no cards or quizzes reads 0 %. The plan's first
  sessions move it.
- **/core topics only count by time for now.** They have no cards and no quiz results until /core quizzes record
  answers for signed-in people; they still get plan tasks and the "not revisited" rule.
- **The 80 % target and the 0.6/0.4 weights are a first guess.** ADR-0030's evaluation (FSRS retention, exam-plan
  completion) is where they get tuned.

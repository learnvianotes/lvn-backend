# Weekly tasks and cooperative goals (P8b)

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.54.0
- Spec: ADR-0081
- Breaking: no

## What changes for clients

- **`weeklyTasks`**: the viewer's tasks for this Rhythm week.
  - Fields: `weekStart` (YYYY-MM-DD) and `max` (3).
  - Each task has `kind`, `target`, `topicId`, `topicTitle`, `plan`, `progress` and `done`.
  - `progress` is read from the week's learning:

    | Kind | What counts |
    | --- | --- |
    | `REVIEWS` | Graded flashcards |
    | `QUIZ_ANSWERS` | Answers, on the topic or any |
    | `TOPIC_MINUTES` | Learning minutes on the topic |

- **`taskSuggestions`**: tasks worth setting, with `why`. They come from:
  - the next exam's weakest topic (60 minutes);
  - a topic answered under 60 % right in the last four weeks (20 answers);
  - the flashcards due by Sunday.

  Never one already set.
- **`addWeeklyTask(input: { kind, target, topicId?, plan? })`** answers `WeeklyTaskPayload`. These are user errors:
  - a fourth task: "You have 3 tasks this week. Finish or remove one first.";
  - a target out of range:

    | Kind | Range |
    | --- | --- |
    | Reviews | 5–500 |
    | Quiz answers | 5–300 |
    | Topic minutes | 10–600 |

  - `TOPIC_MINUTES` without a topic;
  - a topic the viewer can't use;
  - a plan over 140 characters.
- **`updateWeeklyTask(input: { id, target?, plan? })`**: an empty plan clears it. **`removeWeeklyTask(input: { id })`**
  removes it. Only the owner's tasks are found.
- **`Classroom.rhythmRing.goal: ClassGoal`**: null while off.
  - Fields: `target`, `progress`, `sharePerStudent`, `automatic` and `reached`.
  - `progress` is each student's counted days up to `sharePerStudent`.
  - `parts` (each student's capped days) is for teachers and TAs only, and null for students.
- **`setClassGoal(input: { classroomId, on, target? })`**: teachers and TAs only. A student gets FORBIDDEN, "Only the
  class's teachers set its goal." Without a `target`, the goal sizes itself:
  - from the class's last four closed weeks (the median plus a tenth);
  - with no history, six tenths of the students' planned days;
  - never under one day a student.
- **`RhythmBuddy.together: BuddyTogether!`**: both buddies' counted days against both targets.

## Data

- **New tables:** `core.WeeklyTask` (by person and week start) and `core.ClassGoal` (one per class).
- **Migration:** `20261102090000_tasks_goals`.
- **Export:** `data/core/weekly-tasks.json`.
- **Erasure:** removes a person's tasks.

# ADR-0081: Weekly tasks and cooperative goals

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web and Mobile agents
- Spec sections: §18 Phase 8 ("tasks", leaderboards amended by ADR-0030 into cooperative class and buddy goals),
  ADR-0069 (Rhythm), ADR-0072 (buddies and the classroom ring); research in
  [plans/phase-8.md](../plans/phase-8.md#research-this-plan-rests-on-2026-10-14)

## Context

- **What the spec asks for:** "tasks" and opt-in leaderboards. ADR-0030 replaced the leaderboards with cooperative goals
  for a class and for buddies.
- **What the research says about goals:**
  - Specific goals with feedback work (Locke and Latham).
  - A "when and where" plan makes a goal more likely to be reached (d ≈ 0.65).
  - Cooperation without competition beats competition (Johnson et al.).
- **What it says about competition:** it costs weaker learners, who take part less once others dominate.
- **Two warnings:**
  - Tasks that count an easy action pull effort towards that action only briefly.
  - The UK children's code warns against reward loops that extend use.

## Decision

1. **Weekly tasks (`core.WeeklyTask`).**
   - A person keeps at most three tasks a week.
   - **Kinds:**

     | Kind | Target | On a topic |
     | --- | --- | --- |
     | `REVIEWS` | Flashcards graded | No |
     | `QUIZ_ANSWERS` | Quiz answers | Optional |
     | `TOPIC_MINUTES` | Learning minutes | Required |

   - **Picking a task:**
     - The person picks it, usually from suggestions (`taskSuggestions`) built from:
       - the next exam's weakest topic;
       - weak topics;
       - the flashcards due this week.
     - They may change the target.
     - They may add a plan of up to 140 characters ("After lunch, in the library").
   - **Progress** is counted from what the learning events already record for the week (the Rhythm week, Monday to
     Sunday in their zone):
     - graded reviews;
     - quiz results on the topic;
     - learning minutes on the topic.
   - **A task is done** once its progress reaches the target.
   - **An unfinished task** ends with the week. Nothing is said about it, and nothing is lost.
   - **No reward:** tasks earn no points and no achievements. Their worth is the learning they stand for.
2. **A class goal (`core.ClassGoal`, one per class).**
   - Staff turn it on for their class.
   - **The target:** counted Rhythm days across the class this week. It is either:
     - set by staff; or
     - sized automatically from the class's last four closed weeks (their median, plus a tenth). With no history, it
       is six tenths of the students' planned days. It is never below one day a student.
   - **Each student's share** counts up to `ceil(1.5 × target ÷ students)` days. No one carries the goal alone, and no
     one is its bottleneck.
   - **Who sees what:**
     - Classmates see the total against the target on the class's Rhythm ring.
     - Staff also see each student's part, privately, beside the ring.
     - A goal not reached shows how far it got, and the next week starts again.
3. **A buddy goal.**
   - Rhythm buddies already see each other's week: counted days, target and whether it is met (ADR-0072). So each pair
     also sees one goal: "You and Asha: 6 of 8 days together".
     - The days are the two people's counted days this week.
     - The target is the sum of their weekly targets.
   - It needs no setting of its own: it adds nothing that was not already shared.
   - Nothing is compared between pairs or between people.
4. **Nothing ranks.** No goal lists people in order, and no goal compares one class or pair with another.
5. **Data rights:**
   - A person's tasks are in their data export, and erased with the account.
   - A class goal belongs to the class, and goes with it.

## Consequences

- A learner turns an intention into a plan they can see met, without a streak to break.
- **What a class sees:** its total, never who is behind. Staff, who already see class performance, see each student's
  part.
- **What a buddy goal reveals:** nothing new. It frames as one shared goal what two buddies already see of each other.
- **What tasks don't do:** they track the learning that matters (reviews, retrieval, time on a topic), but not what was
  learned. Achievements (ADR-0080) mark that.

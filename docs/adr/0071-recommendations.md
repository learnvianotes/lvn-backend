# ADR-0071: Rule-based recommendations

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents
- Spec sections: §14.3, §17.1 (privacy: recommendations), §18 (Phase 6: "recommendations respect visibility");
  ADR-0067, ADR-0070

## Context

§14.3 asks for rule-based recommendations, computed hourly per active person into
`Recommendation(userId, kind, entityId, score, reason, expiresAt)`. It lists five rules:
- revise weak topics;
- continue unfinished notes;
- an upcoming exam's topics;
- popular public notes in the person's subjects;
- quizzes on recently read topics.

Every item carries a human-readable reason. Later, an embedding model may write into the same table. Results are
filtered by the read predicate when read, not only when computed. §17.1's privacy suite has two todos waiting:
- B gets no recommendations that draw on A's private notes;
- unpublishing removes a note from recommendations within 60 seconds.

Facts that shape the design:
- **Learning events know what a person read and when** (ADR-0067), by note and by topic.
- **Weak topics and exams exist** (ADR-0070), with reasons.
- **Interests are on the profile:** `StudentProfile.interestTopicIds`, notes topics chosen at sign-up and in settings.
- **Popularity can come from the same events.** How many people opened a public note in the last 30 days is a count
  over learning events, with no new counter to keep.
- **Notes own visibility.** Core reads it only through `NOTE_ACCESS` (ADR-0047).

## Decision

1. **Kinds**, each with a fixed score band so the rules mix predictably (higher first):

   | Kind | Entity | Rule | Score | Reason |
   | --- | --- | --- | --- | --- |
   | `EXAM_TOPIC` | a topic | a topic of an exam in the next 14 days, weakest mastery first | 80–100 | "On your plan for <exam>, in N days" |
   | `REVISE_TOPIC` | a topic | a weak topic (ADR-0070), not already an exam topic above | 60–80 | "Under 60 % in your last quizzes" / "Not revised in 14 days" |
   | `CONTINUE_NOTE` | a note | a note the person opened in the last 14 days, last more than a day ago, not their own | 40–60 | "You were reading this on <day>" |
   | `QUIZ_ON_TOPIC` | a note | a public note with a quiz card, on a topic the person read in the last 7 days, not opened by them | 30–50 | "A quiz on <topic>, which you read this week" |
   | `POPULAR_NOTE` | a note | a public note on one of the person's interest or exam topics, opened by the most people in 30 days | 10–30 | "Popular in <topic>" |

   A thing that two rules give (a popular note the person was reading) appears once, under the higher band. Notes
   the person opened are not offered again as quizzes or popular notes. Interests come from the users context
   through `PEOPLE.interestTopicIds`; public notes on topics through `NOTE_ACCESS.publicOnTopics`.

   Within a band, the score orders by the rule's own measure (sooner exam, lower accuracy, more recent, more readers).
2. **Computation.**
   - Hourly, the worker recomputes for people active in the last 7 days.
   - It replaces each person's rows in one transaction, at most 20 a person, each expiring after 2 hours.
   - A person's list is also recomputed when they ask and theirs is missing or expired, so a new account is not empty
     for an hour.
3. **Visibility when read.**
   - `recommendations` reads the person's rows, drops expired and dismissed ones, and passes every note through
     `NOTE_ACCESS` again (`readable(viewerId, ids)`, one query). It also drops notes by people the viewer blocked, and a
     popular or quiz note that is no longer public. Topics pass through `TOPICS.usable`.
   - Anything that left the person's view disappears at once, not at the next hour. The 60-second budget is met by
     the read.
   - Computing uses the same predicate, so a private note never enters anyone else's rows.
4. **Dismissing.** `dismissRecommendation(kind, entityId)` hides an item for 30 days
   (`core.RecommendationDismissal`), across recomputes.
5. **API.** `recommendations(limit)` (signed in, default 10) gives `kind`, `reason`, `score`, and the `note` or
   `topic` it is about.
6. **Privacy suite.** The two todos become tests:
   - A's private note never reaches B's recommendations, whatever B read;
   - a note made private disappears from them on the next read.

## Consequences

- **No new popularity counter.** Popularity is a grouped count over the last 30 days of `NOTE_OPENED` events, taken
  hourly. It is cheap at this size and can move to a rollup later.
- **The table is ready for a model.** A later embedding-based recommender writes rows of its own kind. The read path,
  with its visibility check, stays the same.
- **Recommendations explain themselves**, so a wrong one is visible and easy to dismiss.

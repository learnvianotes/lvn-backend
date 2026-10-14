# ADR-0080: Achievements, points and contributor levels

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web and Mobile agents
- Spec sections: §18 Phase 8 ("achievements, points ledger, contributor levels"), ADR-0030 (Rhythm; no rewards for
  mere participation), ADR-0027 (public counts as milestones), §15.2 (minors); research in
  [plans/phase-8.md](../plans/phase-8.md#research-this-plan-rests-on-2026-10-14)

## Context

Board A's Profile shows achievements, and the spec asks for a points ledger and contributor levels. The research
behind the Phase 8 plan sets the limits:
- **Rewards for activity:** they lower interest in it, most of all in children (Deci et al. 1999). Badges pull effort
  briefly, towards whatever they count (Anderson et al. 2013).
- **What helps:** feedback that tells someone they are competent, and recognition from peers (Sailer et al. 2017;
  Restivo and van de Rijt 2012).
- **Points that can be farmed will be:**
  - Stack Overflow caps votes, reverses serial voting and drops votes on deleted posts.
  - Wikipedia gates rights on account age.
  - Karma gates are farmed within weeks.
- **Children's data:**
  - The UK children's code keeps a child's data from other users unless the child changes the setting.
  - India's DPDP Act forbids behavioural monitoring of children.

## Decision

1. **Points come only from what other people do with someone's public work.**
   - **Sources:**

     | Source | Points |
     | --- | --- |
     | A reaction on their public note | +1 |
     | A fork of their public note | +5 |
     | A resource of theirs that moderators approve | +10 |

   - **Never counted:** their own actions, the app being opened, time spent, notes written, or reviews done.
   - **Who counts as an actor:**
     - only verified accounts at least 7 days old that are not suspended;
     - not the recipient, and not someone either of them has blocked;
     - the same actor at most 5 times in 7 days towards the same person.

     Moderators' approvals are exempt from these checks.
   - **Reactions** earn a person at most 50 points a day.
2. **The ledger is append-only (`core.PointsEntry`).**
   - **Fields:** recipient, delta, rule, source (note or resource), actor, and the subject of the note's topics.
   - **Awarding once:** an award is keyed by rule, source and actor, so a retried or repeated award gives nothing.
   - **Reversals** are new entries. They follow when:
     - the reaction is taken back;
     - the note stops being public (made private, trashed or hidden by moderators);
     - the resource leaves the catalogue.

     Reacting again after taking a reaction back earns again; reversing and re-awarding are both keyed, so neither is
     ever doubled.
   - **Balances:** a person's points are the sum of their entries, never below 0.
3. **Levels are derived, never stored.**

   | Points | Level |
   | --- | --- |
   | 0 | Newcomer |
   | 50 | Contributor |
   | 250 | Trusted contributor |

   - A level is lost when points fall below it.
   - **What a Trusted contributor gets:** they may submit 20 resources a day instead of 10. Moderation still decides
     every one.
4. **Achievements mark competence or what others found useful, never activity.** The rules are defined in code, and
   each tier is awarded once (`core.Achievement`, unique per person and key):

   | Achievement | Tiers | When |
   | --- | --- | --- |
   | Topics mastered | 1, 5, 20, 50 | Topics at mastery ≥ 0.8 (0.6 × FSRS recall + 0.4 × quiz accuracy, as Readiness counts it), with at least 5 studied cards or 10 quiz answers on the topic |
   | Quiz master | 1, 5 | Topics with at least 30 quiz answers and 90 % correct |
   | Exam ready | 1, 5 | Exams that reached the Readiness target (80) before their date |
   | Rhythm weeks | 4, 12, 26, 52 | Weeks met (ADR-0069) |
   | `<Subject>` contributor | 50, 250 | Points from notes on that subject |

   - **When rules are checked:** a worker job (`core.engagement`, debounced per person) runs after learning events and
     after points change.
   - **Telling the person:** an `AchievementEarned` event becomes an in-app notification that says what was learned
     ("You've mastered 5 topics"). It is never sent as a push.
5. **Private by default.**
   - A person's achievements, points and level are theirs alone.
   - An adult may show their achievements and level on their profile (`setAchievementsVisibility`).
   - Someone under the digital-consent age (18 by default) cannot: the setting is refused and nothing is shown, whatever
     was set before.
   - Points history is visible only to its owner, without the actors' names.
6. **Data rights:** the export carries a person's ledger and achievements. Account erasure deletes them, along with the
   entries they caused for others.

## Consequences

- Points reward work other people use, so the cheap ways to inflate them earn nothing:
  - reacting to oneself;
  - new or unverified accounts;
  - one friend reacting repeatedly.
- **What remains possible:** a ring of verified, week-old accounts can still trade a few points. The weekly limit per
  pair and the daily cap keep this small. Detecting rings is left to Phase 9's review.
- **Republishing:** a note made private loses its points. Republishing it doesn't bring them back; new reactions earn
  anew.
- **Board A's achievements:**
  - "7 Day Streak" is drawn as Rhythm weeks.
  - "Top 10% Learner" isn't built, since it is a rank.
  - "DSA Contributor" and "Quiz Master" are as drawn.

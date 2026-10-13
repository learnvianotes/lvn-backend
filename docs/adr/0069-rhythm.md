# ADR-0069: Rhythm, built

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents
- Spec sections: §14.2 (amended by ADR-0030), §18 (Phase 6: "streak timezone tests"); ADR-0030, ADR-0067, ADR-0068

## Context

ADR-0030 chose **Rhythm** over daily streaks. It left to the build:
- what a "planned day" is;
- how a week, a comeback and a pause are counted;
- what "this term" means;
- where the Today ring's items come from.

Learning events (ADR-0067) already give each person's days in their time zone, with a 04:00 rollover. Each day says
whether it counts: 10 learning minutes or 10 reviews.

## Decision

1. **Planned days.**
   - A learner picks 3–6 weekdays (the default is Monday, Tuesday, Thursday and Saturday). The number is the weekly
     target.
   - Other days are rest. A counted rest day still counts towards the week, but missing one is nothing.
   - The days live on `core.LearnerSettings` (`plannedDays`, a set of ISO weekdays 1–7).
   - A change applies from the current week on.
2. **The week.**
   - Monday to Sunday in the person's time zone, by learning day.
   - `countedDays` is the number of counted days. The week is **met** when `countedDays` reaches the target.
   - Past weeks are closed hourly (a person's week ends at 04:00 on Monday in their own zone) into
     `core.RhythmWeek(userId, weekStart, targetDays, countedDays, comebacks, pausedDays)`. The current week is computed
     when asked. A week closed before a late event arrived is reopened by that event.
3. **Never miss twice.**
   - A planned day that ended uncounted, and not paused, is a miss.
   - Nothing before the person's first day is planned or missed. Their first day is the earlier of the day they joined
     and their first learning day (old-site days included). A new account's first week aims only for the planned days
     from that day on.
   - The day after a miss, Today shows a **Comeback**: the same low bar, with a bigger ring fill.
   - If that day counts, the week's `comebacks` goes up and the person is told plainly ("Back on rhythm").
   - Nothing ever says "lost".
4. **Pauses.**
   - `core.RhythmPause(userId, from, to, reason)`, with reasons EXAMS, ILLNESS, FESTIVAL, TRAVEL and OTHER, for up to
     14 days a term.
   - Paused planned days are neither misses nor needed: the week's target drops by the planned days paused, never
     below 1.
   - A pause can end early; the days it did not use come back.
5. **Term.** A half-year (January–June, July–December) until classes define terms. Pauses and "Rhythm weeks this
   term" reset with it; all-time counters never do.
6. **Counters** (never reset):
   - Rhythm weeks this term;
   - Rhythm weeks all time;
   - counted days all time (the old site's included, ADR-0023).

   No streak and no "days in a row" is shown anywhere.
7. **Today ring.** Its items are:
   - **Reviews due:** today's FSRS queue (ADR-0068), at most 20;
   - **today's plan tasks:** exam planner, P6e;
   - **one weak topic:** P6e.

   Each item fills its share as learning actions happen. The ring is full when every item is done. The day counts at
   the low bar whatever the ring shows.
8. **API:**
   - `rhythm` gives this week's days (each counted, planned, missed, paused or to come), the target, met, the counters,
     today's ring, whether today is a comeback, and pauses left this term.
   - `setRhythmPlan(plannedDays)`, `pauseRhythm(from, to, reason)` and `endRhythmPause`.
9. **Time zones.**
   - Everything is computed in the learner's time zone, wall-clock based, with 04:00 rollover.
   - A change of zone moves the day boundary from then on; past days keep the zone they were recorded in.
   - Tests cover India, a negative offset, both daylight-saving changes, and a learner who travels across the date
     line mid-week.

## Consequences

- **Rhythm reads only rollups** (`LearningDay`), so it is cheap to show on every Home.
- **Weeks can change after the fact.** A phone that was offline all week brings its events in when it comes back, and
  the week counts them, as ADR-0030 intends.
- **ADR-0030's A/B test needs analytics** (PostHog) and a streak arm to compare against. It is not run until the owner
  sets up analytics and asks for it.

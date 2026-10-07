# ADR-0030: Rhythm — a weekly, forgiving habit system instead of daily streaks

- Status: Accepted (owner, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §14.2 (streaks), §18 Phase 6 and Phase 8
- Amends: §14.2 "Streak = …" bullet; §9.1 and §9.3 streak jobs and pushes; Phase 6 "streaks"; Phase 8 leaderboards

## Context

The owner does not want daily streaks as the core mechanic: they want "something students actually follow", fast and
responsive with good animations. Research summary (full sources in the research notes of 2026-10-08):

- Daily streaks reliably raise *app use*; their effect on *learning* is weak. A 60,000-student field experiment in Peru
  found streak messages increased platform use, but tested learning was no better than with personalised reminders
  (NBER w34173). Duolingo's gains from streak features are activity gains (day-7/day-14 retention, +40 % 7-day
  streakers after lowering the bar).
- A **broken** streak lowers later engagement, more when people blame themselves (University of Delaware, seven
  studies). Habit formation takes ~66 days on average and a single missed day barely matters (Lally et al. 2010).
- Forgiving designs work better: **flexible** timing beat fixed timing (Management Science 2021); goals with built-in
  **emergency skips** kept 55 % going after a miss vs 37 % (UCLA Anderson); a **comeback bonus** was the best arm
  (+27 % weekly visits) in a 61,000-person mega-study (Penn/Wharton). Progress monitoring helps goals (d = 0.40,
  Harkin et al. 2016); people speed up near a goal (goal-gradient) and start goals on "fresh starts" like Mondays.
- What builds learning is **retrieval practice and spacing** (Dunlosky et al. 2013) and **mastery**: Khan Academy's
  streak is weekly and mastery-based.
- Competition alone, global leaderboards and rewards for mere participation harm motivation (Deci et al. 1999;
  exposure to top peers' work raised drop-out). Cooperative goals work best for behaviour (gamification meta-analysis).
- Apple let users **pause** rings without losing awards (watchOS 11); Headspace lets users hide the streak.

## Decision

**Rhythm** has three layers.

1. **Today ring — what to do now.** Built automatically from FSRS reviews due (capped at ~20 cards / 15 min; overflow
   spread over the next days), today's exam-plan tasks, and one weak topic. Only **learning actions** fill it: graded
   reviews, quiz answers, plan tasks, focus sessions ≥ 10 minutes on a topic, and reading a `/core` topic or note to
   the end followed by a recall check. Opening the app, scrolling the feed or passive reading never count.
2. **Weekly Rhythm — consistency without fragility.**
   - A **day counts** at a low bar: 10 learning-minutes or 10 reviews. A full ring is a bonus, not the bar.
   - The student picks **3–6 target days a week** (default 4). Weeks run Monday–Sunday in their time zone; the day
     rolls over at 04:00. Unplanned days are rest, never penalised.
   - **Never miss twice:** after a missed planned day, the next session offers a **Comeback** ring with a bigger fill and
     a small bonus. LVN never says anything was "lost".
   - **Pause** for exams, illness, festivals or travel: up to 14 days a term, history kept.
   - **Counters never reset:** "Rhythm weeks this term: 9", topics mastered all-time. Missed weeks look neutral, not red.
3. **Exam Readiness — why it matters.** Each exam in the planner (§14.2) shows a Readiness % from topic mastery (FSRS
   recall strength + quiz accuracy) with a target line to the exam date. Three weeks out, LVN *suggests* a higher
   weekly target; the student confirms.

**Social — cooperative only.** Up to five **Rhythm buddies** (followed or connected people, ADR-0013/0016) and a
**classroom ring** of shared weekly progress. Buddies see "studying now" during each other's focus sessions; a
session can carry a Google Meet link — no LVN live rooms (owner decision, ui-reference item 3). **No global
leaderboards**: Phase 8's opt-in leaderboards become cooperative class and buddy goals.

**Feel.** Feedback within 100 ms of a tap (optimistic updates); ring fills animate in 300–400 ms; a 10–20 ms haptic
tick per review; full celebrations only for a completed week or a readiness milestone; reduced-motion respected;
no push after 22:00 (§9.3 quiet hours).

**Never:** a resetting daily counter as the headline; zeros or broken-chain visuals; loss-framed messages; streak
freezes for sale; rewarding app opens or time in app; review backlogs without a cap.

## Validation

A/B test against the spec's streak design, randomised by user (by classroom for the social arm), 8 weeks plus a
holdout through one exam cycle, pre-registered:

- **Primary:** week-8 *learning-active* retention (≥ 1 counted day that week), target +5 % relative.
- **Health:** weekly-target attainment 45–65 %; comeback within 48 h of a missed planned day ≥ 55 %.
- **Learning:** FSRS true retention within 3 points of target; median review backlog < 1 day; exam-plan completion
  ≥ 70 % by exam date.
- **Guardrails (must not rise):** sessions 00:00–05:00, push opt-outs, uninstalls, a 1–5 "this app stresses me" score.
- **Speed:** tap-to-feedback < 100 ms p95; web INP ≤ 200 ms p75; < 1 % dropped frames.

## Consequences

- Replaces `Streak` with `RhythmWeek(userId, weekStart, targetDays, countedDays, comebacks, paused)`, `RhythmPause`
  and `ExamReadiness` read models in `core` (Phase 6); old-site study days (ADR-0023) seed history.
- Alternatives considered: *Mastery Garden* (topics as plants that grow with mastery — strongest learning link,
  weaker daily pull) and *Study Crews* (3–5 person crews sharing a weekly ring — strongest belonging, cold-start risk).
  Either can be layered on later.

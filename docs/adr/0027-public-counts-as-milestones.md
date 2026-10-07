# ADR-0027: Public user counts appear only as milestones

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §12.1 (landing), §15.2
- Amends: ui-reference item 8 ("Join 50,000+ students")

## Decision

- No user numbers on the landing page or anywhere public until a **milestone** is reached: 1,000, 2,000, 5,000,
  10,000, 20,000, 50,000, 100,000, 200,000, 500,000, 1,000,000, then whole millions.
- The number counted is **active learners**: verified accounts with a learning event in the last 30 days. Computed
  nightly in `core`; the public API exposes only the milestone (`publicStats.activeLearnersMilestone`, `null` below
  1,000) — the exact figure never leaves the backend.
- Shown as "1,000+ learners", "10,000+ learners". The same rule applies to any other public count we add later.
- `MILESTONES` and `milestoneFor()` live in `@lvn/contracts` so web, mobile and backend round identically.

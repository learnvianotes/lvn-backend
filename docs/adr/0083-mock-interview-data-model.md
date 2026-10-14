# ADR-0083: Mock interviews, the data model only

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend agent
- Spec sections: §1 (company features out of scope: "design the schema so they can be added without rewrites,
  implement nothing"), §18 Phase 8 ("mock-interview data model only"; exit: no company features); research in
  [plans/phase-8.md](../plans/phase-8.md#research-this-plan-rests-on-2026-10-14)

## Context

The spec asks Phase 8 for a mock-interview data model and nothing else. Recruitment, hiring challenges and career
events are company features, which are out of scope.

Google's guide to structured interviewing finds that set questions, with rubrics anchored to observed behaviour, make
ratings fairer and more accurate. A later mock-interview feature (peer practice, a teacher interviewing a student, or
practising alone) would need:
- templates of questions;
- rubrics;
- time slots;
- the interviews;
- feedback.

## Decision

1. **Tables in `core`, with no GraphQL, no routes, no UI and no jobs:**

   | Table | What it holds |
   | --- | --- |
   | `MockInterviewTemplate` | Title, topic key, level (`INTRO`, `CORE` or `ADVANCED`), author |
   | `MockInterviewQuestion` | Prompt, what a good answer shows, order |
   | `InterviewRubricCriterion` | Name, one description for each of the four levels, order; one rubric per template |
   | `InterviewSlot` | Host, start, end, time zone, capacity |
   | `MockInterview` | Template, slot, candidate, interviewer, kind (`PEER`, `TEACHER` or `SELF`), status (`REQUESTED`, `SCHEDULED`, `DONE` or `CANCELLED`), consent to record (off by default) |
   | `InterviewFeedback` | A score of 1–4 for each criterion, strengths, next steps, and whether the candidate may see it |

2. **No company and nothing about hiring.** No organisation, job posting, application, referral, offer or recruiter
   exists in the model.
3. **Adults only, when built.** A feature built on these tables later must keep them to adults, and must have its own
   ADR for consent, recording and who sees feedback.
4. **Checked in the security suite:**
   - the public GraphQL schema has no interview type or field;
   - it has no company, job, application, referral, recruiter, hiring or career type.

## Consequences

- A later mock-interview feature adds behaviour, not a schema rewrite.
- **Until then, the tables cost nothing.** They are empty, and nothing reads or writes them.
- **Data rights:** they hold no personal data until a feature is built. The data export and erasure join that feature.

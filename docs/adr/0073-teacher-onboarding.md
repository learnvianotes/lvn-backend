# ADR-0073: Becoming a teacher — try now, verify later

- Status: Accepted (owner decision, 2026-10-13)
- Date: 2026-10-13
- Deciders: the owner; Backend, Web and Mobile agents
- Spec sections: §5 (roles), §7.1, §15.2; ADR-0017 (TEACHER is granted by review), ADR-0019 (verification queue),
  ADR-0044 (teacher profile), ADR-0046 (classrooms)

## Context

`TEACHER` is a global role. It unlocks:
- classes;
- the teacher profile (skills, qualifications, connections);
- teacher publications;
- vouching for students.

ADR-0017 grants it "by review, not by an email address". Until now only the platform admin's `setGlobalRole` API did
that. No screen in either app let a person ask to be a teacher, and no screen let an admin grant it. A teacher who
signed up was simply a student.

The owner asked how teachers and students get their profiles. Offered three ways (an admin verifies; a simple teacher
sign-up; or both), they chose **both: try now, verify later**:
- anyone can say they teach and start preparing at once;
- whatever brings students in waits for an admin's review.

## Decision

1. **Applying.**
   - Anyone signed in who is not already a teacher can apply: at sign-up ("I'm a teacher") or later from Account.
   - An application gives:
     - an institution and the subjects they teach;
     - an optional message;
     - 0–3 proof files (a staff ID, an appointment letter, a page that lists them), uploaded as verification
       documents.
   - It is a `VerificationRequest` with a new `purpose` of `TEACHER_ROLE` (today's requests are `ACCOUNT`). It
     reuses the queue, the document storage and the audited document views of ADR-0019.
   - A child account (a restricted minor, §15.2) cannot apply. Neither can a suspended one, nor one with an
     application pending.
2. **Before the review: a teacher applicant.**
   - While the application is pending, the account is a *teacher applicant* (`Actor.teacherApplicant`). It may:
     - create classes, even before its own account is verified (a class with no students reaches nobody);
     - write announcements and prepare quizzes in them;
     - fill in its teacher profile.
   - It may not bring anyone in. A class's teacher admits students (approves join requests, sends invites) and sees
     class performance only when they are a verified teacher (global role `TEACHER`). Announcements get their own
     action, `classroom.post`, so posting stays open to the class's staff.
   - The teacher profile is shown publicly only once approved. Teacher publications (blogs, posts) wait too.
3. **The review.**
   - Platform admins see teacher applications in the verification queue (`/admin/verification`), with the
     institution, subjects, message and proof. Viewing proof is audited, as for documents.
   - **Approve:** the account becomes `TEACHER`, and verified if it was not. The person is told, and the class they
     prepared can take students.
   - **Decline:** a reason is required. The person is told why and may apply again. They stop being an applicant:
     classes they made stay, but cannot take students and no new ones can be made.
   - Every decision is in the audit log. Proof files are deleted 30 days after the decision, as for documents
     (ADR-0019).
4. **What the apps show.**
   - `viewer.teacherStatus`: `NONE`, `PENDING`, `VERIFIED` or `DECLINED`.
   - Account shows the application's state.
   - A class's page tells an applicant why students cannot join yet.

## Consequences

- **No new queue or screen for admins.** Teacher applications sit beside account verifications, marked by purpose.
- **Teachers can start the day they sign up**, and nothing they make reaches a student before a person reviews them.
- **`classroom.post` is a new action** in the permission matrix. Join requests, invites and the member list stay
  under `classroom.reviewJoinRequests`.
- Institutions that verify their own teachers (organisations, §5) can later approve applications from their domain
  in the same queue.

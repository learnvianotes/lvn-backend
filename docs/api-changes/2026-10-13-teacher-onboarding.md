# Becoming a teacher (owner ask)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.45.0
- Spec: §5; ADR-0017, ADR-0019, ADR-0073
- Breaking: no

## What changes for clients

- **`applyToTeach(input: { institution, subjects?, message?, fileIds? })`** (signed in, not a teacher, not a child
  account): an application to teach.
  - `fileIds` are 0–3 proof files uploaded with `createUploadIntent(purpose: VERIFICATION_DOCUMENT)`.
  - It answers the `VerificationRequest`. A pending one already, or three requests this week, answers `CONFLICT` or
    `RATE_LIMITED`; a child account answers `FORBIDDEN`.
- **`myTeacherApplication`** gives the latest application.
- **`viewer.teacherStatus`** (viewer only): `NONE`, `PENDING`, `VERIFIED` (the TEACHER role) or `DECLINED`.
- **`VerificationRequest`** gains `purpose` (`ACCOUNT` or `TEACHER_ROLE`), `institution` and `subjects`.
  - Platform admins see teacher applications in `verificationRequestsToReview`, and decide them with
    `reviewVerificationRequest`. Approving grants the TEACHER role (and verifies the account); declining needs a
    reason.
  - One pending request of each purpose can wait at once.
- **A teacher applicant** (pending application) may create classes, even before the account is verified, post
  announcements and prepare quizzes, and edit a teacher profile. Inviting people and answering join requests in a
  class they teach answers `FORBIDDEN` ("Students can join once you are verified as a teacher.") until approved:
  `Classroom.viewerCan.review` is false and `viewerCan.post` true.
- **Permissions:** `classroom.post` (announcements, the class's staff) is a new action. `classroom.reviewJoinRequests`
  and `classroom.viewPerformance` need the class's teacher to hold the TEACHER role.
- The `VERIFICATION` notification's `data` gains `purpose`.

## Authorization

- Only the applicant and platform admins see an application; proof files only platform admins, with every view
  audited, deleted 30 days after the decision.

## What clients should do

- Offer "I'm a teacher" at sign-up and on Account; show the application's state.
- On a class an applicant teaches, say students can join once they are verified, and hide invites and join requests.

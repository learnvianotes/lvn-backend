# ADR-0019: Verification without a college or organisation email

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §5, §7, §8, §15.1, §15.2, §18
- Amends: ADR-0017 (the institutional email becomes optional)

## Context

ADR-0017 required a college or organisation email. Many students have none — school students, graduates,
self-learners. The owner decided: **let them use the app**, and let **a teacher or a platform admin verify them**
on the student's request, with the student sharing ID proof **with platform admins**.

## Decision

**Registration.** Date of birth stays required; the institutional email becomes **optional**. Without it the account
is unverified: it can use LVN for itself (read, private notes, personal quizzes and flashcards, import, export,
report, block) but cannot reach other people until verified (`NEEDS_VERIFIED_ACCOUNT`, ADR-0017).

**Three ways to become verified** (`VerificationMethod`):

| Method | How | Who decides |
| --- | --- | --- |
| `INSTITUTIONAL_EMAIL` | 6-digit code sent to the college or organisation email (ADR-0017) | Automatic |
| `TEACHER` | The student picks a verified teacher who knows them (typically their own teacher) and sends a request with a short message. The teacher confirms they know this person as a student. | That teacher |
| `DOCUMENTS` | The student uploads 1–3 files of proof of enrolment — student ID card, admission or bonafide letter, fee receipt — with a short note. | Platform admins only |

**Rules for requests.** One pending request at a time, withdrawable; at most three requests a week. A teacher sees only
requests addressed to them and never sees documents. Teachers' vouches are audited; platform admins can revoke a
verification obtained by fraud.

**Identity documents — handled as the most sensitive data LVN holds.**
- Stored as `FileObject` (purpose `VERIFICATION_DOCUMENT`, parent `VERIFICATION_REQUEST`) in a **restricted storage
  prefix with its own encryption key**, never behind the CDN, malware-scanned like every upload.
- Viewable **only by platform admins**, through a short-lived URL issued per view; **every view is written to the
  audit log**.
- **Deleted 30 days after the decision** (approve or reject); only the outcome is kept (method, decided by, date,
  reason).
- Guidance shown before upload: prefer a student ID or college letter; do not upload government ID numbers — if a
  document shows one (for example Aadhaar), mask all but the last four digits.
- Used for this decision only (purpose limitation, §15.2 / DPDP). The user's own request records are in their data
  export (ADR-0018) — the documents too, until deleted.
- **Restricted minors never upload documents**; a teacher vouches for them, or the parental-consent flow of §15.2
  applies.

**Where reviews happen.** Teachers: a "Verification requests" list in their account. Platform admins: the admin app;
until it exists, a verification queue on the `PLATFORM_ADMIN`-only page of §15.1. Target: a decision within three
working days.

**Permissions** (`@lvn/contracts` 0.8.0): `account.requestVerification` (unverified users; `TEACHER` needs a verified
teacher as target; `DOCUMENTS` refused for restricted minors) and `account.reviewVerification` (a verified teacher for
requests addressed to them; platform admins for all). Events `VerificationRequested`, `VerificationDecided`;
`InstitutionVerified` gains `method`. Documents never appear in events, logs or notifications.

**Data.** `VerificationRequest(id, userId, method, teacherId, status, message, decidedBy, decidedAt, reason,
createdAt)` in `users`. Files stay in `notes`' `FileObject`, reached through its facade; the read check calls the
`users` policy.

## Consequences

- Nobody is locked out for lacking an institutional email; trust still comes from a real person or real proof.
- Platform admins carry a review queue from Phase 1; the admin app should prioritise it.

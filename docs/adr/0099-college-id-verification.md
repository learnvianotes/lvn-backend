# ADR-0099: College ID verification is an admin setting, not the uploads switch

- Status: Accepted (owner request, 2026-10-23: a student can ask an admin to verify them by sending a college ID card)
- Date: 2026-10-23
- Deciders: Backend; owner
- Spec sections: §7, §8.1, §15.2; amends ADR-0019 (a college ID card is deleted at the decision) and ADR-0097 (this path does not follow `UPLOADS_ENABLED`)

## Context

ADR-0019 already lets an unverified student become verified by a teacher's vouch or by sending proof of enrolment for a
platform admin to review. The owner asked for a direct option: send a college ID card and have an admin approve or
reject it.

That card is an identity document. ADR-0097 turns **general** uploads off at launch (`UPLOADS_ENABLED`, default
false) because those files reach other people and need the scanner and the PDF engine. A college ID card is shown
only to platform admins, in the restricted bucket, and the launch still needs a way for a student without a college
email to ask for verification. The owner also asked that an application setting live in Admin, not in an environment
variable.

The account stays adults-only (ADR-0091). This ADR does not change `ACCOUNT_MINIMUM_AGE`.

## Decision

**The switch is data, and it is off until an admin turns it on.** `users.AppSetting` key
`student_id_verification`. A missing row means off. Platform admins read and change it with
`studentIdVerificationSettings` and `setStudentIdVerificationEnabled`. The audit row is
`settings.student_id_verification` (the key is in the metadata; audit targets are uuids). Everyone else may read only
`studentIdVerificationEnabled` (public, so clients hide the control). Turning it on does **not** set
`UPLOADS_ENABLED`, and `UPLOADS_ENABLED` does **not** accept a college ID card. While the switch is off,
`createStudentIdUploadIntent` and `submitStudentIdVerification` answer `UNAVAILABLE` and store nothing. A request
already waiting can still be withdrawn or reviewed.

**One card, into the restricted bucket.** JPEG, PNG, WebP or PDF, at most 5 MB (`CollegeIdCardLimits` in
`@lvn/contracts`). The student PUTs the bytes to a presigned URL from `createStudentIdUploadIntent`, then calls
`submitStudentIdVerification`. The object is written only to `S3_RESTRICTED_BUCKET`, through the existing storage
client. It is not a `createUploadIntent` upload, it does not publish `FileReady`, and the media pipeline does not
make derivative copies. `completeUpload` refuses it. Magic bytes must match the declared type. Ten upload intents
a day; the existing cap of three verification requests a week, and one pending account-verification request, still
apply.

**Admins decide. Approval is the existing verification.** The request is a `VerificationRequest` with
`method: DOCUMENTS`, `purpose: ACCOUNT` and `collegeIdCard: true`. `reviewStudentIdVerification` is platform-admin
only. Approving sets `verifiedAt` and `verificationMethod: DOCUMENTS` when the account is not verified yet — the
same write ADR-0019 uses — and publishes `VerificationDecided` and, the first time, `InstitutionVerified`. Rejecting
may omit a reason (other verification rejections still require one). Every decision records the admin on the audit
log (`verification.approved` or `verification.rejected`).

**Who can see the card.** Only a platform admin, via `studentIdCardUrl`: a signed URL that lasts 5 minutes. Each
view is audited (`verification.document.viewed`). The student who uploaded it, any other student, and a teacher are
refused. The card is never given a public or CDN URL. Teachers do not see these requests in their review list.

**The card is deleted at the decision.** Approve, reject and withdraw delete the object and clear `documentIds`,
and the audit row `verification.documents.deleted` names who did it. ADR-0019's 30-day retention stays for other
proof. The daily purge deletes a college ID card that is still stored after a decision, so a failed delete does not
wait 30 days. The outcome (status, admin, time, optional reason) is kept.

**Adults only, unchanged.** Sign-up still refuses anyone under `ACCOUNT_MINIMUM_AGE`. The restricted-minor rule is
unchanged: a restricted minor cannot upload a card and is told to ask a teacher.

## Consequences

- Clients hide the college-ID control when `studentIdVerificationEnabled` is false, including at launch, until an
  admin turns it on. Teacher vouch and a college email keep working either way.
- The card is not scanned by the media pipeline. Admins open the original. Scanning without making copies can be
  added later, when ClamAV is running, without putting the card on the public upload path.
- `@lvn/contracts` is **0.64.0**. `0.63.0` already shipped with the AI connection models change (PR #17).

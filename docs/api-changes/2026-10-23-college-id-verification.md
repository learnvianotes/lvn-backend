# College ID verification

- Date: 2026-10-23
- Package: `@lvn/contracts` 0.64.0
- Spec: ADR-0099 (amends ADR-0019, ADR-0097)
- Breaking: no (additive). `VerificationRequest` gains `collegeIdCard`.

**Version.** `0.63.0` already shipped with the AI connection models change
(`docs/api-changes/2026-10-23-ai-connection-models.md`, PR #17). This change is **0.64.0**.

## What changes for clients

A signed-in, unverified student can ask a platform admin to verify the account by sending **one college ID card**
(JPEG, PNG, WebP or PDF, at most **5 MB** / 5_242_880 bytes). Approval uses the existing mechanism: `viewer.verified`
becomes true and `viewer.verificationMethod` is `DOCUMENTS`.

This is **not** `uploadsEnabled`. General uploads stay behind `UPLOADS_ENABLED` (ADR-0097). College ID verification
has its own switch, **off by default**, stored as admin data (not an environment variable).

### Switch

| Operation | Auth | Notes |
| --- | --- | --- |
| `Query.studentIdVerificationEnabled: Boolean!` | Public | Hide the college-ID control when `false`. |
| `Query.studentIdVerificationSettings: StudentIdVerificationSettings!` | Platform admin | `{ enabled, updatedAt }`. `updatedAt` is null until the first change. |
| `Mutation.setStudentIdVerificationEnabled(enabled: Boolean!): OkPayload!` | Platform admin | Does not change `uploadsEnabled`. |

While the switch is off, `createStudentIdUploadIntent` and `submitStudentIdVerification` return
`userErrors: [{ code: UNAVAILABLE, message: "College ID verification is off for now. …" }]` and store nothing.
A request that is already waiting can still be withdrawn or reviewed.

### Student

1. `createStudentIdUploadIntent(input: { fileName, mimeType, sizeBytes })` → `StudentIdUploadPayload`.
   `upload` is `{ fileId, uploadUrl, uploadHeaders, expiresAt }`. PUT the bytes to `uploadUrl` with **exactly**
   `uploadHeaders` within 10 minutes. Do **not** call `completeUpload` (it refuses this file).
2. `submitStudentIdVerification(input: { fileId, message })` → `StudentIdVerificationPayload`.
3. `myStudentIdVerification: StudentIdVerificationRequest` — the viewer's latest request, or null.
   `myVerificationRequests` also lists it, with `collegeIdCard: true`. The student never receives `card` or a read URL.
4. `withdrawStudentIdVerification(requestId)` — pending request only. The card is deleted.

Rules, as errors on the payload:

- `UNAVAILABLE` — switch off.
- `CONFLICT` — already verified, or a verification request is already waiting (withdraw it first). One pending
  account-verification request of any kind.
- `RATE_LIMITED` — three verification requests in seven days (shared with teacher and document requests), or ten
  college-ID upload intents in a day.
- `VALIDATION` — empty name, mime other than `image/jpeg` / `image/png` / `image/webp` / `application/pdf`, empty
  file, over 5 MB, bytes that do not match the declared type, or a file the caller does not own.
- `FORBIDDEN` (GraphQL error, not `userErrors`) — a restricted minor. Ask a teacher instead. The app is still
  adults-only; this does not change sign-up.

### Admin review

| Operation | Auth | Notes |
| --- | --- | --- |
| `studentIdVerificationQueue(first, after)` | Platform admin | Pending college-ID requests, oldest first. `after` is the last id. `requester.email` is null. |
| `studentIdCardUrl(requestId)` | Platform admin | Signed GET, **5 minutes**. Every view is audited. `NOT_FOUND` once the card is deleted. |
| `reviewStudentIdVerification(input: { requestId, approve, reason })` | Platform admin | `reason` is optional. |

On approve, the account is verified with method `DOCUMENTS` (unchanged if it was already verified). On approve or
reject the stored card is deleted immediately; `card` on the returned request is null. The audit log records the
admin (`verification.approved` / `verification.rejected` and `verification.documents.deleted`).

A student, another student, or a teacher who calls `studentIdCardUrl`, `studentIdVerificationQueue` or
`reviewStudentIdVerification` receives `FORBIDDEN`. A teacher does not see these requests in
`verificationRequestsToReview`.

`VerificationRequest.collegeIdCard: Boolean!` is false on teacher vouches and on the older document flow. Those
documents are still deleted 30 days after the decision. A college ID card is deleted at the decision; the daily
purge removes one that is still stored after that.

### Storage

The object is only in `S3_RESTRICTED_BUCKET`. There is no public URL and no image derivative. The personal data
export lists the request (`collegeIdCard`, status, dates) and does not include the card bytes.

## Migration

`20261108090000_college_id_verification`: `VerificationRequest.collegeIdCard` (default false), `users.AppSetting`,
`notes.FilePurpose` value `COLLEGE_ID` (not a `createUploadIntent` purpose). No backfill. The switch starts off.

# Who may review verification, and platform admins need none

- Date: 2026-11-02
- Package: `@lvn/contracts` 0.74.0 → **0.75.0**
- Spec: ADR-0019, ADR-0005, ADR-0017
- Breaking: no for the schema. Behavior change for `MANAGER` and for `setGlobalRole`. Supersedes the review and
  `setGlobalRole` paragraphs of [2026-11-01 sign-in verification](2026-11-01-sign-in-verification.md).

## Why

Only a platform admin, or a teacher whose own account is institution-verified, may review a student's verification
request. A manager no longer reviews. A platform admin never needs institution verification: the role is enough, so
granting it does not set `verifiedAt`, and an admin with `verifiedAt` null can do every admin action the
verified-account gates used to block.

## `User.viewerNeedsVerification: Boolean`

Viewer only. Null on anyone else's `User`. Set on `viewer`, `Session.user` (sign-in and `refreshSession`), and
`verifyEmail.user`. No arguments.

| Account | `viewerNeedsVerification` | `verified` |
| --- | --- | --- |
| `PLATFORM_ADMIN`, `verifiedAt` null | `false` | `false` |
| `PLATFORM_ADMIN`, institution-verified | `false` | `true` |
| Any other role, `verifiedAt` null | `true` | `false` |
| Any other role, institution-verified | `false` | `true` |

`verified` stays the stored institution flag. Clients hide verify-your-account prompts when
`viewer.viewerNeedsVerification` is false. Do not key those prompts off `verified` alone.

Not breaking: a client that does not ask for the field keeps working. A client that still prompts from
`verified === false` will prompt a platform admin who has never been institution-verified.

## Authorization

- Review (`reviewVerificationRequest`, document metadata and `verificationDocumentUrl`, `collegeIdQueue`,
  `collegeIdUrl` / `studentIdCardUrl`, and the college-ID review mutation): `PLATFORM_ADMIN`, even when `verifiedAt`
  is null, and a `TEACHER` with `verifiedAt` set who was addressed or shares the student's institution. `MANAGER`, an
  unverified teacher, a student, and everyone else are `FORBIDDEN`. `documentsFor` returns `[]` when the caller may
  not review. Teacher applications stay with platform admins. Nobody reviews their own request (`FORBIDDEN`, "You
  cannot review your own request.").
- `can()`: `PLATFORM_ADMIN` skips every institution-verification gate, including when `unverifiedGates` lists the
  action and `institutionVerified` is false. Pass `globalRole` through; the exemption is the role. Suspension still
  blocks. `MANAGER` is not exempt. `account.reviewVerification` stays a domain check, so removing it from the admin
  list still does not let an unverified teacher review.
- `setGlobalRole` writes `globalRole` only. It does not set `verifiedAt` for `PLATFORM_ADMIN`, `MANAGER`, or
  `TEACHER`. Demotion does not clear `verifiedAt`.

## Migration

Web and mobile: hide verify prompts when `viewer.viewerNeedsVerification` is false. Pass `globalRole` into `can()`
with `unverifiedGates`. Stop offering review controls to managers.

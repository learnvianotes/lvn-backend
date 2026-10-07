# ADR-0017: Registration needs a birth date and a college or organisation email

- Status: Accepted (owner decision, 2026-10-08); amended by ADR-0019 (the institutional email is optional; teacher or admin verification)
- Date: 2026-10-08
- Spec sections: §5, §7, §7.1, §15.2, §18
- Amends: §7.1 verification bullet; ADR-0005 decision 3 (what "verified" means)

## Context

The owner decided that at registration everyone enters their **date of birth** and a **college or organisation
email** that is verified. §15.2 already asks for the date of birth; the institutional email is new.

## Decision

**Registration steps.**
1. Sign in — Google (ADR-0007) or email + password (§7.1).
2. Details: display name, **date of birth**, **college or organisation email**, acceptance of the current Terms,
   Privacy Policy and public-content licence (§15.2). Email + password users give these in `signUp`; Google users in
   `completeRegistration`.
3. **Confirm the institutional email** with a 6-digit code sent to it (`verifyInstitutionalEmail`).

**Date of birth.** Required, a real date, not in the future. It decides the age rules of §15.2 (under 13, or under the
local digital-consent age — 16 in parts of the EU, 18 under India's DPDP Act — needs verified parental or
institutional consent, otherwise the account is a *restricted minor*). Never shown to anyone; only the derived age
band is used.

**Institutional email.**
- Free mail domains (Gmail, Outlook/Hotmail, Yahoo, iCloud, Proton, …) are refused; the domain must accept mail (MX).
- A domain that belongs to a known `Organization` links the user to it (`Membership`); recognised academic suffixes
  (`.edu`, `.ac.in`, `.edu.in`, `.ac.uk`, …) are accepted and queued to create the organisation; any other domain goes
  to manual review (the admin app; until then the `PLATFORM_ADMIN` page of §15.1).
- Codes expire in 15 minutes, allow 5 attempts, and at most 3 are sent per hour. One institutional email verifies one
  account at a time.
- The address is private: only the user sees it. The institution's **name** can be shown on the profile if the user
  chooses.
- It is evidence, not a role: a faculty address does not grant `TEACHER` (still granted by an organisation or manual
  review, §5), but it is attached to the teacher review.

**What verification unlocks.** Until the institutional email is confirmed, an account can read, keep private notes,
use personal study tools, import notes, export its data, report and block. Every action that **reaches other
people** — publish or change visibility, share, comment, post, follow, connect, create or join groups, classrooms and
project workspaces, accept mentor invites, ask or answer doubts — needs a verified account. This replaces the
login-email check of §7.1 and ADR-0005 decision 3 (classroom requests are now gated too). Encoded once in
`@lvn/contracts` as `NEEDS_VERIFIED_ACCOUNT` with `Actor.institutionVerified`.

**Changing institution.** The user can replace the address; the old verification stays until the new one is
confirmed. A yearly reminder asks students to confirm the address still works (graduates keep their account and
content; an expired address only removes the "verified" badge after a grace period — detail for Phase 1).

**Data (users schema).** `User.dateOfBirth`, `InstitutionalEmail(userId, email, domain, organizationId, codeHash,
codeExpiresAt, attempts, verifiedAt)`, `Organization.emailDomains[]`. Event `InstitutionVerified`.

## To decide with the owner

People with **no** college or organisation email — school students, graduates, self-learners. Proposal: (a) a
classroom invite from a verified teacher counts as verification for that student; (b) parent or guardian
verification for minors (already needed for consent, §15.2); (c) otherwise read-only until verified.

## Consequences

- Every interacting account is tied to a real institution, which cuts spam and fake accounts and makes classroom and
  organisation membership automatic.
- Sign-up gets one more step; Phase 1 (auth) ships it with the email service.

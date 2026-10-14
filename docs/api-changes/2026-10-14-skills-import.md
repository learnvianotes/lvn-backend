# Skills import (P7c)

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.51.0
- Spec: ADR-0077, ADR-0012
- Breaking: no (`updateTeacherProfile` now replaces only the items written by hand)

## What changes for clients

- **`mySkillsImport`** returns:
  - `allowed`: a verified teacher who is not suspended.
  - `sources`: the kinds this server reads, `GITHUB` (when GitHub's API is configured) and `WEBSITE`.
  - `identities`: the viewer's `ExternalIdentity` list: `kind`, `value`, `code`, `instructions`, `verified`,
    `checkedAt`, `fetchedAt`, `lastError`.
- **`addExternalIdentity({ kind, value })`** claims a GitHub user name (or its profile address) or a page's address,
  and returns the code that proves it. Someone who is not a verified teacher gets FORBIDDEN, "Importing is for
  verified teachers."
- **`checkExternalIdentity({ identityId })`** checks the proof now, at most 10 times a day.
  - Once proven, the worker imports its public data as drafts.
  - Until then `lastError` says what is missing, including a robots.txt that keeps the page out.
- **`removeExternalIdentity({ identityId })`** deletes the identifier and every item from it.
- **`TeacherProfile.drafts`**: imported items waiting for review, for the teacher only (null for anyone else).
- **`publishTeacherSkills` / `discardTeacherSkills({ skillIds })`** act on drafts. At most 60 published items in all.
- **`TeacherSkill`** gains `sourceUrl` and `fetchedAt`, the kinds `PROJECT` and `PUBLICATION`, and the sources
  `GITHUB`, `WEBSITE`, `ORCID` and `OPENALEX`. `skills` lists published items only, an imported one only while its
  identifier is proven.
- **`updateTeacherProfile`** replaces only the manual items. Imported published items stay, and count toward the 60.

## Data

- `users.ExternalIdentity`, and `TeacherSkill.status`, `sourceUrl`, `fetchedAt` and `identityId`. Migration
  `20261030090000_skills_import`.
- The data export gains `data/users/teacher-profile.json`.

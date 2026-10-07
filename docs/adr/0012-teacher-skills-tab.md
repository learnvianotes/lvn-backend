# ADR-0012: Teacher Skills tab, filled from public sources the teacher chooses

- Status: Accepted (owner request, 2026-10-08) — scheduled for later phases; nothing is built now
- Date: 2026-10-08
- Spec sections: §1, §4.1, §7.2, §10, §15.2, §18
- Amends: §18 Phase 3 and Phase 7 scope

## Context

The owner wants a **Skills** tab on every teacher's profile with clean, structured details about the teacher, which
can be **filled from public information** when the teacher provides a public identifier.

## Decision

**What students see.** A Skills tab on the teacher's public profile (`/u/[handle]`, mobile profile) and linked from
their classrooms: headline, subjects taught (platform Topics), skills, qualifications, experience, and — where
imported — selected publications or open-source work. Every imported item shows its source and when it was fetched.

**Phase 3 — manual Skills tab.** Arrives with the Teacher role and classrooms. Only a user with the `TEACHER` global
role edits their own tab (a new `teacher.editProfile` permission, added to `@lvn/contracts` then).

**Phase 7 — import from public identifiers.** The teacher adds identifiers; a `users`-context job fetches public data
through official, open APIs; the `ai` context (`AiGateway`, Phase 5) turns it into the clean structured fields; the
result lands as a **draft the teacher reviews** — nothing is published without their approval.

| Identifier | Source | Ownership proven by |
| --- | --- | --- |
| ORCID iD | ORCID public API | Signing in with ORCID (OAuth) |
| OpenAlex author id | OpenAlex API (open scholarly data) | Linked ORCID, or manual review |
| GitHub username | GitHub REST API | GitHub sign-in (already an LVN provider) |
| Personal or faculty page URL | The page itself, respecting `robots.txt` | A verification meta tag on the page |
| LinkedIn, Google Scholar | — | **Not fetched**: their terms forbid automated access; the teacher copies details in by hand |

**Rules.**
- Teacher role only, opt-in, and only identifiers the teacher enters — LVN never searches the web for a person.
- An identifier must be **proven to belong to the teacher** before its data is imported, so nobody can dress their
  profile in someone else's credentials. Unproven items are not shown.
- Fetched data is personal data (§15.2, DPDP): consent is recorded, the teacher can remove an identifier and all data
  from it at any time, refreshes happen on request or monthly, and account deletion removes it all.
- AI cleaning sends only the fetched public text, never LVN identity (§10.1).

**Data (users schema, Phase 3/7).** `TeacherProfile(userId, headline, bio, topicIds[])`,
`TeacherSkill(id, userId, kind, name, detail, source MANUAL | ORCID | OPENALEX | GITHUB | WEBSITE, sourceUrl,
fetchedAt, status DRAFT | PUBLISHED)`, `ExternalIdentity(id, userId, kind, value, verifiedAt)`.

## Consequences

- Students can judge a teacher before requesting to join a classroom (ADR-0009).
- Adds outbound API adapters and a refresh job to `users`, plus one AI task; budgets follow §10.1 quotas.
- The UI reference's profile screen gains a Skills tab for teachers.

# ADR-0026: Student profile: department, year and interests

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §4.1, §10.1, §14.3, §15.2
- Amends: ui-reference item 7

## Decision

Each student can store their **department**, **year of study** and **interests**, so recommendations and AI help can
show more relevant content.

- **Department:** free text with suggestions (CSE, IT, ECE, EEE, ME, CE, AI & DS, BBA, B.Com, …), normalised for
  matching; later, organisation-specific lists from the admin app.
- **Year:** `YearOfStudy` — years 1–5, postgraduate, graduated, school, not studying.
- **Interests:** up to 50 platform Topics, seeded from the old site's "notify me" courses for returning users (ADR-0023).
- **Shown on the profile** ("CSE · 3rd year", as on the UI boards) only if the student turns it on; always available to
  their own recommendations.
- **Used for:** rule-based recommendations (§14.3) — "popular in CSE 3rd year", "new notes in your interests" — and as
  short context in AI tasks ("explain for a 2nd-year ECE student"). Department and year are not identity, but are sent
  to AI providers only as that phrase.
- **Minors:** declared interests are the student's explicit choice, so they may shape a restricted minor's feed;
  behavioural recommendations stay off for them (§15.2).
- `users` stores `StudentProfile(userId, department, yearOfStudy, interestTopicIds[], showOnProfile)` and emits
  `ProfileUpdated`; `core` keeps a read model for recommendations.

Phase 1 (profile fields at registration or later); used by recommendations from Phase 6.

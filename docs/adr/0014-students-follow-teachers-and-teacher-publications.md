# ADR-0014: Students follow teachers; teachers publish blogs, posts and projects

- Status: Accepted (owner decision, 2026-10-08); amended by ADR-0015 (anyone creates projects) and ADR-0016 (students follow students)
- Date: 2026-10-08
- Spec sections: §4.1, §5, §11, §14.3, §15, §18
- Amends: ADR-0013 (who may follow); §4.1 Note vs Card; §5 follow row

## Context

ADR-0013 made follow teacher-to-teacher. The owner decided that **students can follow teachers too**, to see the
teacher's public **blogs, projects, shareable posts and notes**. The spec has notes and group posts but no blogs,
projects or profile posts.

## Decision

**Who follows whom.** Any signed-in user — student or teacher — can follow a **teacher**. Nobody follows a student
(not requested; would add a student social graph with minors in it). Connect stays teacher-to-teacher (ADR-0013).
Following is one-way and needs no approval.

**What followers see.** A **Following** feed of the followed teachers' **PUBLIC** content, newest first. Following
grants no access: anything not PUBLIC stays invisible. The same content is on the teacher's public profile for
everyone, signed in or not.

**Teacher publications are notes.** Rather than three new content systems, a note has a `kind`:

| Kind | Who creates | Shown as | Typical content |
| --- | --- | --- | --- |
| `NOTE` | Anyone signed in | Notes list, note page | Study notes (unchanged) |
| `BLOG` | Teachers | Article on the profile's Blog tab and `/u/[handle]/blog/[slug]` | Long-form writing |
| `POST` | Teachers | Card in the Following feed and the profile's Posts tab | Short update, link or media; shareable by link |
| `PROJECT` | Teachers | Portfolio card on the profile's Projects tab | Title, summary, repo/demo link cards, media, topics |

Every kind is a Note, so each one gets versions, drafts, visibility (PRIVATE / SHARED / PUBLIC), sharing, fork
rules and credit lines (ADR-0010), comments and reactions, moderation and reports (§15), search (§11), the
public-note AI pipeline (§10.3) and SEO pages. Posts and projects default to forking **off**; the teacher can turn
it on.

**Teacher profile tabs.** Notes · Blog · Projects · Posts · Skills (ADR-0012), plus a follower count. Only the
teacher sees the list of who follows them (`user.viewFollowers`); others see the count. Restricted minors never
appear by name in any list.

**Permissions** (`@lvn/contracts` 0.5.0): `user.follow` accepts any signed-in user towards a teacher;
`user.viewFollowers` is self only; `note.create` checks the kind (`NOTE` for anyone, `BLOG`/`POST`/`PROJECT` for
teachers). Publishing still needs a verified email and passes moderation.

**Recommendations.** Following is an explicit choice, so the Following feed is allowed for restricted minors; it is
not a behavioural recommendation (§15.2). Rule-based recommendations (§14.3) may add "popular posts from teachers in
your subjects" for everyone else.

## Not decided here

Whether students may publish blogs, posts or projects themselves — today these kinds are teacher-only; opening them
is a one-line permission change and a moderation-load decision.

## Consequences

- One content model, one permission path, one moderation queue; the Following feed is a query over PUBLIC notes by
  followed teachers.
- `Note` gains `kind`; `Follow` allows any follower towards a teacher.

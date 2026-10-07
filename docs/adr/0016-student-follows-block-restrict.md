# ADR-0016: Students follow students; block, restrict and remove follower

- Status: Accepted (owner decision, 2026-10-08); amended by ADR-0020 (teachers can follow students)
- Date: 2026-10-08
- Spec sections: §5, §15.1, §15.2
- Amends: ADR-0014 (nobody followed students); §15.1 blocking detail

## Context

The owner wants **student-to-student following, with block and restrict options**. ADR-0014 allowed following
teachers only.

## Decision

**Following.** A student follows another student, one-way and without approval; anyone signed in still follows
teachers. Teachers do not follow students (not requested; adults following students would need its own decision).
Following shows the person's **PUBLIC** content only — for students, their public notes and projects.

**Minors.** A **restricted minor** (§15.2: under the digital-consent age without verified consent) can never be
followed and never appears by name in follower lists. They can still follow teachers and other students.

**Follower lists** are visible only to the person followed; everyone else sees counts. Anyone can **remove a
follower** silently.

**Block** (§15.1, extended):
- Ends follows and connections in both directions and stops new follows, connection requests, comments, reactions,
  mentions and invitations between the two.
- Each stops seeing the other's content in feeds, search and recommendations. (A logged-out public page can still be
  opened; that cannot be prevented.)
- In a group, classroom or workspace both belong to, membership is not changed: staff duties and announcements carry
  on, and either can leave.
- The blocked person is not told. Blocking also applies when the other side has already blocked you.

**Restrict** — a quieter limit, for when blocking would escalate:
- New comments and replies from the restricted person on your content are visible only to them **until you approve**
  each one.
- Their mentions and tags of you do not notify you, and you get no notifications from them.
- They can still follow you and see your public content, and are not told.
- Restrict is unavailable while you block them; unrestrict at any time.

**Permissions** (`@lvn/contracts` 0.6.0): `user.follow` extended to student → student (never a restricted minor),
`user.removeFollower`, `user.block`, `user.unblock`, `user.restrict`, `user.unrestrict`. Restrict is enforced by
comment visibility and notification rules in `core` and `communication`, not by `can()`.

**Events.** `UserBlocked`, `UserUnblocked`, `UserRestricted`, `UserUnrestricted` (a block also emits the matching
`UserUnfollowed` and `ConnectionChanged`).

**Data (users schema).** `Block(blockerId, blockedId, createdAt)`, `Restriction(restricterId, restrictedId,
createdAt)`; `Comment.pendingApproval` in core.

## Consequences

- Students get a social graph with the same tools other networks give them to protect themselves.
- Every feed, search and recommendation query filters blocked pairs (a `block_read_model` in notes and core).

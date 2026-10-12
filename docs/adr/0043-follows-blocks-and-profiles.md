# ADR-0043: Follows, blocks and public profiles — how ADR-0013/14/16/20 are built

- Status: Accepted (follower counts to confirm with the owner)
- Date: 2026-10-12
- Deciders: Backend agent (Phase 3, slice P3b-1); web and mobile follow
- Spec sections: §4.1, §5, §15.1, §15.2; ADR-0013, ADR-0014, ADR-0016, ADR-0020, ADR-0027

## Context

The owner decided who follows whom (ADR-0013, ADR-0014, ADR-0016, ADR-0020) and what block and restrict do (ADR-0016).
The permission matrix encodes them (`user.follow`, `user.block`, …). Four things are left open:
- what profiles show;
- how follower counts appear, given ADR-0027's rule that every public count is a milestone;
- which existing links a block cuts;
- how other contexts learn about blocks.

## Decision

1. **Data (`users`).** `Follow(followerId, followeeId)`, `Block(blockerId, blockedId)` and
   `Restriction(restricterId, restrictedId)`, each with `createdAt` and one row per pair and direction.
   Connections come in P3b-2.
2. **Follow.**
   - The rule is `can(user.follow)`: a verified account follows any teacher, and any student who is not a
     restricted minor. Never oneself, and never across a block in either direction.
   - At most 200 follows an hour.
   - Unfollowing, and removing a follower, are silent. Nobody is told.
   - A new follower notifies (`FOLLOW`), unless the person restricts them (restricting means getting no
     notifications from them, ADR-0016), or the follower is a restricted minor, who is never named to others.
   - `UserFollowed` carries an optional `quiet` flag for that case, so `communication` needs no copy of
     restrictions.
3. **Follower counts.**
   - The person sees their exact followers and following counts and the list of followers.
   - Restricted minors are counted but never listed by name (ADR-0016).
   - Everyone else sees `followerMilestone`, null below 1,000, then "1,000+" (ADR-0027 applies to "any other
     public count").
   - **To confirm with the owner:** ADR-0014 speaks of "a follower count" on profiles. If exact counts should be
     shown to others, it is one field's rule.
4. **Block.**
   - It deletes follows both ways, then emits `UserBlocked` and the matching `UserUnfollowed` events (each with
     `quiet`).
   - It stops new follows, shares and, in later slices, comments, reactions, mentions and invitations, both ways.
     The person blocked is never told: a share to someone who blocked you is refused with a neutral "This note
     can't be shared with that person."
   - Existing note shares stay. Removing them would tell the other person, and either side can unshare.
   - Group and classroom memberships stay (ADR-0016).
   - Each stops seeing the other in people search, and the other's notes in note search. The `PEOPLE` facade
     answers `blockedIds(userId)` (both directions) for contexts that filter.
5. **Restrict.**
   - Stored now. Its effects on comments arrive with comments (P3e).
   - Its effect on notifications is the `quiet` flag (decision 2). It applies to follows now, to everything else as
     it ships.
   - Restrict is unavailable while you block that person (`can`).
6. **Public profiles** (`userByHandle`, `/u/[handle]`).
   - Shown: name, handle, a Teacher badge, a verified badge, department and year when the person chose to show
     them (ADR-0026), the follower milestone, and their PUBLIC notes by kind. Notes and Projects for everyone;
     Blog and Posts for teachers.
   - The viewer's own relation to the person comes with the profile: following, followed by, blocked,
     restricted, and what they may do.
   - **Restricted minors have no profile** for anyone but themselves. They are never named in lists, so a page
     naming them would contradict that.
   - Teachers' profiles are indexed by search engines (ADR-0014). Students' are `noindex`, though anyone may open
     them, because they show only what the student made public.
   - Notes on a profile come from the notes subgraph as `User.publicNotes(kind)`, the published versions anyone
     may read. The `User` entity becomes resolvable in `notes` for that field.

## Consequences

- The social graph lives with users, where `can()` gets its facts. Other contexts ask the facade or read events.
- Blocks cost one indexed lookup per search; feeds (P3g) and comments (P3e) use the same `blockedIds`.
- A block is not a full wall: a public page can still be opened signed out (ADR-0016), and existing shares stay
  until either side removes them.

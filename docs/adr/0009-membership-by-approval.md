# ADR-0009: Group and classroom membership is by approval

- Status: Accepted (owner decision, 2026-10-08) — one detail to confirm, below
- Date: 2026-10-08
- Spec sections: §4.1, §5 (Join rows), §6.1 (core events), §9.3
- Amends: §5 "Join public group / request private" and "Join classroom" rows

## Context

§5 lets any signed-in user join a public group directly, request to join a private one, and join a classroom with a
code or invite. The owner decided that **a student joins only when the classroom's teacher or the group's admins
accept them**.

## Decision

**Groups (public and private alike).**
- A signed-in user with a verified email who is not a member and has no pending request may **request to join**
  (`group.requestJoin`). Public groups stay discoverable; joining still needs approval.
- **Group Admins and the Owner** approve or reject (`group.reviewJoinRequests`). Moderators moderate content but do
  not admit members.

**Classrooms.**
- A signed-in user who is not a member and has no pending request may **request to join** with the class code or link
  (`classroom.requestJoin`). The code identifies the class; it no longer admits anyone by itself.
- The classroom's **Teacher and TAs** approve or reject (`classroom.reviewJoinRequests`).
- An **invite sent by the Teacher or a TA** is that approval given in advance: the invited user accepts it
  (`classroom.acceptInvite`) and becomes a student without a second review.

**Requests.** Status `PENDING → APPROVED | REJECTED | WITHDRAWN` (`JoinRequestStatus`). One pending request per user per
group/classroom; the requester can withdraw it; a rejected user may ask again later (rate-limited). Approval creates
the membership in the same transaction and emits `GroupMembershipChanged` / `ClassroomMembershipChanged` (`JOINED`).

**Events and notifications.** `core` emits `GroupJoinRequested` / `ClassroomJoinRequested` (reviewers are notified
in-app and by push, §9.3) and `JoinRequestReviewed` (the requester is told the decision). All three are in
`@lvn/contracts/events`.

**Data (core schema).** `GroupJoinRequest`, `ClassroomJoinRequest` and `ClassroomInvite` — see `erd.md`.

**API (Phase 3, for the schema at that time):** `requestToJoinGroup`, `requestToJoinClassroom(code)`,
`withdrawJoinRequest`, `reviewJoinRequest(input: { requestId, decision })`, `inviteToClassroom`,
`acceptClassroomInvite`, and a paginated `joinRequests` list on Group and Classroom visible to reviewers only.

## To confirm with the owner

"Teacher or classroom admins": encoded as **Teacher and TA**. If TAs should not admit students, the classroom review
check becomes Teacher-only — a one-line change in `permissions.ts` plus its test.

## Consequences

- No one reaches a group's or class's shared notes, posts or members without a human saying yes — this also shrinks
  the spam and abuse surface for public groups.
- Reviewers get a queue to work through; unanswered requests should expire (proposed: 30 days) so they do not pile up.
- Group and classroom permission checks take two new facts from the read model: `pendingJoinRequest` and, for
  classrooms, `invitedByStaff`.

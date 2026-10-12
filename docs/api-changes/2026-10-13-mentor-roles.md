# A mentor's role does not change (P3k)

- Date: 2026-10-13
- Package: `@lvn/contracts` unchanged (no schema change)
- Spec: §18; ADR-0045, ADR-0048 (amended)
- Breaking: no. One behaviour changes.

## What changes for clients

- `setGroupRole` on a member whose role is `MENTOR` now returns a VALIDATION user error: "A mentor stays a mentor.
  Remove them to end it." This covers handing the group over (`role: OWNER`) too. Before, an admin could turn a
  mentor into an admin, moderator or member.
- Mentors still leave by themselves, and admins still remove them with `removeGroupMember`.

## What clients should do

- Do not offer role changes or the hand-over for mentors. lvn-web and lvn-mobile offer them for the rest of the team
  only: roles below one's own, and the hand-over for the owner.

# ADR-0011: Group join policy; classroom approvals confirmed

- Status: Accepted (owner decisions, 2026-10-08) — one point to clarify, below
- Date: 2026-10-08
- Spec sections: §5 (group and classroom join rows)
- Amends: ADR-0009 for groups (public groups may allow direct joining); §5 group join row

## Context

ADR-0009 made every group and classroom join a request. The owner refined it:

- a **public** group whose settings **allow joining** can be joined directly, and the group's admins choose between
  that and requiring approval;
- in classrooms, **TAs may approve** join requests;
- a **staff invite counts as approval**, and the student still has to accept it.

## Decision

**Groups.** A new group setting, `joinPolicy`: `OPEN | APPROVAL` (`GroupJoinPolicy`).

| Group | `OPEN` | `APPROVAL` |
| --- | --- | --- |
| PUBLIC | Any signed-in user with a verified email joins directly (`group.join`) | Request; Admin/Owner accepts (`group.requestJoin`, ADR-0009) |
| PRIVATE | Not allowed — a private group always uses approval, whatever is stored | Request; Admin/Owner accepts |

- New groups start with `APPROVAL`; the creator can switch a PUBLIC group to `OPEN` when creating it or later.
- Changing the policy is a group setting: **Admins and the Owner** (`group.manage`). Each change is written to the
  audit log (§4.5). Switching to `APPROVAL` does not remove existing members; switching to `OPEN` leaves pending
  requests to be reviewed or withdrawn.
- A direct join emits `GroupMembershipChanged` (`JOINED`) like an approved request.

**Classrooms** (no change to ADR-0009, now confirmed):
- Joining is always a request with the class code or link; the classroom's **Teacher or a TA** accepts it.
- A **staff invite** is the approval given in advance; the student becomes a member only when they **accept** it
  (`classroom.acceptInvite`). Invites expire (proposed: 14 days).

## To clarify with the owner

"A normal teacher needs a connection." Encoded today: only the Teachers and TAs **of that classroom** can approve or
invite; a user with the global Teacher role who is not part of the classroom cannot. If "connection" means something
more — for example that an independent teacher (not verified through an organisation) may only invite or admit
students who are already connected to them — that needs a connection model (`users` or `core`) and a follow-up ADR.

## Consequences

- Open communities stay low-friction; private ones and every classroom keep a human gate.
- Group permission checks take two more facts: `privacy` and `joinPolicy` (`Group` gains `joinPolicy`; ERD).

# ADR-0045: Groups — membership, posts and notes shared to a group

- Status: Accepted
- Date: 2026-10-12
- Deciders: Backend agent (Phase 3, slice P3c); web and mobile follow
- Spec sections: §4.1, §4.2, §5, §6.1, §15.1; ADR-0009, ADR-0011, ADR-0016, ADR-0024

## Context

§5 and ADR-0009/0011 settle who joins and who manages:
- A PUBLIC group with the OPEN policy is joined directly; every other join is a request that Admins or the Owner
  accept.
- Members post. Moderators remove posts and mute members. Admins and the Owner manage. Only the Owner deletes.
- Notes shared to a group are read by its members (§4.2).

Left open: what a non-member sees of a public group; how `notes` knows who is in a group for its read predicate;
what a post is; and where the group limits come from.

## Decision

1. **Data (`core`).**
   - `Group(id, name, description, type COMMUNITY | PROJECT, privacy PUBLIC | PRIVATE, joinPolicy OPEN | APPROVAL,
     ownerId, deletedAt)`.
   - `GroupMember(groupId, userId, role OWNER | ADMIN | MODERATOR | MEMBER | MENTOR, joinedAt, mutedUntil)`.
   - `GroupJoinRequest(id, groupId, userId, status PENDING | APPROVED | REJECTED | WITHDRAWN, message, reviewedBy,
     reviewedAt)`.
   - `GroupPost(id, groupId, authorId, body, pinnedAt, editedAt, deletedAt)`. The body is rich text checked as a
     card's document (`docSchema`, at most 20,000 characters of text).
   - PROJECT groups, mentors and ideas come in P3f.
2. **What non-members see.**
   - A PUBLIC group is listed in discovery. Any signed-in person sees its name, description, member count and join
     button.
   - A PRIVATE group is never listed. Someone with its link (its id) sees only its name and description, and may
     ask to join. Ids are random enough not to be guessed.
   - Posts, shared notes and the member list are for members only, in every group. "Public" means discoverable
     and, when OPEN, joinable without approval. It does not mean readable by strangers, because groups include
     minors (ADR-0015).
3. **Membership.**
   - Creating a group makes the creator its OWNER. New groups start with the APPROVAL policy (ADR-0011), and a
     PRIVATE group is always APPROVAL whatever is stored.
   - A join request is one pending per person and group, with an optional message of up to 500 characters. A
     rejected person may ask again after 7 days.
   - Admins approve or reject. Approval and direct joins emit `GroupMembershipChanged (JOINED)`. Members leave;
     admins remove (`REMOVED`).
   - The Owner cannot leave without first handing ownership to another member. Roles are changed by admins, below
     their own rank; ownership moves only by the Owner.
   - Moderators mute a member for a time; a muted member cannot post. Every role, policy and membership change is
     written to the audit log (§4.5).
   - Blocks do not change memberships (ADR-0016), but each person's posts are hidden from the other.
4. **Notes shared to a group.**
   - `notes` keeps a read model of groups and members, `GroupRead(id, deletedAt)` and `GroupMemberRead(groupId,
     userId)`, from `GroupCreated`, `GroupDeleted` and `GroupMembershipChanged` events. It also keeps `GroupShare(noteId,
     groupId)`.
   - The read predicate gains one branch: a SHARED or PUBLIC note with a published version, shared to a group the
     viewer is in (the matrix's `sharedToActorsGroup`).
   - Unlike connections (ADR-0044), membership changes often and many notes may be shared to one group, so the
     predicate joins the read model instead of copying rows.
   - Only members share to a group, and only their own notes. Sharing makes a PRIVATE note SHARED (§4.2).
5. **Limits** from the plan (ADR-0024): `GROUPS_OWNED` and `GROUP_MEMBERS`. No row means no limit until the owner
   sets numbers.
6. **Notifications.**
   - `JOIN_REQUEST` goes to the Owner and Admins.
   - `JOIN_DECISION` goes to the person who asked (approved, or rejected without a reason).
   - Posts do not notify yet. The activity feed (P3g) and push preferences (P3h) decide that.
7. **Events** (contracts): `GroupCreated`, `GroupDeleted`, and the existing `GroupMembershipChanged`,
   `GroupJoinRequested` and `JoinRequestReviewed`.

## Consequences

- One read predicate still decides every note read. Group shares cost a join on the member read model, indexed by
  `(userId, groupId)`.
- `core` and `notes` stay separate: notes never reads core's tables, it reads its own copy fed by events.
- Group content is closed to strangers by design. If the owner later wants public groups readable by anyone, posts
  and shares change rule in one place.

# ADR-0013: Teachers follow and connect with other teachers to share notes

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §4.1, §5, §6.1, §15.1, §18
- Answers: the open point in ADR-0011 ("a normal teacher needs a connection")

## Context

Teachers of the same classroom already work together (Teacher/TA roles). The owner wants teachers who do **not** share a
classroom to be able to **follow** each other and **connect** in order to share notes.

## Decision

**Follow — one-way, no approval.**
- A user with the `TEACHER` global role can follow another teacher, and unfollow at any time.
- Effect: the followed teacher's **PUBLIC** notes and publishing activity appear in the follower's **Following** feed.
  Following grants no access to anything that is not already public.

**Connect — mutual, by request.**
- A verified teacher sends a connection request to another teacher; the recipient accepts or declines. Either side
  can remove the connection later. One pending request per pair, in either direction.
- Effect: connected teachers can share notes with each other directly, and a teacher can share a note with **all
  their connections** at once (read access — Viewer level; Editor access is still granted person by person).
  "All my connections" is live: a new connection gains access, a removed one loses it.

**Sharing rule.** A teacher shares a note directly with another teacher only if they are **connected** or are
**Teachers/TAs of the same classroom**. Sharing with students, groups and classrooms is unchanged. A connection's fork
of a SHARED note cannot be made PUBLIC (ADR-0010 — they are readers, not editors).

**Safety.** Blocking (§15.1) ends follows and connections both ways and stops new requests. Requests are rate-limited.
Restricted minors are never teachers, so the network is adults-only by construction.

**Where it lives.** `users` owns `Follow`, `Connection` and `ConnectionRequest` and emits `UserFollowed`,
`UserUnfollowed`, `ConnectionRequested` and `ConnectionChanged`. `notes` keeps a connections read model so
`visibleNotesWhere` covers "shared with my connections" without joining into `users`. `core` builds the Following feed;
`communication` notifies about requests and acceptances.

**Permissions** (`@lvn/contracts` 0.4.0): `user.follow`, `user.unfollow`, `user.requestConnection`,
`user.respondToConnection`, `user.removeConnection`; `note.share` checks the target; a `CONNECTION_SHARE` reader
relation for notes shared with connections.

**API (Phase 3):** `followUser`, `unfollowUser`, `requestConnection`, `respondToConnectionRequest(input: { requestId,
accept })`, `removeConnection`, `connections` and `connectionRequests` lists on the viewer, and
`shareNote(input: { toConnections: true })`.

## Not decided here

Whether **students** can follow teachers or each other (the UI boards show follower counts on student profiles) —
`docs/design/ui-reference.md`, item 2. Today follow and connect are teacher-to-teacher only.

## Consequences

- Teachers outside a classroom get a professional network and a sharing path without opening notes to everyone.
- Adds three tables to `users`, one read model to `notes`, four events, and a Following feed source.

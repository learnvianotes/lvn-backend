# ADR-0044: Teacher connections, sharing with connections, publications and the Skills tab — how they are built

- Status: Accepted
- Date: 2026-10-12
- Deciders: Backend agent (Phase 3, slice P3b-2); web and mobile follow
- Spec sections: §4.1, §4.2, §5; ADR-0012, ADR-0013, ADR-0014, ADR-0015

## Context

The owner decided the rules:
- Teachers connect by request (ADR-0013). They share directly with each other only when connected or co-teaching,
  and can share a note with all their connections, live.
- Teachers publish blogs and posts (ADR-0014), and anyone publishes projects (ADR-0015). All of these are notes of
  another `kind`.
- Teachers have a Skills tab filled by hand in Phase 3 (ADR-0012).

This ADR settles four things the rules leave open:
- where connections live, and how `notes` learns about them;
- how "all my connections" stays live without changing the read predicate everywhere;
- what the Skills data is;
- which kinds open now.

## Decision

1. **Connections (`users`).**
   - Data: `Connection(userLowId, userHighId)` is one row per pair, ordered. `ConnectionRequest(id, fromUserId,
     toUserId, status PENDING | ACCEPTED | DECLINED | WITHDRAWN)`, with one pending request per pair in either
     direction.
   - `can(user.requestConnection)` applies: teacher to teacher, verified, not blocked, not already connected or
     pending. At most 30 requests a day.
   - Mutations: `requestConnection`, `respondToConnectionRequest(accept)`, `withdrawConnectionRequest` and
     `removeConnection`.
   - Lists: `myConnections` and `myConnectionRequests` (incoming and outgoing).
   - `User.relation` gains `connected`, `pendingConnection` (with its request id) and the matching `viewerCan`
     entries.
   - A block removes the connection and any pending request between the two.
   - Events: `ConnectionRequested`, and `ConnectionChanged` (CONNECTED / DISCONNECTED).
   - Notifications: `CONNECTION` to the person asked, and to the asker once accepted. A decline is silent.
2. **Sharing with all connections is materialised as share rows.**
   - `NoteShare` gains `source` (`DIRECT | CONNECTIONS`) and `Note` gains `sharedWithConnections`.
   - Turning it on adds a VIEWER row, source CONNECTIONS, for each current connection (`PEOPLE.connectionIds`).
   - On `ConnectionChanged`, the notes of either person that are shared with connections gain or lose the other
     person's CONNECTIONS rows. A DIRECT row is never touched, and it wins when both exist.
   - So "all my connections" stays live (ADR-0013), and the read predicate, search, sync and every list keep working
     on `NoteShare` unchanged. Editor access is still given person by person.
   - Teacher-to-teacher direct sharing asks `PEOPLE.connected(a, b)` for `connectedToRecipient`. Co-teaching arrives
     with classrooms (P3d).
3. **Publications.**
   - `createNote` accepts `kind`: `NOTE` and `PROJECT` for anyone, `BLOG` and `POST` for teachers (`can`,
     `newNote`).
   - Posts and projects start with forking off (ADR-0014). The creator can turn it on.
   - Every kind keeps every note rule: drafts, versions, visibility, moderation and public pages at `/n/…`.
   - The blog-specific address `/u/[handle]/blog/[slug]` named in ADR-0014 waits. Profiles link to `/n/…`, which
     is already the canonical public page.
4. **Skills tab (manual, `users`).**
   - Data: `TeacherProfile(userId, headline, bio)` and `TeacherSkill(id, userId, kind SKILL | QUALIFICATION |
     EXPERIENCE, name, detail, position, source MANUAL)`.
   - Subjects taught are entries for now. Linking them to platform Topics (ADR-0012) waits until topics resolve
     across contexts.
   - Phase 7 adds imported sources and drafts (ADR-0012). Manual entries are published as the teacher saves them.
   - `updateTeacherProfile` replaces the whole tab in one save, at most 60 items. Only a teacher edits their own
     (`teacher.editProfile`, new in contracts).
   - `User.teacherProfile` is public for teachers and null for everyone else.

## Consequences

- Connection sharing costs a row per note per connection, which is bounded and indexed. In exchange, no second read
  path exists to keep in step with the first.
- Withdrawing sharing with connections deletes only CONNECTIONS rows, so people shared with directly keep access.
- The Skills tab has the shape Phase 7 imports will fill. Imported items will carry their source and a draft status.

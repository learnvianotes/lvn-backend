# ADR-0051: Scoped moderation — reports and queues for groups, classes and the platform

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend agent (Phase 3, slice P3i); web and mobile follow
- Spec sections: §5, §15.1, §15.2; ADR-0015, ADR-0037, ADR-0045, ADR-0046, ADR-0047, ADR-0048

## Context

ADR-0037 built the platform queue for notes and accounts:
- reports, actions and appeals live in `core`;
- PLATFORM_ADMIN decides (APPROVE, HIDE, REMOVE, WARN, DISMISS);
- an author appeals once.

§15.1 and the matrix give scoped moderators:
- group moderators and above (and a workspace's mentor) moderate posts (`group.moderatePosts`);
- class staff handle reports in their class (`classroom.moderateReports`);
- platform admins handle everything else.

ADR-0047 left two things for this slice: holding flagged comments for review instead of refusing them, and reports on
comments.

## Decision

1. **What can be reported.**
   - Existing: NOTE and USER (a profile).
   - New: COMMENT, GROUP_POST (posts and ideas), CLASSROOM_POST, DOUBT and GROUP.
   - A reporter must be able to see what they report, or it is "not found". Nobody reports their own content.
2. **Scope, fixed when the report is made.**
   - **Group scope:** GROUP_POST, DOUBT, and a COMMENT on a group post.
   - **Class scope:** CLASSROOM_POST and a COMMENT on a class announcement.
   - **Platform scope:** NOTE, USER, GROUP, and a COMMENT on a note.
   - The report stores its scope. The queue of each scope shows that scope's open cases: group moderators (and the
     mentor), class staff, and platform admins (who also see every scope, to step in).
3. **Moderation state on the new kinds.**
   - Comments, group posts, class announcements and doubts gain `moderation` (OK | PENDING_REVIEW | HIDDEN | REMOVED)
     and `moderationReason`.
   - Content that is not OK is seen only by its author, who sees the state and the reason, and by the moderators of
     its scope in their queue. It leaves lists, feeds, counts and search.
4. **Actions.**
   - APPROVE (back to OK), HIDE, REMOVE, WARN (a reason for the author, the content stays) and DISMISS (closes the
     reports, releases held content). HIDE, REMOVE and WARN need a reason.
   - A warning's reason is kept on the content, which stays OK. Like every moderation reason, only the author is
     shown it.
   - A GROUP can be warned (its owner) or removed (deleted), by platform admins only. A group has no state to keep a
     warning, so its owner reads the latest one from the last 30 days from the moderation record.
   - Every action is a `ModerationAction` with the actor and the scope, and an audit entry.
5. **Holding.** A comment the scorer flags is now kept as PENDING_REVIEW, seen by its author with the reason, and a
   system report puts it in its scope's queue. This replaces the refusal of ADR-0047. Doubts and posts are still
   refused when flagged, as before.
6. **Telling the author.** A new notification category, MODERATION:
   - `data.kind` is HIDDEN, REMOVED, WARNED or RESTORED, and `data.entityType` names what it was about;
   - the path opens where the content was;
   - the reason is shown with the content, never put in the notification.
7. **Appeals.** The author appeals a HIDE or REMOVE once. The appeal reopens the case in the same scope's queue.
8. **Mute.** Group moderators keep muting from the members list (ADR-0045). The queue offers it next to a reported
   member's case.

## Consequences

- People closest to a group or class handle what happens there. Platform admins can still step in everywhere.
- Every reportable kind follows one pattern: a state on the row, filtered at read time, and a case in a scoped queue.
- Notes keep their own state in `notes` (ADR-0037). The other kinds keep it in `core`, where they live.

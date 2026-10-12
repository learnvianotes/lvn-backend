# Scoped moderation (Phase 3, P3i)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.26.0
- Spec: §5, §15.1, §15.2; ADR-0037, ADR-0047, ADR-0051
- Breaking: no. One behaviour changes: a flagged comment is now held for review instead of being refused.

## What changes for clients

**Reporting:**
- `ReportEntityType` gains `COMMENT`, `GROUP_POST` (posts and ideas), `CLASSROOM_POST`, `DOUBT` and `GROUP`.
- `reportContent` takes them all.
- A report on something the reporter cannot see is a NOT_FOUND user error.
- A report on one's own content is a VALIDATION user error ("This is your own.").

**Queues:**
- `moderationQueue(first, after, scope: { scope: PLATFORM | GROUP | CLASSROOM, id })`. Who can read each queue:
  - a group's queue: its owner, admins, moderators and mentor;
  - a class's queue: its teacher and TAs;
  - `PLATFORM`, and the queue without a scope (every case): platform admins only.
  
  Anyone else gets FORBIDDEN.
- `ModerationCase` gains:
  - `scope` and `scopeId`;
  - `content: ModeratedContent` for comments, posts, announcements and doubts: `entityType`, `author`, `excerpt`,
    `moderation`, `moderationReason`, `deleted`, `path`;
  - `group` for GROUP cases.

**Decisions** (`moderateContent`):
- Platform admins decide anywhere. Group moderators and class staff decide in their own scope.
- Nobody decides on their own content in a group or class ("Another moderator decides about your own content.").
- GROUP cases take WARN, REMOVE (the group is deleted) and DISMISS. The owner reads a warning on
  `Group.moderationWarning` (owner only, the latest from the last 30 days).

**Moderation state on content:**
- `Comment`, `GroupPost`, `ClassroomPost` and `Doubt` gain `moderation` and `moderationReason`.
- Content that is not OK is returned only to its author, so other people never see it.
- `moderationReason` is null for everyone but the author. A warned author sees the warning there while the content
  stays OK.
- `moderationCanAppeal` is true for the author of hidden or removed content who has not appealed yet.

**Holding comments:**
- `addComment` and `editComment` with flagged words now succeed. The comment is `PENDING_REVIEW`, and its author is
  told why in `moderationReason`.
- A system report (no reporter) puts the comment in its scope's queue.
- A comment that moderators hid or removed can't be edited; its author appeals instead.

**Appeals:**
- `appealModeration` takes the new kinds too, once per author.
- The appeal reopens the case in the same scope's queue.

**Notifications:**
- New category `MODERATION`, with `data { kind: HIDDEN | REMOVED | WARNED | RESTORED, entityType }`.
- `path` opens where the content is.
- The reason is never in the notification or the push.

## Behind it

**Migration `20261013180000_scoped_moderation`:**
- enums `ModerationScope` and `ContentModeration`;
- `scope`/`scopeId` on `Report`, `ModerationAction` and `ModerationAppeal`, with an index on open reports by scope;
- `moderation`/`moderationReason` on `Comment`, `GroupPost`, `ClassroomPost` and `Doubt`.

**Code:**
- Three reports from different people hold a comment, post, announcement or doubt (`PENDING_REVIEW`), as for notes.
- Lists, feeds, counts and single reads leave out content that is not OK, except for its author.
- `ScopedReportsService` checks that the reporter can see what they report.
- `ModerationService` places each case in its scope and decides.
- A decision publishes the `ContentModerated` event, and communication turns it into the author's MODERATION
  notification.

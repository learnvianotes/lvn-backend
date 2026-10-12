# Comments and reactions (Phase 3, P3e)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.23.0, with:
  - `note.comment` is refused to restricted minors on PUBLIC notes;
  - enums `CommentTargetType`, `ReactionTargetType` and `ReactionKind`;
  - `CommentAdded.recipients` and `CommentAdded.place` (both optional).
- Spec: §4.5, §5, §9.3, §15.1, §15.2; ADR-0016, ADR-0027, ADR-0047
- Breaking: no

## What changes for clients

**Reading a thread.**
- `discussion(target: { type: NOTE | GROUP_POST | CLASSROOM_POST, id })` returns:
  - `comments(first, after, cardId)`: top-level comments, oldest first, each with up to 100 `replies`;
  - `commentCount`, `reactions`, `viewerCanComment`, and `whyNot` (the refusal, in words).
- It is null when the viewer cannot read the target. Query it on its own: nested under a note or a post, a thread
  goes past the depth limit of 8.
- `Note.discussion`, `GroupPost.discussion` and `ClassroomPost.discussion` carry the same object for shallow reads,
  such as `commentCount` in a list. On a note it is null for anonymous visitors.

**`Comment`:**
- `author` and `body` (null once removed), `cardId`, `removed`, `pendingApproval`, `private`, `createdAt`, `editedAt`,
  `replies`, `reactions`, and `viewerCan { reply edit delete approve }`.
- `private` means a class thread, which only that student and the staff see.
- `pendingApproval` means the comment is by someone the owner restricts. Only its author and the owner see it.

**`Reactions`:**
- `counts { kind, count, atLeast }` and `viewerReaction`.
- On a PUBLIC note, anyone but the owner (of the note, or of the comment) gets a milestone: `count` is 1000 with
  `atLeast: true`, or `count` is null below that.

**Mutations:**
- `addComment(target, cardId, parentId, body)`. `body` is a card's rich-text document of at most 5,000 characters.
  Replies go one level deep.
- `editComment` (the author).
- `deleteComment`: by the author, the note's owner, group moderators or class staff. A comment with replies stays as
  "removed".
- `approveComment`: by the owner, for a restricted person's comment.
- `react(target: { type: NOTE | COMMENT | GROUP_POST | CLASSROOM_POST, id }, kind)`. A `kind` of null takes the
  reaction back.

**Refusals:**
- These come as FORBIDDEN errors, in plain words: "Verify your account to comment.", "You can't comment here." (the
  same words whoever blocked), "You are muted in this group for now.", "Comments on public notes are not open to your
  account yet." (restricted minors), and the same for reacting.
- A comment the scorer flags is refused as VALIDATION: "This comment can't be posted: it contains words linked to
  spam."

**Notifications:**
- `COMMENT`, with `data.kind` COMMENT (to the content's owner) or REPLY (to the parent comment's author).
- Each carries the note, or a path to the group or class.
- Never sent for a comment waiting for approval.

## Behind it

- `core.Comment` and `core.Reaction` (one per person per target).
- `core` reads notes only through the new `NOTE_ACCESS` facade, which `notes` answers with the read rule and
  `note.comment`.
- `PEOPLE.restricts` tells whether one person restricts another.
- Class threads: `Comment.visibleTo` holds the student a thread belongs to.
- Data export: comments, reactions, group and class memberships, and group posts and class announcements are now
  in `data/core/`.

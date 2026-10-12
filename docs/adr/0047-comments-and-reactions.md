# ADR-0047: Comments and reactions — on notes, group posts and class announcements

- Status: Accepted
- Date: 2026-10-12
- Deciders: Backend agent (Phase 3, slice P3e); web and mobile follow
- Spec sections: §3, §4.5, §5, §9.3, §15.1, §15.2; ADR-0016, ADR-0017, ADR-0027, ADR-0037, ADR-0045, ADR-0046

## Context

The spec sets the rules:
- Comments are polymorphic, owned by `core`, and announced with `CommentAdded`.
- Commenting and reacting on a note follow its read rule (`note.comment`) and need a verified account.
- A block stops comments and reactions between two people.
- A restricted person's comments wait for the content owner's approval (ADR-0016).
- `COMMENT` is a notification category.

Left open:
- what can be commented on in Phase 3;
- how `core` knows who may read a note;
- who sees a class's comments, given minors (ADR-0046);
- what reactions are and whether their counts are public (ADR-0027);
- what happens to comments the moderation scorer flags.

## Decision

1. **Data (`core`).**
   - `Comment(id, targetType, targetId, cardId, parentId, authorId, ownerId, body, state, editedAt, deletedAt)`.
     - `targetType` is NOTE, GROUP_POST or CLASSROOM_POST.
     - `cardId` anchors a note comment to one card.
     - `ownerId` is whose content it is: the note's owner or the post's author.
     - `state` is VISIBLE or PENDING_APPROVAL.
     - The body is rich text checked as a card's document (`docSchema`, at most 5,000 characters of text).
   - `Reaction(targetType, targetId, userId, kind)`.
     - `targetType` is NOTE, COMMENT, GROUP_POST or CLASSROOM_POST.
     - `kind` is LIKE, HELPFUL or CELEBRATE.
     - One reaction per person per target; reacting again changes or removes it.
2. **Replies.** One level: a reply's parent is a comment without a parent, on the same target.
3. **Who comments where.**
   - **Notes.** Anyone who can read the note, signed in and verified. Comments are read by whoever can read the note.
     - `core` asks `notes` through a new `NOTE_ACCESS` facade, which returns the viewer's access, the owner and the
       visibility, and checks a card id.
     - A restricted minor does not comment or react on a PUBLIC note: that would be publishing in public (§15.2). The
       matrix encodes it (`note.comment`, contracts 0.23.0).
   - **Group posts.** Members, unless muted. Members read the comments (ADR-0045).
   - **Class announcements.** Members comment, but each student's comment and the replies to it are seen by that
     student and the class's staff only. They are questions to the teacher, never messages between students
     (ADR-0046 §4, §15.2). Comments by staff are seen by every member.
4. **Editing and removal.**
   - The author edits a comment, and it is marked as edited.
   - The author deletes it. So can the note's owner, the group's moderators and above, and the class's staff.
   - A deleted comment that has replies stays as "removed", with no author and no body. Without replies it is gone.
5. **Blocks and restrict** (ADR-0016).
   - Nobody comments or reacts on content of someone they block or who blocks them, nor replies to such a person's
     comment. The refusal is the same either way.
   - Each person's comments are hidden from the other.
   - Comments by someone the content's owner restricts are PENDING_APPROVAL. They are seen by their author, as if
     posted, and by the owner, who approves or deletes them. They cause no notification.
6. **Moderation.** The rule-based scorer (ADR-0037) screens every comment. A flagged comment is refused, and the
   author is told why in the scorer's words. Holding comments for review, and reports on comments, come with scoped
   moderation (P3i).
7. **Reaction counts.**
   - Exact counts are shown to the content's owner, and to everyone in groups and classes, which are closed to their
     members.
   - On a PUBLIC note, everyone else sees milestones (ADR-0027): nothing below 1,000.
   - Every viewer sees their own reaction. **To confirm with the owner**, with the follower-count question.
8. **Notifications.**
   - `COMMENT` goes to the content's owner, and for a reply also to the parent comment's author. `data.kind` is
     COMMENT or REPLY, and the notification carries the note, group or class.
   - Never for one's own comment, a restricted person's comment, or between people with a block.
   - `CommentAdded` gains `recipientIds`, computed by `core` (additive in v1).
   - Reactions do not notify. Digests come with P3h.
9. **Rate limits.** 30 comments and 200 reactions per person per hour.
10. **API.**
    - Clients read a thread with the `discussion(target)` query. Nested under a note or a post, a thread with
      replies and reaction counts goes past the query depth limit of 8.
    - `Note`, `GroupPost` and `ClassroomPost` also carry `discussion` for shallow reads, such as the comment count
      in a list. On a note it is null for anonymous visitors.
11. **Data export** (ADR-0018). The person's comments and reactions go into their export, together with the groups
    and classes they are in and what they posted there. P3c and P3d had left those out.

## Consequences

- One rule decides who reads a note and who comments on it. `core` never reads notes' tables.
- Class threads stay between a student and the staff, so no student's name or words reach classmates.
- Public notes get no vanity numbers. Owners still see exact counts.
- Held comments and comment reports wait for P3i. Until then a flagged comment never appears at all.

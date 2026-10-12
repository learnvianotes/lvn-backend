# ADR-0054: Mentions — @handle in comments, posts and ideas

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P3p); owner ("continue with other issues")
- Spec sections: §4.5, §12.1, §15.2; ADR-0016, ADR-0043, ADR-0047, ADR-0050

## Context

ADR-0047 left mentions for later: comments, group posts and ideas could name people only as plain text, and nobody
was told. Naming someone must not become a way to reach people who cannot see the place, or people who blocked or
restricted the writer.

## Decision

1. **What is a mention.** `@handle` at the start of the text or after anything but a letter, digit, `@` or `.`.
   Handles are lowercase letters and digits, so an email address is never a mention. The text is the comment's or
   post's own words; nothing is stored beyond it: clients show `@handle` as a link to the profile.
2. **Where.** Comments (on notes, group posts and class announcements), group posts and ideas. Class announcements
   already tell every member (CLASSROOM_POST); doubts and answers tell the team (DOUBT).
3. **Who is told.** Each person named, once, at most ten per comment or post, with a MENTION notification (actor, the
   place's path, `data { entityType }`; never the words). Skipped: the author; anyone already told about the comment
   (the note's owner, the replied-to author); anyone who cannot read the comment or post (`notes`' read rule through
   NOTE_ACCESS for notes, class threads' visibility, group membership for posts); anyone who blocks or is blocked by
   the author; anyone who restricts the author. A comment waiting for approval or held for review names nobody until
   it is visible; an edit tells only people named for the first time.
4. **Category.** MENTION is a notification category people switch off (push on by default, no email), counted in the
   weekly digest. The event `PeopleMentioned` carries ids and the place.

## Consequences

- Mentions reuse the read rules, so a mention never reveals that a private note or group exists to someone outside it.
- Without a picker the writer types the handle; clients may add one later on top of people search (ADR-0043), which
  already leaves out blocked people and minors.
- A comment approved later does not tell the people it names (the approval is the owner's act, not a new comment).

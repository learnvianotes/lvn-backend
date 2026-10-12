# ADR-0046: Classrooms — codes, requests, staff invites, announcements and class notes

- Status: Accepted
- Date: 2026-10-12
- Deciders: Backend agent (Phase 3, slice P3d); web and mobile follow
- Spec sections: §4.1, §4.2, §5, §15.2; ADR-0009, ADR-0011, ADR-0013, ADR-0024

## Context

The rules are set:
- Teachers create classrooms.
- Joining is always a request with the class code or link, which the Teacher or a TA accepts (ADR-0009, ADR-0011).
- A staff invite is that acceptance given in advance; the invited person accepts it, and invites expire (14 days
  proposed).
- Teachers who teach the same class may share notes with each other directly (ADR-0013).
- Notes shared to a class are read by its members (§4.2).

Left open: what a code looks like; who may share notes to a class and who may post in it; how notes knows who is in
a class; and what restricted minors may do there.

## Decision

1. **Data (`core`).**
   - `Classroom(id, name, description, joinCode, ownerId, deletedAt)`.
   - `ClassroomMember(classroomId, userId, role TEACHER | TA | STUDENT)`.
   - `ClassroomJoinRequest(id, classroomId, userId, via CODE | LINK, status, reviewedBy, reviewedAt)`.
   - `ClassroomInvite(id, classroomId, invitedUserId, invitedBy, expiresAt, acceptedAt, declinedAt)`.
   - `ClassroomPost(id, classroomId, authorId, body, createdAt, deletedAt)`: announcements.
2. **Codes.**
   - Eight characters from an alphabet without look-alikes (no 0/O, 1/I/L), unique, generated when the class is
     made. The Teacher can replace it, and the old one stops working.
   - The link is `/classes/join/<code>`.
   - A code identifies a class, it admits nobody (ADR-0009). Looking a class up by code shows its name, its teacher
     and whether the viewer already asked; nothing else.
   - Requests with codes are limited to 20 an hour per person, so codes cannot be tried at random.
3. **Roles.**
   - The creator is the class's TEACHER. TEACHER and TA are staff (`CLASSROOM_REVIEW_JOIN_REQUESTS`).
   - Staff invite people by handle or email: STUDENT, or TA for teachers only, since TAs help grade and post.
     Inviting again while an invite is open changes nothing; staff send at most 200 invites a day.
   - The Teacher removes members and changes TA and STUDENT roles. Students leave; the Teacher hands the class to
     another teacher first, who must hold the global TEACHER role, and stays on as a TA.
   - The member list, the code and the requests are for staff; members see the class, its announcements and its
     notes.
   - Creating a class needs the global TEACHER role (`can`) and is counted against `CLASSROOMS_OWNED`. Members are
     counted against the owner's `CLASSROOM_MEMBERS`. With no row there is no limit.
4. **Announcements and class notes are staff's.**
   - Staff post announcements, which every member reads. Students do not post: there are no messages between
     students in a class, and a class may have minors (§15.2). Discussion comes with comments (P3e).
   - Staff share their own notes to the class; members read the published version (`sharedToActorsClassroom`).
   - Students share notes with a teacher one by one, as they already can.
5. **Notes' read model.** As for groups (ADR-0045):
   - `ClassroomRead` and `ClassroomMemberRead`, with the role, fed by `ClassroomCreated`, `ClassroomDeleted` and
     `ClassroomMembershipChanged` (whose `role` is TEACHER, TA or STUDENT).
   - `ClassroomShare(noteId, classroomId)`.
   - The read predicate gains the classroom branch.
   - Co-teaching (both TEACHER or TA of one class) is read from the same model, for teacher-to-teacher sharing
     (ADR-0013).
6. **Restricted minors** may join classes and read them (§15.2: classroom content is allowed). Nothing in a class
   shows their name to anyone but staff.
7. **Notifications.**
   - `JOIN_REQUEST` goes to staff, and `JOIN_DECISION` to the person who asked, without naming who answered.
   - `CLASSROOM_INVITE` (new category) goes to the invited person.
   - `CLASSROOM_POST` goes to every member except the author when staff post. Its email copy comes with push and
     email (P3h).

## Consequences

- A class is a closed room: everything in it is for its members, and only staff speak.
- Teachers who co-teach can share with each other without connecting first.
- Quizzes published to a class and the performance view wait for quizzes (Phase 6). Their permissions are already
  in the matrix.

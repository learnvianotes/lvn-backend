# Classrooms (Phase 3, P3d)

- Date: 2026-10-12
- Package: `@lvn/contracts` 0.22.0, with:
  - events `ClassroomCreated`, `ClassroomDeleted`, `ClassroomInvited` and `ClassroomPosted`;
  - `ClassroomJoinRequested.reviewerIds`;
  - notification category `CLASSROOM_INVITE`.
- Spec: §4.1, §4.2, §5, §15.2; ADR-0009, ADR-0011, ADR-0013, ADR-0046
- Breaking: no

## What changes for clients

**Queries:**
- `classroom(id)`: a class the viewer is in, has asked to join, or is invited to. Null for everyone else.
- `classroomByCode(code)`: what a code shows before joining, which is the name, the teacher, and whether the viewer is
  already in or has asked. Case does not matter. At most 20 lookups an hour per person.
- `myClassrooms` and `myClassroomInvites` (open invites, with the role offered and who invited).

**`Classroom`:**
- For everyone who may see it:
  - `name`, `description`, `teacher` and `memberCount`;
  - `viewerRole` (TEACHER, TA or STUDENT), `viewerRequestId` and `viewerInviteId`;
  - `viewerCan { requestJoin acceptInvite review post manage leave }`.
- Members only: `posts(first, after)` (announcements, newest first) and `sharedNotes(first, after)`.
- Staff (teacher and TAs) only: `joinCode`, `members` and `joinRequests`.
- A field the viewer may not see is null.

**Mutations:**
- Class settings:
  - `createClassroom` is for teachers only.
  - `updateClassroom(newCode)`: when the code is replaced, the old one stops working.
  - `deleteClassroom`.
- Joining:
  - `requestToJoinClassroom(code, via CODE | LINK)` asks to join. Asking twice keeps one request. The code
    identifies the class; it admits nobody.
  - `withdrawClassroomJoinRequest`.
  - `reviewClassroomJoinRequest(decision)`, by staff.
- Invites:
  - `inviteToClassroom(person, role)`, by staff. `person` is a handle or an email. Only the teacher invites TAs.
  - Inviting someone again while an invite is open changes nothing. Staff send at most 200 invites a day.
  - `answerClassroomInvite(accept)`. Invites last 14 days.
- Membership:
  - `leaveClassroom` (the teacher hands the class over first).
  - `removeClassroomMember`, by the teacher.
  - `setClassroomRole`, by the teacher. Setting TEACHER hands the class to that person, who must hold the teacher
    role. The previous teacher stays on as a TA.
- Announcements:
  - `createClassroomPost(body)` is for staff only. `body` is a card's rich-text document.
  - `deleteClassroomPost`, by staff.
- Notes (in the notes subgraph):
  - `shareNoteToClassroom` and `unshareNoteFromClassroom`, by staff, for their own notes. A PRIVATE note becomes
    SHARED.
  - `Note.classrooms` lists the classes a note is shared to. Only the note's owner sees it.

**Sharing between teachers:** two teachers who are both the teacher or a TA of one class can share notes with each
other without connecting first. The refusal now reads "Teachers share with other teachers once they are connected or
teach a class together."

**Refusals:**
- Refusals come as FORBIDDEN errors, in plain words. Examples: "Classes are run by teachers.", "Only the class's
  teacher and TAs post announcements.", "Only the class's teacher invites TAs.", "The class's teacher and TAs share
  notes with it."
- An unknown or expired invite, request or class comes back as NOT_FOUND in `userErrors`.

**Notifications** (each carries `Notification.classroom`, and its path is `/classes/<id>`):
- `JOIN_REQUEST`: to every staff member. `actor` is the person who asked.
- `JOIN_DECISION`: to the person who asked, with `data.decision`. The reviewer is not named, because staff answer
  together.
- `CLASSROOM_INVITE`: to the person invited. `actor` is who invited them.
- `CLASSROOM_POST`: to every member except the author.

**Restricted minors:** they may join classes and read them. Members are listed to staff only, so a minor's name never
shows to other students.

## Behind it

- core tables: `Classroom` (with a unique 8-character `joinCode`), `ClassroomMember`, `ClassroomJoinRequest`,
  `ClassroomInvite` (with the role offered) and `ClassroomPost`. Codes, invites, removals, role changes and deletion
  are audited.
- notes read model:
  - notes keeps `ClassroomRead`, `ClassroomMemberRead` (with the role) and `ClassroomShare`, fed by core's events.
  - `ClassroomMembershipChanged.role` is TEACHER, TA or STUDENT.
  - The read rule gains "shared to a class the viewer is in", for SHARED or PUBLIC notes with a published version.
  - A test checks that the single-note rule and the list query agree for a class member.
- Plan limits: `CLASSROOMS_OWNED` is checked against the teacher's plan and `CLASSROOM_MEMBERS` against the class
  owner's plan. With no row there is no limit.
- Notification storage: `comms.Notification.classroomId`. A class announcement is written with one insert per
  1,000 members.

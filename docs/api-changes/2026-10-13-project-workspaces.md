# Project workspaces (Phase 3, P3f)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.24.0, with:
  - event `ProjectContributorsChanged`;
  - `DoubtAsked.mentorIds`, `DoubtAnswered.askedBy` and `DoubtResolved.askedBy` (all optional);
  - enum `RepositoryProvider`;
  - settings `GITLAB_API_URL` and `GITHUB_TOKEN` (both optional).
- Spec: §4.1, §5, §9.3, §15.2; ADR-0015, ADR-0048
- Breaking: no

## What changes for clients

**Creating one.** `createGroup(type: PROJECT)` starts a project workspace. It counts against `PROJECT_WORKSPACES`,
not `GROUPS_OWNED`.

**New fields on `Group`:**
- `type` and `kind` (POST or IDEA, on `GroupPost`).
- `repository { provider url available name description language stars pushedAt }`, for anyone who sees the
  workspace. When `available` is false the card is the link alone.
- `ideas`, for members: IDEA posts ranked by reactions, then newest. `posts` no longer includes ideas.
- `doubts(status, first, after)`, for the team and the mentor, newest first.
- `viewerMentorInviteId`.
- `showcase`, the credited note (from the notes subgraph).
- `viewerCan` gains `askDoubt`, `inviteMentor` and `acceptMentorInvite`.

**`Doubt`:** `title`, `body`, `repoRef`, `status` (OPEN, ANSWERED or RESOLVED), `author`, `answerCount`, `answers`
(each with `byMentor`) and `viewerCan { answer resolve reopen delete }`. `doubt(id)` reads one.

**`Note.contributors`** (notes subgraph): `{ user, role: CONTRIBUTOR | MENTOR }`, for a showcase note. Showcase notes
also appear in each contributor's `User.publicNotes(kind: PROJECT)`.

**Mutations:**
- `createGroupPost(kind: IDEA)` posts an idea. Ideas exist only in workspaces.
- Admins and the Owner:
  - `setGroupRepository(url)`. `url` is `https://github.com/<owner>/<repo>` or `https://gitlab.com/<path>`; an empty
    value unlinks it.
  - `inviteMentor(person)`. The person must be a teacher, and the invite lasts 14 days.
  - `setProjectShowcase(noteId)`. The note must be a PUBLIC PROJECT note shared to the workspace; null clears it.
- `answerMentorInvite`: the teacher who was invited.
- `askDoubt` (the team), `answerDoubt` (the team and the mentor), `resolveDoubt` (the mentor, admins, the Owner or the
  asker), `reopenDoubt` (the asker or the mentor) and `deleteDoubt` (the asker or a moderator).
- `myMentorInvites`.

**Refusals:**
- FORBIDDEN errors: "The team asks doubts.", "Only the workspace's admins invite mentors.", and the like.
- VALIDATION: "Mentors are teachers. Invite a teacher.", "Share the note with the workspace first.", "The showcase is
  a project note.", and the scorer's "This doubt can't be posted: …".

**Notifications:**
- `MENTOR_INVITE` to the teacher.
- `DOUBT` with `data.kind`: ASKED to every mentor, ANSWERED (with `byMentor`) and RESOLVED to the asker. The path is
  `/groups/<id>/doubts/<doubtId>`.

## Behind it

- Core tables: `GroupRepository`, `Doubt`, `DoubtAnswer`, `MentorInvite`, plus `Group.showcaseNoteId` and
  `GroupPost.kind`.
- Notes table: `ProjectContributor`, kept from `ProjectContributorsChanged`. Core publishes it when the showcase
  changes and on every membership change. Restricted minors are left out.
- Repository details come from `GITHUB_API_URL` and `GITLAB_API_URL`, with `GITHUB_TOKEN` when it is set. The worker
  refreshes them each night (`core.maintenance`, `refresh-repositories`).
- `NOTE_ACCESS.showcaseProblem` checks a showcase note.

# ADR-0015: Student projects and collaborative project workspaces with a mentor

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §4.1, §5, §6.1, §9.3, §10, §18
- Amends: ADR-0014 (who creates projects); §4.1 Group; §5 group rows

## Context

The owner wants (1) students to have **Projects and Notes** on their profiles, and (2) a **collaborative section**
where a group of students works on a **git project**, shares ideas and asks their **mentor** to clear doubts.

## Decision

**Student profiles.** Anyone signed in creates `PROJECT` notes (ADR-0014 kinds); blogs and posts stay
teacher-only. A student profile shows **Notes · Projects**; a teacher profile adds Blog, Posts and Skills.

**Project workspace = a group of type `PROJECT`.** It reuses everything groups already have — membership by invite or
request (ADR-0009, ADR-0011; default `APPROVAL`, PUBLIC + `OPEN` allowed), shared notes, posts, comments, reactions,
moderation, reports and notifications — and adds:

| Part | What it is | Phase |
| --- | --- | --- |
| **Repository** | A linked GitHub or GitLab repo URL. LVN never hosts git. Public repos show name, description, languages, stars and last push from the provider's public API; private repos show the link only. | 3 |
| **Ideas board** | Group posts with `kind = IDEA`; teammates react to rank them. | 3 |
| **Doubts** | Questions to the mentor and team: title, body (cards, so code blocks work), optional pointer to a repo file, line or commit; status `OPEN → ANSWERED → RESOLVED`; answers; the mentor is notified of every new doubt. | 3 |
| **Mentor** | A teacher the workspace's Admins or Owner invite; the teacher accepts. | 3 |
| **Shared notes** | Notes shared to the workspace (`GroupShare`) — design docs, meeting notes. | 3 |
| **Ask AI on a doubt** | RAG over the workspace's shared notes and the doubt thread, with sources (§10.2). | 5 |
| **Repository activity** | A GitHub App the team installs: commits, pull requests and issues in the workspace feed, through webhooks. | 7 |
| **Showcase** | The workspace's PUBLIC `PROJECT` note credits every member as a contributor and the mentor; it appears on each member's Projects tab. | 3 |

**Roles.** The team is Owner, Admin, Moderator and Member as in any group. The **Mentor** (`GROUP_MENTOR`, teachers
only, project workspaces only) posts, answers and resolves doubts and moderates posts and reports, but does **not**
admit members, change settings, invite mentors or delete. The team asks doubts; the team and the mentor answer;
the mentor, Admins, the Owner and the asker resolve.

**Permissions** (`@lvn/contracts` 0.6.0): `group.inviteMentor`, `group.acceptMentorInvite`, `group.askDoubt`,
`group.answerDoubt`, `group.resolveDoubt`; mentors added to post and report moderation; `note.create` allows
`PROJECT` to anyone.

**Events.** `MentorInvited`, `DoubtAsked`, `DoubtAnswered` (with `byMentor`), `DoubtResolved`; membership changes reuse
`GroupMembershipChanged` (role `GROUP_MENTOR` for a mentor).

**Safety.** Workspaces may include minors: mentors are verified teachers, everything is moderated and reportable,
and there are no private messages (§15.2) — doubts and ideas are visible to the whole team.

**Data (core schema).** `Group.type`, `GroupRepository(groupId, provider, url, isPrivate, metadata, refreshedAt)`,
`GroupPost.kind`, `Doubt`, `DoubtAnswer`, `MentorInvite`; `ProjectContributor(noteId, userId, role)` in notes.

## Consequences

- One collaboration model instead of a second groups system; project teams inherit every group safeguard.
- LVN stays out of git hosting; deep repo integration waits for a GitHub App (Phase 7, its own ADR for scopes).

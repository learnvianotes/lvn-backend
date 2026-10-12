# ADR-0048: Project workspaces — repository, ideas, doubts, mentors and the showcase

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend agent (Phase 3, slice P3f); web and mobile follow
- Spec sections: §4.1, §5, §6.1, §9.3, §15.2; ADR-0009, ADR-0015, ADR-0024, ADR-0045, ADR-0047

## Context

ADR-0015 already settles a lot:
- A project workspace is a group of type PROJECT.
- It adds a repository card, an ideas board, doubts for the mentor, a mentor (a teacher), and a showcase that
  credits the team.
- The roles and permissions are in the matrix. The events `MentorInvited`, `DoubtAsked`, `DoubtAnswered` and
  `DoubtResolved` are in contracts.

Left open:
- which repositories are accepted, and where their metadata comes from without a GitHub App (Phase 7);
- how ideas are ranked;
- the doubt lifecycle;
- how mentor invites work;
- how `notes` learns who contributed to a showcase note.

## Decision

1. **Creating one.**
   - `createGroup(type: PROJECT)` starts a workspace for any verified person.
   - It counts against `PROJECT_WORKSPACES`, and not against `GROUPS_OWNED`. With no row there is no limit.
   - Everything else is a group's (ADR-0045): privacy, join policy, posts, shared notes, comments, reactions.
2. **Repository.**
   - Admins and the Owner link one repository: `https://github.com/<owner>/<repo>` or
     `https://gitlab.com/<namespace>/<project>`. Any other address is refused.
   - When `GITHUB_API_URL` or `GITLAB_API_URL` is set, the provider's public API gives the name, description,
     language, stars and last push. With `GITHUB_TOKEN`, GitHub's rate limit is higher (owner input).
   - A repository the API does not show (private, or missing) and one without an API configured both show the link
     only.
   - Metadata is fetched when the repository is linked, and refreshed by the worker each night when older than a
     day.
   - LVN never hosts git and never asks for repository access (deep integration is the Phase 7 GitHub App).
3. **Ideas.**
   - An idea is a group post of kind IDEA. Members and the mentor post them.
   - `ideas` ranks them by reactions (all kinds counted), then newest. It does not include posts. Ideas take
     comments like any post.
4. **Doubts.**
   - Fields: title (at most 200 characters), body (a card's document), and an optional repository reference (a path,
     a line or a commit, at most 300 characters).
   - The team asks. The team and the mentor answer.
   - Status moves OPEN → ANSWERED (on the first answer) → RESOLVED.
   - The mentor, Admins, the Owner and the asker resolve. The asker or a mentor reopens.
   - Doubts are seen by the whole team and the mentor: there are no private messages (ADR-0015).
   - Notifications (category `DOUBT`, opening `/groups/<id>/doubts/<doubtId>`): every mentor hears of a new doubt
     (`data.kind` ASKED); the asker hears of each answer (ANSWERED) and of the resolution (RESOLVED); never their own
     doing.
   - Doubts and answers pass the moderation scorer like comments (ADR-0047).
5. **Mentors.**
   - Admins and the Owner invite a teacher by handle or email. The invite lasts 14 days. Inviting again while an
     invite is open changes nothing.
   - The teacher accepts and joins with the MENTOR role. `GroupMembershipChanged` carries role `GROUP_MENTOR`.
   - Notification `MENTOR_INVITE` goes to the teacher. A mentor leaves like any member; Admins remove them.
6. **Showcase.**
   - Admins and the Owner choose one note shared to the workspace that is PUBLIC and of kind PROJECT
     (`Group.showcaseNoteId`).
   - `core` publishes `ProjectContributorsChanged(noteId, groupId, contributors)` when the showcase is set or
     cleared, and whenever membership changes. `notes` replaces that note's `ProjectContributor(noteId, userId, role
     CONTRIBUTOR | MENTOR)` rows.
   - Readers of the note see the contributors. The note appears on each contributor's Projects tab
     (`User.publicNotes(kind: PROJECT)`).
   - Restricted minors are never named in public (§15.2): they are left out of the contributors.

## Consequences

- No repository tokens or webhooks: nothing to leak, and nothing more than public data.
- Contributors are kept in `notes` from `core`'s events, so public profiles and note pages need no cross-context
  reads.
- If the owner later wants private repositories shown, that is the GitHub App's ADR (Phase 7).

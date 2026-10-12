# Phase 3 — Community: plan

Spec §18: groups and roles, classrooms and the teacher role, the teacher Skills tab (manual, ADR-0012), teacher follows
and connections (ADR-0013), students follow teachers, teacher blogs, posts and projects and the Following feed
(ADR-0014), student projects and project workspaces with mentors (ADR-0015), student follows, block and restrict
(ADR-0016, ADR-0020), group and class sharing, comments, reactions, the activity feed, notifications (in-app, push,
email), reporting and the moderation queue.

**Exit criteria:** join, post and moderate flows end to end; subscription fan-out across two API instances; the
permission matrix fully tested. Shown on the local environment (ADR-0036), the sandbox until the owner sets up AWS.

Started 2026-10-12. Same way of working as Phase 2: each slice lands backend first (schema, migration, `api-changes/`
note), then web and mobile against the generated types; it is merged to `main` in every repo it touches, deployed to
the local environment and checked there before the next starts. Nothing is pushed until the owner says so.

Everything community-facing needs a verified account (`NEEDS_VERIFIED_ACCOUNT`, ADR-0017), and restricted minors keep
their limits (§15.2): never followable, never named in lists, no public publishing.

## Slices

| Slice | What | Repos |
| --- | --- | --- |
| **P3a Notifications and live updates** | `comms` schema: `Notification` (ids only, read state). `communication` writes them from events and serves `notifications`, `unreadNotificationCount`, `markNotificationsRead`. Live updates over `graphql-ws` on their own endpoint beside the gateway, fanned out through Redis pub/sub (ADR-0042); a second API instance on the local environment. First notifications from events that exist today: shares, verification decisions, exports, imports. Web: bell, unread count, notifications page, live. Phone: notifications screen, live while open | all three |
| **P3b People** | `users`: `Follow`, `Block`, `Restriction`, `Connection`, `ConnectionRequest`. Follow (anyone → teacher; anyone verified → student, never a restricted minor), remove a follower, block (ends follows and connections both ways), restrict, teacher connections. Public profiles `/u/[handle]`: Notes and Projects for everyone, Blog, Posts and Skills for teachers; the Follow and Connect buttons; the profile menu. Teacher publications (`BLOG`, `POST`, `PROJECT` kinds) on web and phone; the manual Skills tab (`teacher.editProfile`). Sharing with all connections (`notes` read model). Notifications: FOLLOW, CONNECTION | all three |
| **P3c Groups** | `core`: `Group`, `GroupMember`, `GroupJoinRequest`, `GroupPost`; `notes`: `GroupShare` and a membership read model in `visibleNotesWhere`. Create (`GROUPS_OWNED`), settings, privacy and join policy (ADR-0011), join, request, withdraw, review (ADR-0009), roles, mute, leave, delete; posts and pinned posts; notes shared to a group. Group pages on web and phone. Notifications: JOIN_REQUEST, JOIN_DECISION | all three |
| **P3d Classrooms** | `core`: `Classroom`, `ClassroomMember`, `ClassroomJoinRequest`, `ClassroomInvite`; `notes`: `ClassroomShare`. Teachers create classes (`CLASSROOMS_OWNED`); join by code or link (a request), staff invites (14 days), TAs; announcements; notes shared to a class. Class pages on web and phone. Notifications: CLASSROOM_POST, JOIN_REQUEST, JOIN_DECISION | all three |
| **P3e Comments and reactions** | `core`: `Comment` (notes, cards, group posts; one level of replies), `Reaction`. Comment rule = read rule (`note.comment`); blocks stop them; restricted people's comments wait for approval (ADR-0016). Discussions on notes, posts and classes on web and phone. Notifications: COMMENT | all three |
| **P3f Project workspaces** | Groups of type `PROJECT` (`PROJECT_WORKSPACES`): repository card (public GitHub/GitLab metadata), Ideas (posts of kind `IDEA`, ranked by reactions), Doubts with answers and resolve, mentor invites, the showcase with contributors (`ProjectContributor` in `notes`). Notifications: MENTOR_INVITE, DOUBT | all three |
| **P3g Feeds** | The Following feed (followed people's PUBLIC notes and publications) and the activity feed of one's groups and classes, read-time with keyset pagination (ADR in this slice); blocked people left out. Web Community page; phone Community tab | all three |
| **P3h Push and email** | `DeviceToken`, `NotificationPreference` (per category, quiet hours 22:00–07:00 local). FCM HTTP v1 sender with ids-only payloads (`@lvn/contracts/notifications`, ADR-0021), tokens pruned on `UNREGISTERED`. Email for classroom announcements and a weekly digest, one-click unsubscribe per category. Phone: native FCM token (`expo-notifications`), deep links. Web: settings page | all three |
| **P3i Scoped moderation** | Reports on comments, posts, groups, doubts and profiles; group moderators handle group scope, class staff class scope, platform admins the rest (§15.1); hide, remove, warn, dismiss; mute in groups; one appeal. Queues on web (and a review list on the phone for staff) | all three |
| **P3j Exit** | E2E join, post and moderate flows (Playwright mocked and live, Maestro); fan-out across two API instances on the local environment; the permission matrix tested action by action and the leakage suite extended; `docs/releases/phase-3.md` | all three |

## Decisions to record before the slice that needs them

| ADR | Question | Leaning |
| --- | --- | --- |
| Live updates and notifications (P3a) | §9.2 pins `graphql-ws`; the public endpoint is Apollo Gateway in-process, which does not run subscriptions | *ADR-0042.* A `graphql-ws` endpoint of its own (`graphql-ws` 6.3, `ws` 8), authenticated by the access token, one `live` subscription carrying ids; Redis pub/sub between instances. Notifications are written by `communication` from integration events, in-app first. The transactional outbox stays deferred: events are in-process until a context is extracted (§6.5) |
| Feeds (P3g) | §3 says `core` builds the Following feed; no store is specified | Read-time queries over notes and posts with keyset pagination while the numbers are small; a precomputed timeline only when measurements ask for it |
| Comments (P3e) | Polymorphic `Comment`; replies, mentions, editing | One level of replies, edits marked as edited, deletion leaves "removed"; mentions later |
| Follower counts (P3b) | ADR-0014 shows a count on profiles; ADR-0027 says every public count appears only as a milestone | The person sees their exact count; everyone else sees milestones ("1,000+ followers") or nothing — **to confirm with the owner** |

## Needed from the owner (not blocking the start)

- **Limits** in the FREE plan (ADR-0024): `GROUPS_OWNED`, `GROUP_MEMBERS`, `CLASSROOMS_OWNED`, `CLASSROOM_MEMBERS`,
  `PROJECT_WORKSPACES`. Until they are set, no row means no limit (as with `PDF_PAGES_MONTHLY`).
- **Push (P3h):** the Firebase project's service account for FCM, and `google-services.json` for the Android app.
  Until then push is built and tested against a stand-in FCM endpoint; in-app notifications work without it.
- **Repository cards (P3f):** optionally a GitHub token; without one GitHub allows 60 metadata requests an hour.
- **Open points from earlier ADRs:** may TAs admit students (ADR-0009, encoded: yes)? Does "a normal teacher needs a
  connection" mean more than "staff of that class" (ADR-0011)? Follower counts (above).

## Progress

| Slice | State | Evidence |
| --- | --- | --- |

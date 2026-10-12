# In-app notifications and live updates (Phase 3, P3a)

- Date: 2026-10-12
- Package: `@lvn/contracts` 0.19.0 (`liveEvent`, `LiveEventKind`; `NoteShared.sharedBy`; `NEXT_PUBLIC_LIVE_URL`,
  `EXPO_PUBLIC_LIVE_URL`)
- Spec: §9.2, §9.3; ADR-0042
- Breaking: no

## What changes for clients

A new subgraph, `communication`:

| Field | What |
| --- | --- |
| `notifications(first, after)` | the viewer's notifications, newest first |
| `unreadNotificationCount` | for the bell |
| `markNotificationsRead(input: { ids } \| { all: true })` | returns what stays unread |

A `Notification` has `category`, `path` (an in-app path, the same on web and phone), `actor: User`, `note: Note`,
`data` and `readAt`.
- `note` is null when the viewer can no longer read it. Show the notification without the title, or leave it out.
- Clients write the sentence themselves from the category, the actor's name and the note's title. Nothing in a
  notification quotes user content.

| Category | `data` | Sentence |
| --- | --- | --- |
| `SHARE` | — | "Asha shared *Heaps* with you" |
| `VERIFICATION` | `{ kind: REQUESTED }` | "Asha asked you to verify them" |
| `VERIFICATION` | `{ kind: DECIDED, decision: APPROVED \| REJECTED }` | "Your account is verified" / "Your verification was not accepted"; `actor` is the teacher, or null for platform admins |
| `DATA_EXPORT` | — | "Your data export is ready" |
| `NOTES_IMPORT` | `{ created, skipped, failed }` | "Imported 3 notes" |

Later slices add categories' sentences as they start sending them (FOLLOW, JOIN_REQUEST, COMMENT, …).

## Live updates

The endpoint is `graphql-ws` at `/graphql/live`, its URL taken from `NEXT_PUBLIC_LIVE_URL` / `EXPO_PUBLIC_LIVE_URL`.
- Connect with `connectionParams: { authorization: 'Bearer <access token>' }`; there is no cookie.
- Subscribe with `subscription { live { kind id at } }`. `kind` is `NOTIFICATION` for now. The event says only that
  something changed: refetch `unreadNotificationCount` and the list.
- A bad, expired or revoked token closes the socket with `4403`. graphql-ws clients retry that code. Get a fresh
  token (refresh if needed) in a lazy `connectionParams` function, so every reconnect uses a current one.
- The phone uses the socket only while the app is open.

## Behind it

- `comms.Notification` rows are written by `communication` from events, in the process that published them (API or
  worker), then announced on the person's Redis channel `live:user:<id>`.
- Each API instance subscribes to that channel while it holds one of the person's sockets, so any instance reaches
  them. A revoked session closes its sockets everywhere.
- Read notifications are deleted after 90 days and unread ones after a year (`comms.maintenance`
  `prune-notifications`, nightly). A deleted account's notifications go, and it is no longer named as the actor of
  others'.

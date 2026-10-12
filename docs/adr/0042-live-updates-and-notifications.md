# ADR-0042: Live updates beside the gateway, and in-app notifications

- Status: Accepted
- Date: 2026-10-12
- Deciders: Backend agent (Phase 3, slice P3a); web and mobile follow
- Spec sections: §6.1 (`communication`), §9.2, §9.3, §18 Phase 3 exit ("subscription fan-out across 2 api tasks")

## Context

§9.2 pins GraphQL subscriptions over `graphql-ws`, fanned out through Redis pub/sub so several API instances work, and
carrying ids only. §9.3 says every notification is written in-app first; push and email come on top (P3h).

The public `/graphql` endpoint is Apollo Gateway composing the subgraphs in-process (§6, ADR-0033). `@apollo/gateway`
does not execute subscriptions (Apollo Router does, through its own callback or WebSocket protocols). Integration
events are delivered in-process after the publisher's request returns (`InProcessEventBus`). The spec's transactional
outbox (§9.1) is not built.

## Decision

1. **Live updates have their own endpoint**, `/graphql/live`, on the API's HTTP server.
   - It speaks `graphql-ws` (6.3, over `ws` 8) with a schema of one field, `subscription { live { kind id at } }`, from
     the `communication` context.
   - Events carry a kind and an id only (`@lvn/contracts/notifications` `liveEvent`). Clients refetch through
     `/graphql`, where the permission checks run (§9.2).
   - The first kind is `NOTIFICATION`; later slices add kinds (a new post or comment in a group the viewer is
     looking at).
   - The gateway stays as it is. When contexts move behind Apollo Router (§6.5), this endpoint moves with
     `communication` or is replaced by the router's subscriptions, with the same schema.
2. **Authentication.**
   - The client sends `{ authorization: "Bearer <access token>" }` in `connection_init`; no cookie is used, so
     another site cannot open a socket in the viewer's name.
   - An invalid, expired or revoked token closes the socket with `4403`.
   - The socket is closed with `4403` when its token expires and when its session is revoked (sign-out, reuse,
     reset). The client reconnects with a fresh token.
3. **Fan-out.**
   - Each viewer has a Redis channel, `live:user:<id>`.
   - An instance subscribes to it while it holds at least one of that viewer's sockets.
   - Anything that writes a notification, whether the API or the worker, publishes to it.
   - Session revocations are published on the same channel, so every instance closes the sockets of that session.
4. **Notifications** (`comms.Notification`).
   - Each row holds a recipient, a category (`NotificationCategory`), an in-app path, optional actor and subject
     ids, small category facts that are never user content (a decision, counts), and `readAt`.
   - `communication` writes them from integration events. The API and the worker each subscribe on their own bus,
     because an event is published in exactly one process.
   - In GraphQL, `Notification.actor` is a `User` and `Notification.note` a `Note`, resolved by the owning
     subgraphs. A note the viewer can no longer read resolves to null, so a notification never reveals more than
     the fetch would.
   - Queries: `notifications` (newest first, keyset pages), `unreadNotificationCount`, `markNotificationsRead`.
5. **The first notifications** come from events that already exist:

   | Event | Recipient | Category | Path |
   | --- | --- | --- | --- |
   | `NoteShared` to a user (with the new optional `sharedBy`) | the recipient | `SHARE` | `/notes/<id>` |
   | `VerificationRequested` to a teacher | that teacher | `VERIFICATION` | `/profile` |
   | `VerificationDecided` | the requester | `VERIFICATION` | `/profile` |
   | `DataExportReady` | the requester | `DATA_EXPORT` | `/profile` |
   | `NotesImportCompleted` | the importer | `NOTES_IMPORT` | `/profile` |

   Later slices add follows, joins, comments and the rest.
6. **Retention and deletion.**
   - Read notifications are deleted after 90 days and unread ones after a year (nightly).
   - Deleting an account deletes its notifications and clears it as the actor of others'.
7. **No outbox yet.**
   - Events stay in-process until a context is extracted (§6.5), when the NATS adapter and an outbox come together.
   - If the process stops between a commit and the handler that writes the notification, that notification is lost.
     The thing it points to is not, and the person still finds it in the app.
   - This is accepted for in-app notifications. Push and email (P3h) go through BullMQ jobs, which are durable once
     queued.
8. **Two API instances** on the local environment, behind the entrance with round-robin. Tests start two API apps on
   one Redis and check that a socket on one receives what the other publishes.

## Consequences

- Real-time works today without changing the gateway, and costs one extra Redis connection per instance.
- Clients need a second URL. It comes from their environments (`NEXT_PUBLIC_LIVE_URL`, `EXPO_PUBLIC_LIVE_URL`,
  ADR-0022) and is derived from the API URL only in development.
- The phone uses the socket only while it is open (§9.2) and relies on push (P3h) in the background.
- Notification text is written by each client from the category and the resolved actor and note; nothing quotes user
  content, matching what push may carry (ADR-0021).

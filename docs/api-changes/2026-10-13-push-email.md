# Push, email and notification preferences (Phase 3, P3h)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.25.0, with settings `FCM_API_URL`, `GOOGLE_OAUTH_TOKEN_URL` and
  `FCM_SERVICE_ACCOUNT_JSON` (all optional; push is off without them)
- Spec: §9.1, §9.3, §15.2; ADR-0021, ADR-0050
- Breaking: no

## What changes for clients

**`notificationSettings`:**
- `categories { category push email }`. `email` is null where a category sends no email; today only
  `CLASSROOM_POST` does.
- `quietStart`, `quietEnd` (HH:MM) and `timeZone` (IANA).
- `weeklyDigest`.
- `pushAvailable` (the server has FCM settings) and `devices` (phones registered).

**Mutations:**
- `updateNotificationSettings(categories, quietStart, quietEnd, timeZone, weeklyDigest)`. Only what is sent changes.
- `registerDevice(token, platform: ANDROID | IOS)`: after sign-in and whenever the native token changes. A token
  moves to whoever registered it last.
- `unregisterDevice(token)`: on sign-out.
- `unsubscribeEmail(token)` needs no sign-in. The token comes from an email's link, and the mutation returns the
  `kind` it turned off (CLASSROOM_POST or DIGEST).

**Push, sent by the worker:**
- The title is "LearnViaNotes". The body is written from the category and the actor's name, never from content. A
  recipient who is a restricted minor gets a body with no names.
- The data is `{ notificationId, category, path }`. Apps open `path` when the notification is tapped.
- Nothing is sent when the category is off, during quiet hours, when the notification has already been read, or
  when the person has no phone.

**Email:**
- A class announcement is emailed to each member who keeps `CLASSROOM_POST` email on. The email has the class, the
  teacher, the text and a link.
- The weekly digest goes out on Mondays at 03:30 UTC. It counts the week's unread notifications by kind.
- Both have `List-Unsubscribe` (POST to `<WEB_URL>/unsubscribe/one-click?t=…`, RFC 8058) and a visible link to
  `<WEB_URL>/unsubscribe?t=…`, where one click confirms.

## Behind it

- Comms tables: `DeviceToken`, `NotificationPreference` (holding only the choices that differ from the defaults) and
  `NotificationSettings`.
- Queues `comms.push` (one job per notification) and `comms.email`. In `comms.maintenance`: `prune-devices` (phones
  not seen for 60 days) and `weekly-digest`.
- FCM HTTP v1 with a service-account JWT. A token FCM reports as UNREGISTERED is deleted. Without the owner's
  Firebase files, push stays off; the tests use a stand-in FCM.
- New facade methods: `PEOPLE.contactOf` and `PEOPLE.namesOf`, plus a new `PLACES` facade
  (`classroomNames`, `announcement`) answered by core.
- `MailService.send` takes `{ unsubscribeUrl }`, and the transports pass headers along.

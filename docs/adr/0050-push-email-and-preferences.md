# ADR-0050: Push, email and notification preferences

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend agent (Phase 3, slice P3h); web and mobile follow
- Spec sections: §9.1, §9.3, §15.2; ADR-0021, ADR-0022, ADR-0042, ADR-0046

## Context

ADR-0021 settles the channel and the payload:
- push goes through FCM's HTTP v1 API, carrying ids only, with short server-written text that never quotes user
  content;
- restricted minors get generic text;
- in-app comes first, and push is an extra channel with per-category settings and quiet hours (22:00–07:00 local);
- tokens are pruned when FCM says a device is no longer registered.

§9.3 also asks for email for classroom announcements and a weekly digest, each with one-click unsubscribe.

The Firebase service account and `google-services.json` are owner inputs that have not arrived. Push must be built
and tested without them.

Left open:
- where device tokens and preferences live;
- how push is sent from both processes;
- the defaults;
- what an unsubscribe link carries.

## Decision

1. **Data (`comms`).**
   - `DeviceToken(token, userId, platform ANDROID | IOS, createdAt, lastSeenAt)`. A token belongs to one person:
     registering it again moves it.
   - `NotificationPreference(userId, category, push, email)` holds only the choices that differ from the defaults.
   - `NotificationSettings(userId, quietStart, quietEnd, timeZone, weeklyDigest, lastDigestAt)`. Without a row the
     defaults apply: 22:00–07:00, `Asia/Kolkata`, digest on.
2. **Defaults.**
   - Push is on for every category.
   - Email exists for two things only: class announcements (`CLASSROOM_POST`, on by default) and the weekly digest
     (on). Everything else is in-app and push.
3. **Push.**
   - `NotificationService` writes the notification and then enqueues `comms.push`. The worker sends it: one job per
     notification, retried by the queue.
   - A push is skipped (the in-app notification stays) when the person turned the category off, during their quiet
     hours, or when they have no device.
   - The message is checked against `pushMessage` before sending:
     - title "LearnViaNotes", and a body written from the category and the actor's name ("Priya commented on your
       note");
     - data `{ notificationId, category, path }`;
     - a recipient who is a restricted minor gets a body without names.
   - FCM HTTP v1 is reached at `FCM_API_URL`. The access token is obtained from `GOOGLE_OAUTH_TOKEN_URL` with the
     service account (`FCM_SERVICE_ACCOUNT_JSON`, from Secrets Manager or the environment) and cached until it
     expires.
   - FCM answering UNREGISTERED, or INVALID_ARGUMENT about the token, deletes that token.
   - Without the settings, push is off and nothing is enqueued. Tests run against a stand-in FCM.
4. **Email.**
   - **Class announcements:** each member with the preference on gets the class name, the teacher's name, the
     announcement's text and a link. The email is enqueued per member by the worker from `ClassroomPosted`.
   - **Weekly digest:** on Mondays at 03:30 UTC (09:00 in India), people with unread notifications from the past week
     get counts by category and a link to their notifications. It is sent at most once in six days.
   - **One-click unsubscribe** (RFC 8058):
     - every such email has `List-Unsubscribe` pointing at the web's `/unsubscribe/one-click` route and
       `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. The route answers the mail client's POST by calling the
       API, so every link is built from `WEB_URL` (ADR-0022) and the API needs no public REST route;
     - the visible link opens the web's `/unsubscribe` page, which asks for one click, so that link scanners opening
       it change nothing;
     - both carry a token: an HMAC of the person and the kind (CLASSROOM_POST or DIGEST), keyed from
       `CODE_HMAC_SECRET`. It needs no sign-in and turns off that one kind.
5. **API.**
   - `notificationSettings` and `updateNotificationSettings` (categories, quiet hours, time zone, digest).
   - `registerDevice(token, platform)` and `unregisterDevice(token)`.
   - `unsubscribeEmail(token)`, used by the web's `/unsubscribe` page and route.
6. **Clients.**
   - The web gets a settings page.
   - The phone asks for permission after sign-in and registers the native token (`expo-notifications`; skipped where
     the build has no Firebase file). It opens the notification's path when tapped, and has a settings screen.

## Consequences

- Push needs only the owner's two Firebase files to start working; until then it is complete and tested.
- No user content passes through Google. Emails to members carry class content, as the spec asks.
- Preferences are sparse: a new category is on by default without a migration.

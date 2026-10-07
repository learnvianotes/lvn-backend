# ADR-0021: Push notifications through Firebase Cloud Messaging, ids only

- Status: Accepted (owner asked for the best option, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §2 (Push), §9.2, §9.3, §16.1
- Answers: the open question in ADR-0007

## Context

ADR-0007 limited Firebase to Google sign-in and asked whether push may use FCM. The spec pins FCM for push.

## Options considered

| Option | Verdict |
| --- | --- |
| **FCM for Android and iOS (iOS relayed to APNs)** | One provider and one token type, free, already pinned by the spec; Android has no mainstream alternative. **Chosen.** |
| Expo push service | Needs an Expo account and project — ruled out by ADR-0008. |
| FCM for Android + APNs directly for iOS | Works, but two delivery stacks for no user benefit. Possible later without client changes. |
| Self-hosted (UnifiedPush / ntfy) | Needs an extra app on each phone; not viable for students at large. |

## Decision

- **Firebase products allowed:** Authentication (Google provider only, ADR-0007) and **Cloud Messaging (push
  delivery only)**. Still no Firestore, Functions, Storage, Remote Config, Analytics or Crashlytics.
- **Ids only.** The FCM data block carries `notificationId`, `category` and an app deep link — nothing else; the app
  fetches the content through the API, so permission checks happen on the fetch (§9.2). Title and body are short
  server-written phrases that never quote note, comment or doubt text; restricted minors get generic text. Enforced
  by `@lvn/contracts/notifications` (`pushMessage`, strict schema, `NotificationCategory`).
- **In-app first** (§9.3): every notification is stored and shown in-app; push is an extra channel with per-category
  settings and quiet hours (22:00–07:00 local by default).
- **Mobile:** `expo-notifications` reads the native FCM/APNs device token (`getDevicePushTokenAsync`) — no Expo push
  service, no Expo account. `google-services.json` / `GoogleService-Info.plist` paths come from the build environment.
  iOS push needs an APNs key, which needs the paid Apple Developer Program (ADR-0008).
- **Backend:** `communication` sends through the FCM HTTP v1 API with a service account held in Secrets Manager; prunes
  tokens on `NotRegistered` (§9.3).
- **Web:** no web push in v1; in-app notifications over the subscription stream (§9.2).

## Consequences

- Push works on Android from the first mobile release; on iOS once the Apple membership exists.
- No user content passes through Google; a leaked or logged push reveals only that something happened.

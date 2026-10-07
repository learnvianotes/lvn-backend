# ADR-0007: Firebase Authentication for Google sign-in only

- Status: Accepted (owner decision, 2026-10-08) — one follow-up question on push, below
- Date: 2026-10-08
- Spec sections: §2 (Auth, Auth providers), §7, §7.1, §16.1
- Amends: §2 Auth row, §7 client calls, §7.1 OAuth bullet

## Context

§2 pins backend-issued sessions with OAuth through Passport strategies for Google, GitHub and LinkedIn. The owner
decided that **Firebase is used only for Google login**. The existing Firebase project already has Google sign-in
configured, and the users of the old site (learnvianotes.in) signed in through it.

## Decision

1. **Google sign-in goes through Firebase Authentication.** Web uses the Firebase JS SDK (Google provider, popup
   with redirect fallback). Mobile uses native Google Sign-In and hands the Google credential to Firebase. Both end
   with a Firebase **ID token** on the client.
2. **The client exchanges it once** with a new mutation, `signInWithGoogle(input: { idToken })`. The backend verifies
   the token (`firebase-admin` `verifyIdToken` for `FIREBASE_PROJECT_ID`, `sign_in_provider == "google.com"`,
   `email_verified == true`) and then issues the **normal LVN session** from §7.1 (15-minute JWT + rotating refresh
   token). The client signs out of Firebase straight after; Firebase tokens are never sent to the API again.
3. **Everything else stays as the spec says.** Email + password, GitHub and LinkedIn are backend-owned (Passport,
   `oauthExchange`). Sessions, roles, verification, rate limits and account deletion are backend-owned.
4. **No other Firebase product is used** for LVN data or logic: no Firestore, Cloud Functions, Storage, Hosting
   (beyond the `/__/auth/*` sign-in handler), Remote Config or Analytics. In the Firebase console only the Google
   provider is enabled.
5. **Account linking** follows §7.1: by verified email. The Google identity is stored as
   `OAuthAccount(provider = GOOGLE, providerUserId = <Firebase UID>)`.

## Open question for the owner

The spec pins **Firebase Cloud Messaging** for push (§2, §9.3). On Android there is no practical alternative —
every push notification, including Expo's push service, travels through FCM. Options:
(a) allow FCM as the one other Firebase product, for push delivery only (recommended); or
(b) defer push notifications and rely on in-app notifications and email until decided.

## Consequences

- One extra dependency for Google only; the API's authorization model does not change.
- Returning Google users from the old site keep their Firebase UID, so they are recognised on first sign-in. This makes
  importing their old Firestore data possible if the owner chooses it (existing-state.md → Cut-over).
- Old-site **email + password** users (Firebase-held passwords) cannot sign in with those passwords any more. They sign
  up again with the same email (backend password) or use Google with the same email (linked automatically).
- lvn-web proxies `https://learnvianotes.com/__/auth/*` to the Firebase project so redirect sign-in works on its own
  domain; that domain must be an authorised redirect URI on the Google OAuth client.
- New variables (Phase 1): `FIREBASE_PROJECT_ID` (api); `NEXT_PUBLIC_FIREBASE_*` (web); `EXPO_PUBLIC_FIREBASE_*` and
  the Google client ids (mobile). Firebase web config values are public identifiers, not secrets.

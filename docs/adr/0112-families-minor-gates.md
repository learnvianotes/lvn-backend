# ADR-0112: Families gates for minors

- Status: Accepted (owner decision, 2026-11-11: under-13 changes ship as pull requests to main)
- Date: 2026-11-11
- Deciders: Backend; owner
- Spec sections: Google Play Families policy
- Depends on: ADR-0109, ADR-0110, ADR-0111

## Context

LearnViaNotes admits minors, including children under 13. ADR-0111 left error reporting, push, uploads and social features unchanged. This decision adds the remaining server gates.

A person is a minor when their age is under 18 or is not known. Under-13 is the guardian age band `under_13`, and also a known age under 13 when no band was stored. An unknown age is a minor and is not under-13. Verified consent is the rule from ADR-0109 and ADR-0110: `email_plus` after the parent clicks, or the legacy `verified` method. `auto_unverified` does not count.

## Decision

**Sentry stores no user id, email, username or IP for a minor or an unknown age.** Adults keep `user.id`. A classifier error is treated as a minor. Admin setting `sentry_minor_events_enabled` (default on) drops those events entirely when off. The web SDK posts envelopes to `POST /monitoring`. The API forwards only to the host, project and public key of `SENTRY_DSN`. A different DSN is refused. Envelopes are size-limited (`sentry_tunnel_max_bytes`, default 1_000_000) and rate-limited (`sentry_tunnel_per_minute`, default 30). A request that is not a confirmed adult is scrubbed. No `X-Forwarded-For` is sent upstream.

**Push tokens and capture uploads stay off for an under-13 account until consent is verified.** The error is `FEATURE_UNAVAILABLE_FOR_MINOR`. A voice note, and any `audio/*` or `video/*` upload, counts as capture. A still image does not: the upload intent has a purpose and a MIME type and no capture source, so a camera photo and a gallery photo are the same `image/*` file. There is no client mutation that registers a Firebase installation; registering a push token is the gate.

**Groups, classes, doubts, direct messages and public posts stay off for an under-13 account until a parent turns them on.** The choice is `GuardianConsent.socialEnabled` (default false). `guardianSetSocialEnabled` on the manage link sets it, and only when consent is verified and the band is `under_13`. Withdrawal clears it. Ages 13–17 keep the existing restricted-minor rules. There is no direct-message store; a future message write uses the same `assertSocialOpen` check. Reads that would show a closed under-13 account to other people hide that account.

**Posts, comments, doubts and messages by any minor pass `minor_pii_filter_mode`.** The default is `block` (`MINOR_PII_BLOCKED`). `redact` stores `[removed]` in place of a phone number, email, street address or social handle. `off` stores the text. The same filter runs when a minor makes a note or a quiz public.

**`safetyReminderRequired` is true for a minor until `acknowledgeSafetyReminder`.** Adults are false. Clients render the reminder.

**Recommendations and For You are not behavioural for a minor or an unknown age.** The server returns popular or recent public notes. PostHog does not receive their learning events. The first-party learning day, used by the child’s own study screens, is still stored.

## Consequences

Web and mobile must send `Authorization` on `POST /monitoring`, or set the Sentry user id to the account id, so an adult is not scrubbed. They render `safetyReminderRequired`, handle `FEATURE_UNAVAILABLE_FOR_MINOR` and `MINOR_PII_BLOCKED`, and the parent manage page calls `guardianSetSocialEnabled`. Camera stills cannot be told from gallery images. Embeddings of a redacted public note can lag the redacted chunk text. Sentry’s own IP storage is an infrastructure setting, not this API.

Admin settings do not fall back to the environment. `SENTRY_DSN` stays in the environment. No secret is committed.

# Families gates for minors

- Date: 2026-11-11
- Package: `@lvn/contracts` **0.84.0 → 0.85.0**
- Spec: ADR-0112, Google Play Families policy
- Depends on: PR #72 (age gate, `users.GuardianConsent`), PR #73 (parent notice, email-plus verification, parent manage link, minor purge) and PR #74 (AI safety, branch `cursor/families-ai-safety-22f6`). Merge those first. This branch contains their commits.
- Breaking: additive GraphQL fields and operations, plus two new error codes. Adult Sentry, push, uploads and social behaviour are unchanged.

## Why

An under-13 account needs device and social gates, every minor needs scrubbed error reports and a PII filter, and recommendations must not be behavioural.

## Admin settings

All of these have `environmentFallback: false`. A missing row uses the default. Nothing new is read from the environment. `SENTRY_DSN` stays in the environment. No secret is stored in git.

| Key | Type | Default |
| --- | --- | --- |
| `sentry_minor_events_enabled` | boolean | `true` (scrubbed events still flow; `false` drops them) |
| `minor_pii_filter_mode` | string `block`, `redact` or `off` | `block` |
| `sentry_tunnel_max_bytes` | integer 10_000–5_000_000 | `1000000` |
| `sentry_tunnel_per_minute` | integer 1–300 | `30` |

## Error codes

| Code | When |
| --- | --- |
| `FEATURE_UNAVAILABLE_FOR_MINOR` | Under-13 push, capture upload, or social feature while the gate is closed. Message: “This isn’t available on this account yet.” |
| `MINOR_PII_BLOCKED` | A minor’s post, comment, doubt, message, public note or public quiz contains a phone, email, street address or social handle, and the filter mode is `block`. |

## Tunnel

`POST /monitoring`. The web SDK posts a Sentry envelope. The API forwards it only to the configured DSN’s host and project. A different host, project or public key is `400`. An empty or oversized body is `413`. Over the per-minute limit is `429`. A minor or an unknown age is scrubbed; when `sentry_minor_events_enabled` is off the response is `204` and nothing is forwarded. Upstream failure is `502`.

## Migration

`20261117090000_families_minor_gates`

- `users.GuardianConsent.socialEnabled BOOLEAN NOT NULL DEFAULT false`
- `users.User.safetyReminderAcknowledgedAt TIMESTAMPTZ NULL`

## What changes for clients

- `User.safetyReminderRequired` (viewer only). True for a minor, including an unknown age, until they call `acknowledgeSafetyReminder`.
- `guardianSetSocialEnabled(sessionToken, enabled)` on the parent manage link. Only a verified under-13 account. `GuardianChildSummary.socialEnabled` reports the stored choice.
- Handle `FEATURE_UNAVAILABLE_FOR_MINOR` on push registration, audio and video uploads, groups, classes, doubts and public posts.
- Handle `MINOR_PII_BLOCKED` on posts, comments, doubts and messages.
- Point the web Sentry SDK at `/monitoring` and send the access token, or set the Sentry user id to the account id.
- Camera photos cannot be distinguished from gallery images. Voice notes and audio or video files can.
- There is no direct-message API yet. When one is added it must call the same social gate.

Sentry project IP storage is unchanged here.

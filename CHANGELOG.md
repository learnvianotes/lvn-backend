# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). How a version is cut is in [VERSIONING.md](VERSIONING.md).

## [Unreleased]

## [0.8.1] - 2026-11-25

### Changed

- Sign-up and completing a Google registration no longer need an age. When none is sent, accepting the Terms is the declaration and the account is recorded as an adult (18), so people search, analytics consent and guardian rules work unchanged. An age that is sent is still checked as before.

## [0.8.0] - 2026-11-25

### Added

- Sign in with a 6-digit code sent to your email, or with a passkey (your phone or laptop screen lock), with no password needed. Codes last 10 minutes, work once and stop after five wrong tries; passkeys keep only a public key on our side. [#96](https://github.com/learnvianotes/lvn-backend/pull/96)
- The assistant is called Nova. [#96](https://github.com/learnvianotes/lvn-backend/pull/96)

### Changed

- Phone uploads are faster to become usable: virus scans run four at a time and retry after 5 seconds instead of 15, up to 12 files may wait for a scan, and an AI task made right after an upload waits for the scan instead of failing. [#96](https://github.com/learnvianotes/lvn-backend/pull/96)

### Removed

- GitHub and LinkedIn sign-in. Accounts made with them sign in with an email code or a password reset and keep everything; GitHub stays as a connection for skills and projects. [#96](https://github.com/learnvianotes/lvn-backend/pull/96)

### Security

- Someone who keeps hitting rate limits is put on a one-hour hold automatically, their session is ended and the hold is logged for moderators. After 20 wrong passwords in a day, password sign-in for that email pauses; an email code or passkey still works. [#96](https://github.com/learnvianotes/lvn-backend/pull/96)

- Every library is on its latest compatible release, including the tracing libraries and the PDF reader for notes. The production audit no longer finds anything high-risk, and library updates now arrive as one weekly pull request instead of ten. [#95](https://github.com/learnvianotes/lvn-backend/pull/95)

## [0.7.0] - 2026-11-17

### Added

- Registered accounts are added to the product email list and can turn those emails off. Platform admins can browse content that is not private, and see how many of each kind there are. [#93](https://github.com/learnvianotes/lvn-backend/pull/93)

### Security

- Platform admins and staff have to enter a one-time code from their email before they can use admin tools. The code lasts 10 minutes. The admin activity log shows who did what, and it cannot be edited or deleted. [#92](https://github.com/learnvianotes/lvn-backend/pull/92)
- The sign-in cookie stays on the API host only, so it is not sent to other learnvianotes.in sites, and it expires with the session. Sign-up, password reset, anonymous requests, AI, search, public note reads, webhooks and college-email codes each have their own limit. [#91](https://github.com/learnvianotes/lvn-backend/pull/91)

## [0.6.0] - 2026-11-15

### Added

- Notes can have Word, PowerPoint and plain-text attachments. The file contents are checked, including a large Word or PowerPoint file and text cut mid-character, so a renamed archive or a binary renamed as text is refused. [#79](https://github.com/learnvianotes/lvn-backend/pull/79)
- The running release (the package version plus the short git SHA) shows on the readiness check and as the GraphQL `version` field, and the versioning rules are written down. [#78](https://github.com/learnvianotes/lvn-backend/pull/78)

## [0.5.0] - 2026-11-12

First managed version. This is what production is running, at main `d9d27b2`.

### Added

- Sign-up is 13 and older. The terms and the guardian notice are dated 12 November 2026.
- A parent can confirm a child's account. Families gates keep younger accounts off social features and away from AI, and the database migrations for those gates are in place.
- Uploaded files wait in the AI scanner queue, and a new account gets one welcome email.
- Admins can review accounts and usage, and can set the terms version.

Older detail is in the git history.

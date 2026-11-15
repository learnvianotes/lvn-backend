# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). How a version is cut is in [VERSIONING.md](VERSIONING.md).

## [Unreleased]

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

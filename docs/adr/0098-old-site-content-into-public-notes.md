# ADR-0098: The old site's study content becomes public notes of the LearnViaNotes account

- Status: Accepted. Amended 2026-10-23: the notes are Markdown in this repo and deploy syncs them. The Firestore content import is retired.
- Date: 2026-10-22
- Deciders: Backend agent; owner
- Spec sections: §4.1 (Subject, Topic, Note, Card), §4.3 (versions), §15.1 (moderation); ADR-0002 (its Phase 2 follow-up), ADR-0023 (the old site's personal data), ADR-0037, ADR-0079

## Context

The old learnvianotes.in kept its study pages in Firestore (project `learnvianotes-2e2d7`): 757 topics and 150 Sheet 150 problems. Migration `20261008050000_curated_topics` already seeded the 22 subjects and their topics. The pages themselves were not in Postgres, so subject and topic pages listed no notes.

An operator command, `content:import-legacy`, could read that Firestore and publish the pages. Deploy never ran it, and beta has no Firestore key, so the notes stayed absent. The owner then asked for the pages to live in this backend as Markdown and to be consumed from here, not from Firestore.

## Decision

**Each old topic and each Sheet 150 problem is a PUBLIC note, stored as one Markdown page under `content/study` and upserted on deploy.**

```text
content/study/<subject-slug>/<topic-slug>/<order>-<note-slug>.md
```

The layout, the front matter (`id`, `key`, `subject`, `topic`, `title`, `slug`, `order`) and the card dialect are in `content/study/README.md`. There are 907 pages.

- **Deploy.** The Lightsail `migrate` service runs `scripts/migrate-and-sync.mjs`. That applies `prisma migrate deploy`, then `syncStudyContent`. It needs `DATABASE_URL` only. No new environment variable and no manual command. The same script is the local Terraform migrate step. Merging this to a branch that deploys production seeds production on that deploy.
- **No content migration.** The curated subjects and topics stay the migration that already created them. Note bodies are not SQL. `scripts/generate-study-seed.mjs` is retired: it exits without reading or writing, and it must not delete or regenerate a migration Prisma has already applied.
- **Identity.** A page is matched on its `LegacyContentItem` key (`topic:<subject>/<topic>` or `problem:<subject>/<problem>`). A note `content:import-legacy` already wrote is updated in place when it is still the untouched seeded version, not inserted a second time. The page id is used only when that key is new.
- **Topics by slug.** The page names `subject` and `topic` slugs. The sync loads `Topic` by `subject.slug` and `topic.slug`. It does not embed topic ids, so a database whose ids differ from another environment still matches.
- **Untouched notes update.** Public, moderation OK, still on the version this sync published, and not drafted afterwards: a changed page publishes a new version. Edited, unpublished, hidden or trashed notes are left alone. Users are never updated. Nothing is truncated. Replacing cards marks the previous cards deleted. The only hard delete is an extra topic link on the note being updated.
- **Publisher.** Always the system publisher `publisher@learnvianotes.invalid` (id `019a118c-f480-7000-8000-000000000001`, handle `learnvianotes`, display name LearnViaNotes) and a free plan when that row is created. If that account already owns seeded notes, it stays the publisher. If the row already exists, it is used. No other account is adopted: not `notes@learnvianotes.in`, and not whoever currently holds the handle `learnvianotes`. If that handle belongs to any other account and the system publisher does not exist yet, the sync throws and the deploy stops. The notes are not written under that account. The address is on the reserved `.invalid` domain (RFC 2606), so it cannot receive mail. `passwordHash`, `emailVerifiedAt`, `dateOfBirth`, `verifiedAt`, `verificationMethod` and `registrationCompletedAt` stay null: the columns are nullable, and a birth date or a document-verification flag is not required to store the row. `AuthService`, `OAuthService` and `SessionService` refuse that id and that address: password sign-in, reset, email-link sign-up and provider linking do not attach credentials or start a session. Email sign-up, Google sign-up and handle edits refuse the brand and role handles (`learnvianotes`, `learn-via-notes`, `lvn`, `admin`, `support`, `official`, `system`, `publisher`, and the same kind of name).
- **Not this path.** Accounts and the old site's personal data stay with ADR-0023 (`legacy:snapshot`, which still reads Firestore for user snapshots). Google sign-in still uses Firebase (ADR-0007). The Firestore reader for study notes and the `content:import-legacy` command are removed.

## Consequences

- The first deploy of this change publishes the 907 notes anywhere the migrate container runs, including production. Check the target database first (runbook `docs/runbooks/legacy-content.md`).
- Subject pages, search and anonymous `publicNotes` see the notes the same way they see any public note. People can save or fork them.
- Editing a page and deploying updates that seeded note until someone edits it in the app. After that, the app wins.
- The LearnViaNotes system account is not a person and cannot sign in. The catalogue is not published under any other account. A handle collision stops the deploy.
- `/core` stays off (ADR-0079).

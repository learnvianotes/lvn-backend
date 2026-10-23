# Study notes on deploy

ADR-0098. The 22 subjects and their topics are already in the database from `20261008050000_curated_topics`. The 907 study notes (757 topics and 150 Sheet 150 problems) are Markdown pages in `content/study`. The compose `migrate` service runs `node scripts/migrate-and-sync.mjs`, which applies `prisma migrate deploy` and then upserts those pages. Nothing else has to run after a deploy, and the sync does not need an environment variable that the migrate container does not already have (`DATABASE_URL`).

Merging the change seeds production on that environment's first deploy. The same step seeds beta. There is no manual command and no Firestore credential for this content. Google sign-in and the old-account snapshot (`legacy:snapshot`, ADR-0023) are separate and still use Firebase.

The sync matches a note on its `LegacyContentItem` key, and looks subjects and topics up by slug. It inserts a missing note and updates a seeded note that nobody has edited. It does not update users, and it does not change a note someone has edited, unpublished, hidden or trashed. Running it again does not duplicate rows.

## Before the first deploy

On the target database (beta first, then production):

```sh
cd /opt/lvn
docker compose exec -T postgres psql -U lvn -d lvn -c 'SELECT count(*) FROM notes."LegacyContentItem";'
docker compose exec -T postgres psql -U lvn -d lvn -c "SELECT id, email, handle, \"displayName\" FROM users.\"User\" WHERE email IN ('publisher@learnvianotes.invalid', 'notes@learnvianotes.in') OR handle = 'learnvianotes';"
```

- **`LegacyContentItem` count.** Zero means this database has not imported the notes. The sync creates them. A count above zero means `content:import-legacy` (or an earlier sync) already ran: the sync attaches to those keys and does not insert a second note per key. Expect 907 after a full import.
- **Publisher.** No row should already use `publisher@learnvianotes.invalid` unless a previous sync created the system publisher. If `notes@learnvianotes.in` or the handle `learnvianotes` exists, the sync reuses that account and does not create the `.invalid` one. Confirm that account is the publisher you intend, not a student. The system publisher cannot sign in. A reused account is left as it is, including its password, so do not point the catalogue at a learner.

The system publisher, when it is created, is `publisher@learnvianotes.invalid`, handle `learnvianotes`, display name LearnViaNotes. It has no password, no verified email, no birth date and no verification flag. Those columns are nullable. Auth refuses that id and that address for password sign-in, reset, email-link sign-up and provider linking.

## After deploy

`publicNotes` and each subject page list the notes. A second deploy of the same pages changes nothing. Editing a page under `content/study` and deploying updates that note until someone edits it in the app.

`scripts/generate-study-seed.mjs` is retired. It exits without touching the filesystem. Do not regenerate migrations from it.

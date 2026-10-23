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
docker compose exec -T postgres psql -U lvn -d lvn -c "select migration_name from _prisma_migrations where migration_name like '20261109%';"
```

- **`LegacyContentItem` count.** Zero means this database has not imported the notes. The sync creates them. A count above zero means `content:import-legacy` (or an earlier sync) already ran: the sync attaches to those keys and does not insert a second note per key. Expect 907 after a full import.
- **Publisher.** The publisher is always `publisher@learnvianotes.invalid` (id `019a118c-f480-7000-8000-000000000001`, handle `learnvianotes`). The sync creates that row when it is missing. It does not adopt `notes@learnvianotes.in` or any other account. If the handle `learnvianotes` already belongs to someone else and the system publisher does not exist yet, the migrate container exits and no notes are published. Free that handle (give the person a different one) and deploy again. Do not point the catalogue at a learner. The system publisher cannot sign in.
- **Migrations named `20261109%`.** Lists any migration from that day that this database has applied. An empty result means none of those names are recorded.

The system publisher is `publisher@learnvianotes.invalid`, handle `learnvianotes`, display name LearnViaNotes. It has no password, no verified email, no birth date and no verification flag. Those columns are nullable. Auth refuses that id and that address for password sign-in, reset, email-link sign-up and provider linking. Sign-up will not give a person the handle `learnvianotes`.

## After deploy

`publicNotes` and each subject page list the notes. A second deploy of the same pages changes nothing. Editing a page under `content/study` and deploying updates that note until someone edits it in the app.

`scripts/generate-study-seed.mjs` is retired. It exits without touching the filesystem. Do not regenerate migrations from it.

# Import the old site's study content

ADR-0098. The 22 subjects, their topics, and the 907 study notes (757 topics and 150 Sheet 150 problems) are loaded
by Prisma migrations. `prisma migrate deploy` — the compose `migrate` service — applies them. Nothing else has to
run on beta after a deploy, and the migrations do not need an environment variable that beta does not already have.
They insert by stable id and skip a row that is already there. They do not update or delete a user, and they do not
change a note after someone has edited it.

The command below is the later path: a fresh read of Firestore when the old content itself has changed. It is not
required for the notes the migrations already carry.

One command reads the old learnvianotes.in content from its Firestore (project `learnvianotes-2e2d7`) and
writes it into an environment's database:

- the catalogue: subjects, topic groups and topics, added or renamed to match, never removed;
- each of the 757 topics and 150 Sheet 150 problems as a PUBLIC note of the LearnViaNotes account, under its topic.

It never writes to Firestore, and it imports no accounts: people sign in again with Google. Their old progress and
personal notes are a separate step (ADR-0023, `legacy:snapshot`). Beta first; **production only when the owner says
so**.

## Before the first run

1. **A read-only service account** on `learnvianotes-2e2d7` (Google Cloud console → IAM & Admin → Service accounts):
   - name it `lvn-content-reader`;
   - give it the **Cloud Datastore Viewer** role (`roles/datastore.viewer`) and nothing else;
   - create a JSON key. Keep it out of git and chat. Delete the key in the console after the import.
2. **The LearnViaNotes account** on the target site (`https://beta.learnvianotes.in`):
   - sign up with the content mailbox, display name "LearnViaNotes", and confirm the email;
   - set the handle to `learnvianotes` in its settings if it got another one.
3. **Verify it.** Publishing needs a verified account (§5), and this one has no college to verify it. On the VM, as the
   deploy user:

   ```sh
   cd /opt/lvn
   docker compose exec -T postgres psql -U lvn -d lvn -c "UPDATE users.\"User\" SET \"verifiedAt\" = now(), \"verificationMethod\" = 'DOCUMENTS' WHERE handle = 'learnvianotes' RETURNING id, handle"
   ```

## Run it

On the VM, as the deploy user. Copy the key over first (`scp lvn-content-reader.json deploy@<host>:/opt/lvn/`):

```sh
cd /opt/lvn
chmod 600 lvn-content-reader.json
lvn_import() {
  docker compose run --rm --no-deps -T --user "$(id -u):$(id -g)" \
    -v "$PWD/lvn-content-reader.json:/secrets/firestore-reader.json:ro" \
    worker node apps/worker/dist/cli.js content:import-legacy --credentials /secrets/firestore-reader.json "$@"
}
lvn_import --owner learnvianotes --dry-run   # reads and converts everything, writes nothing
lvn_import --owner learnvianotes             # writes
rm lvn-content-reader.json
```

- The dry run prints the report with "would create 907".
- The real run takes about a minute. It runs beside the stack in a one-off worker container (up to about 300 MB).
- Then open `https://<host>/subjects/dsa-basics/analysis`: the topic lists its note by LearnViaNotes.

Options:

- `--subject <id>` (repeatable): only those subjects' notes. The catalogue is always brought up to date.
- `--project <id>`: when the key file's `project_id` is not the old project.
- `--allow-production`: needed when `APP_ENV=production`. Only with the owner's word.

## The report

| Field | What it means |
| --- | --- |
| `notes.created` / `updated` / `unchanged` | Written for the first time, rewritten as a new published version because the old document changed, or already up to date |
| `notes.editedInApp` | Someone changed, unpublished or made private the note in the app since the import wrote it. It is left alone |
| `notes.trashed` | In the LearnViaNotes account's trash. Left alone; once the trash is emptied, the next run writes it again |
| `notes.held` | Held by the moderation scorer (ADR-0037). A platform admin approves them in `/admin/moderation` |
| `notes.invalid` | Documents that are not in the old format, with the reason |
| `catalog.*` | Subjects and topics added or changed; `notInSource` lists curated topics the old site no longer has (kept) |
| `leftOut` | What no card can show, by kind. Today: one inline SVG diagram |

## Running it again

It is safe to run again at any time. A run writes only what changed. `notes.LegacyContentItem` remembers each old
document's note, what was written and the version published.

To bring an edited note back to the old content, trash it in the LearnViaNotes account and empty the trash. The next
run writes it again.

## Trying it locally

The Firestore emulator stands in for the old project:

1. Start it: `java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar --host <host> --port 8089`.
2. Fill it with the old app's own seeder, from lvn-web's `release/college-launch` worktree:
   `FIRESTORE_EMULATOR_HOST=<host>:8089 node scripts/content/seed/run.mjs`.
3. Run the import with `-e FIRESTORE_EMULATOR_HOST=<host>:8089`. Any service-account-shaped key file works, since the
   emulator does not check it.

`<host>` must be reachable from the worker container: for the local Compose stack, its network's gateway address.

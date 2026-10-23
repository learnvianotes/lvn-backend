# Study notes

The seeded study catalogue: 907 public notes (the old site's topics and Sheet 150 problems), one Markdown file each. Deploy reads this directory and upserts the notes. There is no SQL migration for the note bodies, and no Firestore read.

```text
content/study/<subject-slug>/<topic-slug>/<order>-<note-slug>.md
```

`README.md` is documentation and is not a note. Subjects and topics are the curated rows already in the database (`20261008050000_curated_topics`). A page names them by slug. The sync looks the topic up by those slugs, so a database whose topic ids differ still matches.

## Front matter

| Field | Meaning |
| --- | --- |
| `id` | Stable note id. Used only when this key is not already in `notes.LegacyContentItem`. |
| `key` | `topic:<subject>/<topic>` or `problem:<subject>/<problem>`. This is how an existing note is found, including one that `content:import-legacy` already wrote. |
| `subject`, `topic` | Slugs. Not ids. |
| `title` | The published title. |
| `slug` | The note's URL slug. |
| `order` | Position in the topic, starting at 1. It is the filename prefix. It is not a database column. |

## Body

The body is the cards, in order. A run of paragraphs and lists is one text card, until the next heading, fence, callout or table.

- Headings `#`, `##`, `###` are heading cards (levels 1 to 3).
- A fence `` ```lang `` is a code card. A filename is `filename:` plus `encodeURIComponent`, in the info string, with no raw spaces.
- A fence `` ```question `` is a question card. A line that is exactly `---` separates the prompt and the answer.
- `> [!NOTE] Title` (also `INFO`, `TIP`, `WARNING`, `DANGER`) is a callout. A blank `>` follows the marker, then the quoted body.
- A GitHub-flavoured table is a table card. The first row is the header.
- Bold, italic and strike are `<strong>`, `<em>` and `<del>`, so they do not collide with backticks. `<sup>`, `<sub>`, `<u>` and `<br>` are the other inline marks. A `|` inside a code span in a table cell is written `&#124;`, so the row does not split.

Editing a page and deploying updates that note while it is still the untouched seeded version: public, the published version this sync wrote, and not drafted again afterwards. A note someone has edited, unpublished, hidden or trashed is left as it is. Users are never updated. Nothing is truncated. The only delete is an extra topic link on a seeded note whose page now names a different topic; cards that are replaced are marked deleted and kept.

## Publisher

New notes belong to the system publisher `publisher@learnvianotes.invalid` (handle `learnvianotes`) when no seeded catalogue and no `notes@learnvianotes.in` account or `learnvianotes` handle exists yet. That address is on the reserved `.invalid` domain, so it cannot receive mail. The row has no password, no verified email, no birth date and no verification flag. Sign-in, password reset, email-link sign-up and provider linking are refused in code for that id and that address.

If seeded notes already exist, their owner is kept. Otherwise an existing `notes@learnvianotes.in` account, then the handle `learnvianotes`, is reused and not modified. A reused account is not blocked from sign-in. Confirm before deploy that it is the publisher you intend.

## Deploy

`scripts/migrate-and-sync.mjs` runs `prisma migrate deploy`, then this sync. The Lightsail `migrate` service runs that script. It needs `DATABASE_URL` only. Adding or editing a page and deploying publishes that change on the next deploy, including production.

`scripts/generate-study-seed.mjs` is retired. It exits without reading or writing anything. Do not regenerate migrations from it: a migration that has already been applied must not be wiped.

# ADR-0098: The old site's study content becomes public notes of the LearnViaNotes account

- Status: Accepted (owner's approved launch plan, 2026-10-22: "a Firestore-to-Postgres content migration script for the
  old learnvianotes-2e2d7 content")
- Date: 2026-10-22
- Deciders: Backend agent; owner
- Spec sections: §4.1 (Subject, Topic, Note, Card), §4.3 (versions), §15.1 (moderation); ADR-0002 (its Phase 2
  follow-up), ADR-0023 (the old site's personal data), ADR-0037, ADR-0079

## Context

The old learnvianotes.in keeps its study content in Firestore (project `learnvianotes-2e2d7`), as the old seeder wrote
it from `content-build/` (old repo `schema/content.ts`, `scripts/content/seed`):

| Document | What it holds |
| --- | --- |
| `meta/content` | the content version |
| `catalog/current` | 22 subjects, each with its topics and their groups |
| `subjects/{subjectId}` | one subject |
| `subjects/{subjectId}/topics/{topicId}` | a topic's page, a tree of typed nodes stored flat (757 topics) |
| `subjects/{subjectId}/problems/{problemId}` | a Sheet 150 problem: statement, examples, constraints, approach, solutions in four languages (150) |

The rewrite already has the catalogue: migration `20261008050000_curated_topics` seeded the curated subjects and topics
from the same catalogue (ADR-0002, Phase 2). The pages themselves only reach people through `/core`, the old app inside
the new site, which is switched off (ADR-0079). The subject and topic pages of the rewrite list the public notes on each
topic, and early on most are empty.

ADR-0002 left one question open: whether the curated content becomes public notes owned by a LearnViaNotes account.

## Decision

**Yes: each old topic and each Sheet 150 problem becomes a PUBLIC note of a LearnViaNotes account, filed under its
curated topic.** An operator runs one command against an environment's database:

```text
node apps/worker/dist/cli.js content:import-legacy --credentials <service-account.json> --owner <handle> [--dry-run] [--subject <id>]…
```

- **Source.** Firestore, read with a service-account key file given on the command line. Give that account read access
  only (Cloud Datastore Viewer); the command only reads. It writes to a production database only with
  `--allow-production`, and production waits for the owner's word.
- **Catalogue.** Subjects by slug, topic groups as parent topics and topics under them, as the seeding migration made
  them: added when new, renamed or moved when changed, never removed (notes and resources point at them). Curated topics
  the old site no longer has are reported.
- **Owner.** An existing, verified adult account named on the command line (the rule for anyone publishing, §5). The
  import makes no accounts.
- **Conversion** (`contexts/notes/src/domain/legacy-content.ts`). Section headings become heading cards, code blocks
  (and tabbed code, one card per language) code cards, callouts and boxed cards callout cards, tables table cards,
  interview Q&A question cards, and the rest (paragraphs, lists, steps, chips, flows, formulas, key–value rows, bit
  diagrams, schedules) text cards. Every card passes the editors' schema. A problem's note has its difficulty and
  LeetCode link, its parts in the old page's order, and a code card per language. What a card cannot show is counted in
  the report: in the current content, one inline SVG diagram.
- **Publishing** goes the way a person's does: publish (a version, moderation screening, search, Ask AI's chunks), then
  public (audited). A note the rule-based scorer holds waits in `/admin/moderation` and is reported.
- **Idempotent.** `notes.LegacyContentItem` records, per old document, the note it became, the hash of what was written
  and the version published. A re-run writes only what changed, as a new published version. It leaves alone a note
  someone has since edited, unpublished, made non-public or trashed in the app.
- **`--dry-run`** reads and converts everything and writes nothing; it needs no owner.
- **Not migrated:** accounts (people sign in again with Google), and the old site's personal data (progress and personal
  notes), which stays with ADR-0023's snapshot and claim (`legacy:snapshot`).

Measured on the full content in the Firestore emulator, seeded by the old seeder: 907 notes, 21,042 cards, every card
valid, at most 329 cards in one note (the 1,000 limit), the largest card 6 KB.

## Consequences

- From the first import, every curated topic of the old site has its note, written by LearnViaNotes. Subject pages,
  search, recommendations and Ask AI work with it like any public note, and people can save it or fork it with credit.
- `/core` stays off and unchanged (ADR-0079). The old pages and the notes are two renderings of the same content until
  `/core` is retired.
- The old pages' look (Tabler icons, bit diagrams, Gantt charts, the one SVG) does not carry over exactly: the text and
  the order do.
- The LearnViaNotes account owns 907 public notes. Its points and achievements from publishing them mean nothing; the
  account is a publisher, not a learner.
- Runbook: `docs/runbooks/legacy-content.md`.

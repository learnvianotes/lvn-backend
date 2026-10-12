# Phase 4 — Search (closed on the local environment; AWS still deferred by the owner)

Spec: [lvn-architecture-v2.md](../architecture/lvn-architecture-v2.md) §11 and §18. Plan:
[phase-4.md](../plans/phase-4.md).

Scope:
- the Typesense provider;
- Cmd/K and phone search;
- filters;
- the re-index job;
- the hybrid ranking flag.

Everything below runs and is tested on the dev machine and on the **local environment** (ADR-0036), the stand-in for
the AWS sandbox, which the owner has deferred.

## Shipped

### lvn-backend

| Slice | What | ADR |
| --- | --- | --- |
| P4a Typesense provider | `SEARCH_PROVIDER` chooses Postgres or Typesense. One writer keeps both indexes: an outbox (`notes.SearchChange`) filled by triggers on notes' tables and by other contexts' events, drained in order by the worker, with a version check. Collections for notes, people and topics are versioned behind aliases and rebuilt through the outbox. The read predicate is a Typesense filter, built per request from the viewer's groups, classes and blocks. Postgres answers when Typesense fails or is slow, and its index keeps moving while Typesense is away | 0055 |
| P4b Search everywhere | Groups (signed in: public ones, and private ones for members) and classes (members only), checked against `core`'s live state; filters by kind, subject, topic, author and source (mine, shared, public), also without words; more notes by cursor, up to 200 | 0056 |
| P4c Ranking and speed | `SEARCH_HYBRID`: reciprocal rank fusion with a semantic source bound to `SEMANTIC_SEARCH`, empty until Phase 5. A `search` span and the `lvn.search.duration` histogram. `pnpm search:bench` | 0057 |
| P4d Exit | Both providers in the leakage suite; a live web search test; Maestro `search.yaml`; this note | — |

Infrastructure:
- **Typesense 30.2:** in compose (`:58108`) and on the local environment, as a container with a volume. The worker
  rebuilds its collections from Postgres if the volume is lost.
- **Configuration:** `SEARCH_PROVIDER`, `TYPESENSE_URL`, `TYPESENSE_API_KEY`, `TYPESENSE_COLLECTION_PREFIX`,
  `SEARCH_TIMEOUT_MS` and `SEARCH_HYBRID`.
- **Migrations:** the outbox and its triggers (`20261015090000_search_outbox`); groups and classes in it
  (`20261015120000_search_places`).

### lvn-web

- **The Ctrl/⌘+K palette** finds notes, people, groups, project workspaces, classes and topics. A topic opens its
  notes on `/search`.
- **`/search`:**
  - kind chips (notes, blog posts, posts, projects) and source chips (mine, shared with me, public), kept in the
    address;
  - a topic chip, which lists that topic's notes newest first with no words needed;
  - groups and classes;
  - More results.

### lvn-mobile

Explore searches everything:
- kind and source chips;
- groups, classes and topics; a topic lists its notes;
- More results;
- recent searches, the last ten, kept in the phone's local database. They are removable, wiped at sign-out, and never
  sent anywhere.

## Bugs found and fixed

- **Draft titles reached readers (since Phase 2).** `Note.title` gave everyone the current draft's title, which the
  owner might not have published, in search, lists and feeds. Readers now get the published version's title, and a
  test in the leakage suite checks it (P4b).
- **One bad group reference wiped a whole search answer.** `core` resolves a group reference only for a viewer who
  may see it, so a signed-out search or a group deleted since indexing made the whole response null. Groups and
  classes are now checked against `core`'s live state, and signed out, search finds neither (P4b).
- **Bulk indexing was slow.** 10,000 notes took 62 s to index, past §11's 60 s line. The Postgres index is now written
  in one statement per turn of up to 500 notes (P4c).
- **sharp 0.35.4 in the API** was a high advisory published during the phase (P4a).

## Test evidence (2026-10-13)

| Check | lvn-backend | lvn-web | lvn-mobile |
| --- | --- | --- | --- |
| Lint, typecheck | clean | clean | clean; `expo-doctor` 21/21 |
| Unit / integration / e2e | 698 passing + 3 todo across 17 packages: API 333 + 3 todo, contracts 172, notes 44, users 41, storage 19, communication 15, and the libraries | 93 unit (Vitest) | 224 (Jest: unit and components) |
| Browser / device E2E | — | Playwright 277 on desktop and phone (mocked API) | Maestro 18/18 against the VM (see below) |
| `pnpm audit --prod --audit-level high` | clean (one advisory ignored with its reason) | clean | clean (two ignored with their reasons) |
| Contract | `graphql:check`; `env:check` (57 variables) | codegen against the current schema | same; the contracts copy synced |
| Migrations | applied to an empty database, no drift | — | — |

The search tests:
- **Permission filter** (`contexts/notes/test/integration/search-filter.test.ts`): Typesense's filter against
  `visibleNotesWhere` on 192 notes. These cover every visibility, trash, share and moderation case, for nine kinds of
  viewer:
  - the owner;
  - an editor and a viewer the note is shared with;
  - members of a group and of a class it is shared to;
  - a member of a deleted group;
  - a stranger;
  - someone who blocked the owner;
  - a signed-out visitor.

  Dropping one condition from the filter fails four of them.
- **Search on both providers** (`search.e2e`, 18 tests): words, prefixes, stems and typos; visibility; minors;
  groups and classes; filters; paging.
- **Typesense** (`search-typesense.e2e`, 8 tests):
  - index parity through every kind of change (shares, places, moderation, topics, trash, deletion), and for groups
    and classes;
  - query parity with Postgres for six kinds of viewer;
  - orphans and stale documents removed;
  - a collection version rebuilt and its alias moved;
  - the fallback and an outage.
- **Hybrid ranking** (`search-hybrid.e2e`, 3 tests; fusion unit tests, 3).
- **Leakage suite:** every search check runs on both providers and requires the same answer.

### On the local environment (2026-10-13)

Deployed with `infra/scripts/deploy-local.sh` to `http://100.70.234.41:8080`:
- `lvn-backend:4d5367bc9522` (api ×2, worker);
- `lvn-web:c7cd5c22979d`;
- `lvn-pdf-engine:ba7b4eb92070`;
- Typesense 30.2.

| Check | Result |
| --- | --- |
| `pnpm smoke` | 13/13 |
| `pnpm lifecycle` | 60/60, with a new check: a typo in a note's words finds it, which only Typesense does |
| Playwright, live | 32/32 on desktop and phone, with a search test: a typo finds a public note, the Projects chip narrows, Ctrl+K opens a group |
| Maestro | 18/18, with `search.yaml`: a verified learner finds the group by its name on Explore, opens it, and finds the search again under recent searches. The full run passed 15. `auth` failed because the run lacked the VM's Mailpit address; `search` failed because a `hideKeyboard` after Enter went Back out of Explore; `tabs` still expected the old hint. All three passed when run again after those fixes |
| `pnpm search:bench` | 10,000 notes, 531 searches from 4 clients through the entrance: p50 23.2 ms, p95 51.1 ms, p99 76.1 ms; no errors and no fallbacks |

The P4b build of the app is installed by adb on the owner's Samsung (SM-S918B) and talks to the local environment.

## Exit criteria (§18)

- [x] **Index parity test against the Postgres provider.** Both indexes hold the same notes after every kind of
  change. Every Typesense document's access fields equal Postgres's. Both providers give the same notes to the same
  people for exact words (`search-typesense.e2e`). The search suite runs whole on both providers.
- [x] **Permission filter test.** §5's rule, "a matching Typesense filter string … identical result sets on seeded
  data", holds on 192 notes for nine kinds of viewer (`search-filter.test.ts`). The leakage suite agrees on both
  providers, and a stale document is never shown: every hit is opened as the viewer.
- [x] **p95 under 150 ms.** 51.1 ms on the local environment over 10,000 notes (44.7 ms on the first run, before the
  indexing fix).

## Needed from the owner

Nothing new. Still open from earlier phases:
- the Firebase service account and `google-services.json`, for real push;
- the FREE plan's limits;
- optionally, a GitHub token;
- confirmations of follower counts and TA admission;
- the legal texts, the PDF page limit and evaluation set, Telugu OCR, and the AWS sandbox.

## Known gaps carried forward

**Search:**
- Hybrid ranking has nothing to fuse until Phase 5 binds embeddings to `SEMANTIC_SEARCH`. The flag is off
  everywhere.
- Resources join search in Phase 7.
- The learning event `SEARCH_PERFORMED` waits for Phase 6's `trackEvents`.
- The two providers differ slightly on people: Typesense matches the start of words, in names, handles and a
  teacher's headline and bio, with typos; Postgres matches any part of a name. Only the fallback uses Postgres.
- The web keeps no recent searches by design: browsers are often shared.
- The benchmark ran on the local environment, one machine. k6 load in the sandbox is Phase 9's.

**AWS:** the sandbox's Terraform gains Typesense when AWS is set up, along with the PDF engine and ClamAV, which it
also lacks.

**From Phase 3**, unchanged ([release notes](phase-3.md#known-gaps-carried-forward)):
- no people picker for mentions;
- voice notes are not built;
- repeated suspensions do not escalate on their own;
- PDFs need a connection on the phone, and the PDF viewer is still to be measured on a mid-range phone;
- the pipelines have never run;
- feeds are read at request time;
- quizzes and class performance come in Phases 5 and 6.

GraphQL schema: `contracts/graphql/schema.graphql` as of `@lvn/contracts` 0.32.0.

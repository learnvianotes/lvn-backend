# ADR-0055: Search on Typesense — one writer, the read predicate as a filter, Postgres as the fallback

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend agent (P4a); Web and Mobile agents review (no client change)
- Spec sections: §5 (rules that follow from the matrix), §9.1 (`search` queue), §11, §16; ADR-0043, ADR-0045, ADR-0046

## Context

§11 moves search to Typesense in Phase 4, behind a `SearchProvider`, so clients "never know which provider answered".
Several things have to hold at once:

- **Same predicate.** §5 requires search to be filtered by the same predicate as `Read`, with "a matching Typesense
  filter string" that a test holds to `visibleNotesWhere` on seeded data.
- **Re-index on change.** Membership changes must re-index the documents they affect, and "a stale window above 60 s
  is an incident". `reindex-all` must run "with a version check so it can run while writes continue".

Since Phase 2, the Postgres provider indexes a note's published version on publish, through the `notes.search`
queue. Nothing re-indexes a note when its shares, visibility, moderation or trash state change; it did not need to,
because the read predicate was applied at query time.

A second store brings two problems Postgres alone did not have. It can drift from the database, and it can be down.

## Decision

1. **Providers.**
   - `SEARCH_PROVIDER=postgres|typesense` chooses who answers (default `postgres`).
   - `TYPESENSE_URL` and `TYPESENSE_API_KEY` reach Typesense; `TYPESENSE_COLLECTION_PREFIX` defaults to `lvn_`.
   - Whenever Typesense is configured, the worker writes to it, so reads can switch without a rebuild.
   - The Postgres provider is the Phase 2 code. The GraphQL `search` field is unchanged.
   - The HTTP API is called with `fetch`, without a client library. The key is the server's alone.
2. **One writer, from an outbox.** Every change that can alter a search document adds a row to `notes.SearchChange`
   (`entity`, `entityId`):
   - **Notes' own tables:** database triggers add the row, in the same transaction as the change, so no write path
     can forget it. The triggers are on:
     - `Note`: visibility, moderation, trash, the published version, owner and kind;
     - `NoteShare`, `GroupShare`, `ClassroomShare`, `NoteTopic`;
     - `Topic`.
   - **Other contexts:** their events add the row: `UserRegistered`, `UserDeleted`, `RoleChanged`, and a new
     `PersonChanged` for name, handle, date of birth and the teacher's headline and bio.

   The worker drains the outbox, one drainer at a time (a transaction advisory lock), at most 500 rows a turn, and
   polls every second while it is empty. A turn has three steps:
   1. read the rows;
   2. read each entity's current state;
   3. write both indexes (`NoteSearchDocument` and Typesense) and delete exactly the rows it read.

   This order is the version check: a change committed after its state was read always leaves a row behind for the
   next turn, so the index converges whatever order changes and rebuilds come in. The time from a row's creation to
   its write is logged, with a warning past 60 s (§11's incident line).
3. **Re-indexing and collection versions.**
   - `reindex-all` (nightly at 04:15, and on demand) adds a row for every entity in batches of 500, then removes
     documents whose entity is gone. It goes through the same drainer, so it never races a live change.
   - Each collection is versioned: `<prefix>notes_v1` lives behind the alias `<prefix>notes`, and reads use the alias.
   - When the worker starts, it creates any missing version and adds a row for every entity of that kind. It records
     the outbox position it has to pass in `notes.SearchCollection`.
   - Writes go to every existing version of a collection. Once the drainer passes the recorded position, the alias
     moves to the new version and the old one is dropped. A schema change is therefore a version bump, and Typesense
     can be emptied at any time: it rebuilds from Postgres.
4. **Documents.**
   - **`notes`** (published, not in the trash):
     - for matching: `title`, `topics`, and `body` (the same text as `NoteSearchDocument`, up to 100,000 characters);
     - for filters and access: `kind`, `visibility`, `moderation`, `ownerId`, `sharedUserIds` (every share row,
       connections included), `groupIds`, `classroomIds`, `topicIds`, `subjectIds`;
     - for sorting: `publishedAt`.
   - **`users`:** every account that has a date of birth. Fields: `handle`, `displayName`, the teacher's `headline` and
     `bio`, `dobDays` (the date of birth as days since 1970), `globalRole`.
   - **`topics`:** `title`, `subject`, `origin`, `proposedById`.

   Groups and classrooms come in P4b; resources come in Phase 7.
5. **The read predicate as a filter.** `visibleNotesFilter` is built on every request from four lists: the viewer's
   own id, the groups and classes they are in (notes' read models; deleted places left out), and the people a block
   keeps apart. It is `visibleNotesWhere` restricted to published documents:
   - the owner;
   - PUBLIC notes that are not held, hidden or removed;
   - SHARED or PUBLIC notes that are OK or held for review, and are shared with the viewer, a group of theirs or a
     class of theirs;

   and in every case, not owned by a blocked person. Signed out, only public notes that are not held, hidden or
   removed.

   Membership changes therefore need no re-index: only a note's own shares live on its document. The other
   collections:
   - **People:** born on or before the day the consent age allows, and nobody a block keeps apart.
   - **Topics:** curated ones, or ones the viewer proposed.

   Every note hit is still opened as the viewer before it is returned (as in Phase 2). A stale document can rank a
   note, but it can never show one.
6. **Matching, kept close to Postgres.**
   - Fields and weights: title, topics and body, weighted 3, 2 and 1.
   - Every word must match (`drop_tokens_threshold` 0), and the last word matches as a prefix.
   - English stemming applies, and so does PostgreSQL's English stop-word list, kept as a Typesense stop-word set.
   - Typos are tried only when nothing matches exactly (Typesense's default), on every field rather than only on
     titles.
   - **Snippets:** the body's highlight, marked with U+E000 … U+E001 and widened to whole words. When only the title
     matched, the snippet is the body's first words.
7. **Fallback.** If Typesense fails, or takes longer than `SEARCH_TIMEOUT_MS` (default 800), the Postgres provider
   answers that request, logged as `search.fallback`. Typesense never decides whether the API is ready.

## Consequences

- **Both indexes are written.** That costs one more write per change, and buys a fallback. It also makes the parity
  tests possible: index parity, permission-filter parity against `visibleNotesWhere`, and query parity on exact words.
- **The triggers live in the migration's SQL**, which Prisma does not model. The parity tests exercise every one.
  When a context is extracted (§6.5), its triggers become events, like `PersonChanged`.
- **No client changes.** Notes are found as before, with more typo tolerance. People are found by word prefixes of
  their name, handle, headline or bio, where Postgres matched any part of a name.
- **Running Typesense.**
  - Locally: in compose. On the local environment: a container with a volume.
  - In the sandbox: an ECS service without a disk. It starts empty and rebuilds; until it is ready, the fallback
    answers. It is added to the sandbox's Terraform when AWS is set up, with the PDF engine and ClamAV, which that
    Terraform also lacks (Phase 2 release notes).
  - Production sizing waits for real numbers.
- **Not here:** groups and classrooms, filters and paging come in P4b (ADR-0056). The hybrid ranking flag comes in
  P4c; its semantic side needs Phase 5's embeddings.
